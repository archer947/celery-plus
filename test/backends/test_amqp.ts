import { assert } from "chai";
import { v4 } from "uuid";
import AMQPBackend from "../../src/backends/amqp";
import { skipIfAmqpUnavailable, TEST_AMQP_URL } from "../helpers/integration";

const amqpUrl = TEST_AMQP_URL;

describe("amqp backend", () => {
  before(async function () {
    await skipIfAmqpUnavailable(this, amqpUrl);
  });

  describe("storeResult", () => {
    it("just store", done => {
      const taskId = v4();
      const backend = new AMQPBackend(amqpUrl, {});

      backend.storeResult(taskId, 3, "SUCCESS").then(result => {
        assert.equal(result, true);
        backend.disconnect().then(() => done());
      });
    });
  });

  describe("getTaskMeta", () => {
    it("getTaskMeta with store", done => {
      const taskId = v4();
      const backend = new AMQPBackend(amqpUrl, {});

      backend.storeResult(taskId, 3, "SUCCESS").then(() => {
        backend.getTaskMeta(taskId).then(data => {
          assert.isNotNull(data);
          const meta = data as { result?: unknown };
          assert.equal(meta.result, 3);
          backend.disconnect().then(() => done());
        });
      });
    });
  });
});
