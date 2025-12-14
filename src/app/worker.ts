import Base from "./base";
import { Message } from "../kombu/message";

export default class Worker extends Base {
  handlers: object = {};
  activeTasks: Set<Promise<any>> = new Set();

  /**
   * Register task handler on worker handlers
   * @method Worker#register
   * @param {String} name the name of task for dispatching.
   * @param {Function} handler the function for task handling
   *
   * @example
   * worker.register('tasks.add', (a, b) => a + b);
   * worker.start();
   */
  public register(name: string, handler: (...args: any[]) => any): void {
    if (!handler) {
      throw new Error("Undefined handler");
    }
    if (this.handlers[name]) {
      throw new Error("Handler is already set");
    }

    this.handlers[name] = function registHandler(...args: any[]): Promise<any> {
      try {
        return Promise.resolve(handler(...args));
      } catch (err) {
        return Promise.reject(err);
      }
    };
  }

  /**
   * Start celery worker to run
   * @method Worker#start
   * @example
   * worker.register('tasks.add', (a, b) => a + b);
   * worker.start();
   */
  public async start(): Promise<any> {
    console.info("celery-plus worker starting...");
    console.info(`registered tasks: ${Object.keys(this.handlers).join(", ")}`);
    try {
      return await this.run();
    } catch (err) {
      console.error(err);
      throw err;
    }
  }

  /**
   * @method Worker#run
   * @private
   *
   * @returns {Promise}
   */
  private async run(): Promise<any> {
    await this.isReady();
    return this.processTasks();
  }

  /**
   * @method Worker#processTasks
   * @private
   *
   * @returns function results
   */
  private processTasks(): Promise<any> {
    const consumer = this.getConsumer(this.conf.CELERY_QUEUE);
    return consumer();
  }

  /**
   * @method Worker#getConsumer
   * @private
   *
   * @param {String} queue queue name for task route
   */
  private getConsumer(queue: string): () => Promise<any> {
    const onMessage = this.createTaskHandler();

    return (): any => this.broker.subscribe(queue, onMessage);
  }

  public createTaskHandler(): (message: any) => Promise<any> {
    const onTaskReceived = async (message: Message): Promise<any> => {
      if (!message) {
        return;
      }

      let payload = null;
      let taskName = message.headers["task"];
      if (!taskName) {
        // protocol v1
        payload = message.decode();
        taskName = payload["task"];
      }

      // strategy
      let body;
      let headers;
      if (payload == null && !("args" in message.decode())) {
        body = message.decode(); // message.body;
        headers = message.headers;
      } else {
        const args = payload["args"] || [];
        const kwargs = payload["kwargs"] || {};
        const embed = {
          callbacks: payload["callbacks"],
          errbacks: payload["errbacks"],
          chord: payload["chord"],
          chain: null
        };

        body = [args, kwargs, embed];
        headers = {
          lang: payload["lang"],
          task: payload["task"],
          id: payload["id"],
          rootId: payload["root_id"],
          parentId: payload["parentId"],
          group: payload["group"],
          meth: payload["meth"],
          shadow: payload["shadow"],
          eta: payload["eta"],
          expires: payload["expires"],
          retries: payload["retries"] || 0,
          timelimit: payload["timelimit"] || [null, null],
          kwargsrepr: payload["kwargsrepr"],
          origin: payload["origin"]
        };
      }

      // request
      const [args, kwargs /*, embed */] = body;
      const taskId = headers["id"];

      const handler = this.handlers[taskName];
      if (!handler) {
        throw new Error(`Missing process handler for task ${taskName}`);
      }

      console.info(
        `celery-plus Received task: ${taskName}[${taskId}], args: ${args}, kwargs: ${JSON.stringify(
          kwargs
        )}`
      );

      const timeStart = process.hrtime();

      const taskPromise = (async () => {
        try {
          const result = await handler(...args, kwargs);
          const diff = process.hrtime(timeStart);
          console.info(
            `celery-plus Task ${taskName}[${taskId}] succeeded in ${diff[0] +
              diff[1] / 1e9}s: ${result}`
          );
          await this.backend.storeResult(taskId, result, "SUCCESS");
          return result;
        } catch (err: any) {
          console.error(
            `celery-plus Task ${taskName}[${taskId}] failed: ${err?.message || err}`
          );
          await this.backend.storeResult(
            taskId,
            err?.message || String(err),
            "FAILURE"
          );
          throw err;
        } finally {
          this.activeTasks.delete(taskPromise);
        }
      })();

      this.activeTasks.add(taskPromise);
      return taskPromise;
    };

    return onTaskReceived;
  }

  /**
   * @method Worker#whenCurrentJobsFinished
   *
   * @returns Promise that resolves when all jobs are finished
   */
  public async whenCurrentJobsFinished(): Promise<any[]> {
    return Promise.all(Array.from(this.activeTasks));
  }

  /**
   * @method Worker#stop
   *
   * @todo implement here
   */
  public stop(): any {
    throw new Error("not implemented yet");
  }
}
