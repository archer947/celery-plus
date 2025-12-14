import * as amqplib from "amqplib";
import { CeleryBroker } from ".";
import { Message } from "../message";

class AMQPMessage extends Message {
  constructor(payload: amqplib.ConsumeMessage) {
    super(
      payload.content,
      payload.properties.contentType,
      payload.properties.contentEncoding,
      payload.properties,
      payload.properties.headers
    );
  }
}

export default class AMQPBroker implements CeleryBroker {
  connect: Promise<amqplib.ChannelModel>;
  channel: Promise<amqplib.ConfirmChannel>;
  queue: string;
  _channelInstance?: amqplib.ConfirmChannel;
  _connectionInstance?: amqplib.ChannelModel;

  /**
   * AMQP broker class
   * @constructor AMQPBroker
   * @param {string} url the connection string of amqp
   * @param {object} opts the options object for amqp connect of amqplib
   * @param {string} queue optional. the queue to connect to.
   */
  constructor(url: string, opts: { [key: string]: any } = {}, queue = "celery") {
    this.queue = queue;

    // Avoid passing celery-plus custom keys to amqplib connect.
    const connectOpts: { [key: string]: any } = { ...opts };
    delete connectOpts.CELERY_RESULT_EXPIRES;

    this.connect = (async () => {
      const conn = await amqplib.connect(url, connectOpts as any);
      this._connectionInstance = conn;
      (conn as any).on?.("error", (err: unknown) =>
        console.error("[AMQPBroker] connection error:", err)
      );
      (conn as any).on?.("close", () =>
        console.warn("[AMQPBroker] connection closed")
      );
      return conn;
    })();

    this.channel = (async () => {
      const conn = await this.connect;
      const ch = await conn.createConfirmChannel();
      this._channelInstance = ch;
      ch.on("error", err => console.error("[AMQPBroker] channel error:", err));
      ch.on("close", () => console.warn("[AMQPBroker] channel closed"));
      return ch;
    })();
  }

  /**
   * @method AMQPBroker#isReady
   * @returns {Promise} promises that continues if amqp connected.
   */
  public async isReady(): Promise<amqplib.ConfirmChannel> {
    const ch = await this.channel;
    await Promise.all([
      ch.assertExchange("default", "direct", {
        durable: true,
        autoDelete: false,
        internal: false
      }),
      ch.assertQueue(this.queue, {
        durable: true,
        autoDelete: false,
        exclusive: false
      })
    ]);
    return ch;
  }

  /**
   * @method AMQPBroker#disconnect
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
      console.error("[AMQPBroker] Disconnect error:", err);
    }
  }

  /**
   * @method AMQPBroker#publish
   *
   * @returns {Promise}
   */
  public publish(
    body: object | [Array<any>, object, object],
    exchange: string,
    routingKey: string,
    headers: object,
    properties: object
  ): Promise<boolean> {
    const messageBody = JSON.stringify(body);
    const contentType = "application/json";
    const contentEncoding = "utf-8";

    return (async () => {
      const ch = await this.channel;
      await ch.assertQueue(routingKey, {
        durable: true,
        autoDelete: false,
        exclusive: false
      });

      return ch.publish(exchange, routingKey, Buffer.from(messageBody), {
        contentType,
        contentEncoding,
        headers,
        deliveryMode: 2,
        ...properties
      });
    })();
  }

  /**
   * @method AMQPBroker#subscribe
   * @param {String} queue
   * @param {Function} callback
   * @returns {Promise}
   */
  public subscribe(
    queue: string,
    callback: (message: Message) => void
  ): Promise<amqplib.Replies.Consume> {
    return (async () => {
      const ch = await this.channel;
      await ch.assertQueue(queue, {
        durable: true,
        autoDelete: false,
        exclusive: false
      });

      return ch.consume(queue, (rawMsg) => {
        if (!rawMsg) return;
        try {
          // now supports only application/json of content-type
          if (rawMsg.properties.contentType !== "application/json") {
            throw new Error(
              `unsupported content type ${rawMsg.properties.contentType}`
            );
          }

          // now supports only utf-8 of content-encoding
          if (rawMsg.properties.contentEncoding !== "utf-8") {
            throw new Error(
              `unsupported content encoding ${rawMsg.properties.contentEncoding}`
            );
          }

          callback(new AMQPMessage(rawMsg));
          ch.ack(rawMsg);
        } catch (err) {
          console.error("[AMQPBroker] consume error:", err);
          // don't requeue poison messages by default
          ch.nack(rawMsg, false, false);
        }
      });
    })();
  }
}
