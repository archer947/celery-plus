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
    void _taskId; void _result; void _state;
    return true;
  }

  public async getTaskMeta(_taskId: string): Promise<null> {
    void _taskId;
    return null;
  }
}
