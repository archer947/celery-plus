
import * as amqplib from "amqplib";
import { CeleryBackend } from ".";

export default class AMQPBackend implements CeleryBackend {
  private resultExpiresMs: number;
  connect: Promise<amqplib.ChannelModel>;
  channel: Promise<amqplib.Channel>;
  _channelInstance?: amqplib.Channel;
  _connectionInstance?: amqplib.ChannelModel;

  /**
   * AMQP backend class
   * @constructor AMQPBackend
   * @param {string} url the connection string of amqp
   * @param {object} opts the options object for amqp connect of amqplib
   */
  constructor(url: string, opts: { [key: string]: any } = {}) {
    this.resultExpiresMs = opts.CELERY_RESULT_EXPIRES || 86400000;

    // Avoid passing celery-plus custom keys to amqplib connect.
    const connectOpts: { [key: string]: any } = { ...opts };
    delete connectOpts.CELERY_RESULT_EXPIRES;

    this.connect = (async () => {
      try {
        const conn = await amqplib.connect(url, connectOpts as any);
        this._connectionInstance = conn;
        (conn as any).on?.("error", (err: unknown) =>
          console.error("[AMQPBackend] connection error:", err)
        );
        (conn as any).on?.("close", () =>
          console.warn("[AMQPBackend] connection closed")
        );
        return conn;
      } catch (err) {
        console.error("[AMQPBackend] Connection error:", err);
        throw err;
      }
    })();

    this.channel = (async () => {
      try {
        const conn = await this.connect;
        const ch = await conn.createChannel();
        this._channelInstance = ch;
        ch.on("error", err => console.error("[AMQPBackend] channel error:", err));
        ch.on("close", () => console.warn("[AMQPBackend] channel closed"));
        return ch;
      } catch (err) {
        console.error("[AMQPBackend] Channel error:", err);
        throw err;
      }
    })();
  }

  /**
   * @method AMQPBackend#isReady
   * @returns {Promise} promises that continues if amqp connected.
   */

  public isReady(): Promise<amqplib.ChannelModel> {
    return this.connect;
  }

  /**
   * @method AMQPBackend#disconnect
   * @returns {Promise} promises that continues if amqp disconnected.
   */

  public async disconnect(): Promise<void> {
    try {
      try {
        const ch = await this.channel;
        await ch.close();
      } catch {
        // ignore
      }

      try {
        const conn = await this.connect;
        await conn.close();
      } catch {
        // ignore
      }
    } catch (err) {
      console.error("[AMQPBackend] Disconnect error:", err);
    }
  }

  /**
   * store result method on backend
   * @method AMQPBackend#storeResult
   * @param {String} taskId
   * @param {any} result result of task. i.e the return value of task handler
   * @param {String} state
   * @returns {Promise}
   */

  public async storeResult(
    taskId: string,
    result: any,
    state: string
  ): Promise<boolean> {
    const queue = taskId.replace(/-/g, "");
    try {
      const ch = await this.channel;
      await ch.assertQueue(queue, {
        durable: true,
        autoDelete: true,
        exclusive: false,
        arguments: {
          "x-expires": this.resultExpiresMs
        }
      });
      return ch.publish(
        "",
        queue,
        Buffer.from(
          JSON.stringify({
            status: state,
            result: state == "FAILURE" ? null : result,
            traceback: null,
            children: [],
            task_id: taskId,
            date_done: new Date().toISOString()
          })
        ),
        {
          contentType: "application/json",
          contentEncoding: "utf-8"
        }
      );
    } catch (err) {
      console.error("[AMQPBackend] storeResult error:", err);
      return false;
    }
  }

  /**
   * get result data from backend
   * @method AMQPBackend#getTaskMeta
   * @param {String} taskId
   * @returns {Promise}
   */

  public async getTaskMeta(taskId: string): Promise<object | null> {
    const queue = taskId.replace(/-/g, "");
    try {
      const ch = await this.channel;
      await ch.assertQueue(queue, {
        durable: true,
        autoDelete: true,
        exclusive: false,
        arguments: {
          "x-expires": this.resultExpiresMs
        }
      });
      const msg = await ch.get(queue, { noAck: false });
      if (msg === false) {
        return null;
      }

      // Ensure we don't leak unacked messages (which breaks polling).
      try {
        if (msg.properties.contentType !== "application/json") {
          throw new Error(
            `unsupported content type ${msg.properties.contentType}`
          );
        }
        if (msg.properties.contentEncoding !== "utf-8") {
          throw new Error(
            `unsupported content encoding ${msg.properties.contentEncoding}`
          );
        }
        const body = msg.content.toString("utf-8");
        const parsed = JSON.parse(body);
        ch.ack(msg);
        return parsed;
      } catch (err) {
        ch.ack(msg);
        throw err;
      }
    } catch (err) {
      console.error("[AMQPBackend] getTaskMeta error:", err);
      return null;
    }
  }
}
