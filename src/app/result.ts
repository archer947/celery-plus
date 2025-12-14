import { CeleryBackend } from "../backends";

const isFinalStatus = {
  SUCCESS: true,
  FAILURE: true,
  REVOKED: true,
}
const isErrorStatus = {
  TIMEOUT: true,
  FAILURE: true,
  REVOKED: true,
}

function createError(message: string, data: object): Error {
  const error = new Error(message);
  Object.assign(error, data);
  return error;
}

export class AsyncResult {
  taskId: string;
  backend: CeleryBackend;
  private _cache: Promise<any> | null;

  /**
   * Asynchronous Result
   * @constructor AsyncResult
   * @param {string} taskId task id
   * @param {CeleryBackend} backend celery backend instance
   */
  constructor(taskId: string, backend: CeleryBackend) {
    this.taskId = taskId;
    this.backend = backend;
    this._cache = null;
  }

  /**
   * @method AsyncResult#get
   * @returns {Promise}
   */
  public async get(timeout?: number, interval = 500): Promise<any> {
    const waitFor = (): Promise<any> => {
      return new Promise((resolve) => {
        let timeoutId: NodeJS.Timeout | undefined;
        let intervalId: NodeJS.Timeout;

        if (timeout) {
          timeoutId = setTimeout(() => {
            clearInterval(intervalId);
            resolve({ status: "TIMEOUT", result: {} });
          }, timeout);
        }

        intervalId = setInterval(() => {
          void (async () => {
            try {
              const meta = await this.backend.getTaskMeta(this.taskId);
              if (meta && isFinalStatus[meta["status"]]) {
                if (timeoutId) clearTimeout(timeoutId);
                clearInterval(intervalId);
                resolve(meta);
              }
            } catch (err) {
              console.error(`Error fetching task meta: ${err}`);
            }
          })();
        }, interval);
      });
    };

    if (!this._cache) {
      this._cache = waitFor();
    } else {
      const cached = await this._cache;
      if (!(cached && isFinalStatus[cached["status"]])) {
        this._cache = waitFor();
      }
    }

    const meta = await this._cache;
    if (isErrorStatus[meta["status"]]) {
      throw createError(meta["status"], meta["result"]);
    }
    return meta["result"];
  }

  private async getTaskMeta(): Promise<object | null> {
    if (!this._cache) {
      this._cache = this.backend.getTaskMeta(this.taskId);
      return this._cache;
    }

    const cached = await this._cache;
    if (cached && isFinalStatus[cached["status"]]) {
      return cached;
    }

    this._cache = this.backend.getTaskMeta(this.taskId);
    return this._cache;
  }

  public async result(): Promise<any> {
    const meta = await this.getTaskMeta();
    return meta ? meta["result"] : null;
  }

  public async status(): Promise<string> {
    const meta = await this.getTaskMeta();
    return meta ? meta["status"] : null;
  }
}
