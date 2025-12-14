import { assert } from "chai";
import Redis from "ioredis";
import Client from "../../src/app/client";
import Worker from "../../src/app/worker";
import { skipIfRedisUnavailable, TEST_REDIS_URL } from "../helpers/integration";

describe("node celery worker (redis integration)", () => {
  const redisUrl = TEST_REDIS_URL;
  let redisAvailable = false;
  let worker: Worker;

  before(async function () {
    redisAvailable = await skipIfRedisUnavailable(this, redisUrl);

    worker = new Worker(redisUrl, redisUrl);
    worker.register("tasks.add", (a: number, b: number) => a + b);
    worker.register("tasks.add_kwargs", ({ a, b }: { a: number; b: number }) => a + b);
    worker.register(
      "tasks.add_mixed",
      (a: number, b: number, { c, d }: { c: number; d: number }) => a + b + c + d
    );

    // Start consume loop without awaiting (it runs indefinitely).
    await worker.isReady();
    void worker.start();
    await new Promise((r) => setTimeout(r, 50));
  });

  afterEach(async () => {
    if (worker) {
      await worker.whenCurrentJobsFinished();
    }
  });

  after(async () => {
    if (!redisAvailable) return;

    if (worker) {
      await worker.disconnect();
    }

    const redis = new Redis(redisUrl);
    await redis.flushdb();
    await redis.quit();
  });

  it("tasks.add", async () => {
    const client = new Client(redisUrl, redisUrl);
    const result = client.sendTask("tasks.add", [1, 2]);
    const data = await result.get();
    assert.equal(data, 3);
    await client.disconnect();
  });

  it("tasks.add_kwargs", async () => {
    const client = new Client(redisUrl, redisUrl);
    const result = client.sendTask("tasks.add_kwargs", [], { a: 1, b: 2 });
    const data = await result.get();
    assert.equal(data, 3);
    await client.disconnect();
  });

  it("tasks.add_mixed", async () => {
    const client = new Client(redisUrl, redisUrl);
    const result = client.sendTask("tasks.add_mixed", [3, 4], { c: 1, d: 2 });
    const data = await result.get();
    assert.equal(data, 10);
    await client.disconnect();
  });
});
