import { assert } from "chai";
import Redis from "ioredis";
import * as sinon from "sinon";
import Client from "../../src/app/client";
import Worker from "../../src/app/worker";
import { AsyncResult } from "../../src/app/result";
import { skipIfRedisUnavailable, TEST_REDIS_URL } from "../helpers/integration";

describe("celery functional tests", () => {
  const redisUrl = TEST_REDIS_URL;
  let redisAvailable = false;
  let client: Client;
  let worker: Worker;

  before(async function () {
    redisAvailable = await skipIfRedisUnavailable(this, redisUrl);

    client = new Client(redisUrl, redisUrl);
    worker = new Worker(redisUrl, redisUrl);

    worker.register("tasks.add", (a: number, b: number) => a + b);
    worker.register("tasks.add_kwargs", ({ a, b }: { a: number; b: number }) => a + b);
    worker.register("tasks.fail", () => {
      throw new Error("boom");
    });
    worker.register(
      "tasks.delayed",
      (result: unknown, delay: number) =>
        new Promise(resolve => {
          setTimeout(() => resolve(result), delay);
        })
    );

    // Start consume loop without awaiting (it runs indefinitely).
    await worker.isReady();
    void worker.start();
    await new Promise((r) => setTimeout(r, 50));
  });

  afterEach(() => {
    sinon.restore();
    return worker.whenCurrentJobsFinished();
  });

  after(async () => {
    if (!redisAvailable) return;

    if (client && worker) {
      await Promise.all([client.disconnect(), worker.disconnect()]);
    }

    const redis = new Redis(redisUrl);
    await redis.flushdb();
    await redis.quit();
  });

  describe("initialization", () => {
    it("should create a valid redis client without error", done => {
      client.isReady().then(() => done());
    });
  });

  describe("Basic task calls", () => {
    it("should call a task without error", done => {
      client.createTask("tasks.add").delay([1, 2]);
      done();
    });
  });

  describe("result handling with redis backend", () => {
    it("should return a task result", done => {
      const result = client.createTask("tasks.add").applyAsync([1, 2]);

      assert.instanceOf(result, AsyncResult);

      result.get().then(() => done());
    });

    it("should resolve with the message", done => {
      const result = client.createTask("tasks.add").applyAsync([1, 2]);

      assert.instanceOf(result, AsyncResult);

      result.get().then(message => {
        assert.equal(message, 3);
        done();
      });
    });

    describe("when the the result has previously resolved", () => {
      it("should immediately resolve when the task was previously resolved", done => {
        const getTaskMetaSpy = sinon.spy(client.backend, 'getTaskMeta');

        const result = client.createTask("tasks.add").applyAsync([1, 2]);

        result
          .get()
          .then(() => {
            // await the result a second time
            return result.get();
          })
          .then(() => {
            // the backend should not have been invoked more than once
            assert.strictEqual(getTaskMetaSpy.callCount, 1);
          })
          .then(done)
          .catch(done);
      });
    });

      it("should pass kwargs via applyAsync", done => {
        const result = client.createTask("tasks.add_kwargs").applyAsync([], { a: 1, b: 2 });
        result
          .get()
          .then((message: unknown) => {
            assert.equal(message, 3);
            done();
          })
          .catch(done);
      });

      it("should surface task failure as FAILURE", done => {
        const result = client.createTask("tasks.fail").applyAsync([]);
        result
          .get()
          .then(() => assert.fail("should not get here"))
          .catch((error: Error) => {
            assert.strictEqual(error.message, "FAILURE");
            done();
          });
      });
  });

  describe("timeout handing with the redis backend", () => {
    it("should reject with a TIMEOUT error", done => {
      const result = client
        .createTask("tasks.delayed")
        .applyAsync(["foo", 1000]);

      result
        .get(500)
        .then(() => {
          assert.fail("should not get here");
        })
        .catch(error => {
          assert.strictEqual(error.message, "TIMEOUT");
          done();
        })
    });

    it("should allow get() after a TIMEOUT", done => {
      const result = client
        .createTask("tasks.delayed")
        .applyAsync(["bar", 120]);

      result
        .get(20)
        .then(() => assert.fail("should not get here"))
        .catch((error: Error) => {
          assert.strictEqual(error.message, "TIMEOUT");
          return result.get(1000);
        })
        .then((value: unknown) => {
          assert.strictEqual(value, "bar");
          done();
        })
        .catch(done);
    });
  });
});
