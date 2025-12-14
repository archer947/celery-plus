import { CeleryBackend } from ".";

export default class DisabledBackend implements CeleryBackend {
  public async isReady(): Promise<void> {
    return;
  }

  public async disconnect(): Promise<void> {
    return;
  }

  public async storeResult(
    _taskId: string,
    _result: any,
    _state: string
  ): Promise<true> {
    return true;
  }

  public async getTaskMeta(_taskId: string): Promise<null> {
    return null;
  }
}
