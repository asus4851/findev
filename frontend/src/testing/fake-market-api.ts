import type { FromWorkerMessage, SimulationSettings } from '@backend/market';
import { Subject } from 'rxjs';

// Поддельный клиент бэкенда для тестов MarketSessionService: запоминает вызовы и позволяет тесту
// отправлять ответы «бэкенда» через messages$.
export class FakeMarketApi {
  private readonly subject = new Subject<FromWorkerMessage>();
  readonly messages$ = this.subject.asObservable();

  readonly starts: { runId: number; settings: SimulationSettings; seed: number }[] = [];
  readonly pauses: number[] = [];
  readonly resumes: number[] = [];
  readonly refreshes: number[] = [];

  start(runId: number, settings: SimulationSettings, seed: number): void {
    this.starts.push({ runId, settings, seed });
  }

  pause(runId: number): void {
    this.pauses.push(runId);
  }

  resume(runId: number): void {
    this.resumes.push(runId);
  }

  setRefresh(refreshMs: number): void {
    this.refreshes.push(refreshMs);
  }

  dispose(): void {
    this.subject.complete();
  }

  emit(message: FromWorkerMessage): void {
    this.subject.next(message);
  }
}
