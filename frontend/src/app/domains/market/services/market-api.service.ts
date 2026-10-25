import { DestroyRef, Injectable, inject } from '@angular/core';
import type { FromWorkerMessage, SimulationSettings, ToWorkerMessage } from '@backend/market';
import { Observable, Subject } from 'rxjs';
import { MARKET_WORKER_FACTORY, type MarketWorker } from '../tokens/market-worker.token';

// Клиент бэкенда «рынок»: единственное место, которое знает, что бэкенд — это Web Worker.
// Создаёт воркер, отправляет ему команды через postMessage и отдаёт ответы потоком сообщений.
// Роль сети здесь играет postMessage; что именно значат ответы, решает MarketSessionService.
@Injectable({ providedIn: 'root' })
export class MarketApiService {
  private readonly createWorker = inject(MARKET_WORKER_FACTORY);
  private worker: MarketWorker | undefined;

  // Последний запуск: к нему привязываются ошибки самого воркера, у которых нет своего runId.
  private runId = 0;
  // Частота снимков, выбранная до создания воркера: отправляется сразу после создания.
  private refreshMs: number | undefined;

  private readonly messagesSubject = new Subject<FromWorkerMessage>();
  // Ответы бэкенда: снимки, статусы и ошибки (в том числе ошибки создания воркера).
  readonly messages$: Observable<FromWorkerMessage> = this.messagesSubject.asObservable();

  constructor() {
    inject(DestroyRef).onDestroy(() => this.dispose());
  }

  // Новый запуск: воркер создаётся при первом вызове и дальше используется повторно.
  start(runId: number, settings: SimulationSettings, seed: number): void {
    this.runId = runId;
    if (!this.ensureWorker()) return;
    this.send({ type: 'start', runId, settings, seed });
  }

  pause(runId: number): void {
    this.send({ type: 'pause', runId });
  }

  resume(runId: number): void {
    this.send({ type: 'resume', runId });
  }

  // Частота снимков не привязана к запуску: действует и для следующих.
  setRefresh(refreshMs: number): void {
    this.refreshMs = refreshMs;
    this.send({ type: 'setRefresh', refreshMs });
  }

  // Освобождает воркер и память Wasm, когда приложение уничтожается.
  dispose(): void {
    this.send({ type: 'dispose' });
    this.worker?.terminate();
    this.worker = undefined;
    this.messagesSubject.complete();
  }

  private ensureWorker(): MarketWorker | undefined {
    if (this.worker) return this.worker;
    try {
      const worker = this.createWorker();
      worker.onmessage = (event) => this.messagesSubject.next(event.data as FromWorkerMessage);
      worker.onerror = (event) => this.fail(`Market worker failed: ${event.message || 'unknown error'}`);
      this.worker = worker;
      if (this.refreshMs !== undefined) this.send({ type: 'setRefresh', refreshMs: this.refreshMs });
      return worker;
    } catch (error) {
      this.fail(`Cannot start the market worker: ${error instanceof Error ? error.message : String(error)}`);
      return undefined;
    }
  }

  private send(message: ToWorkerMessage): void {
    this.worker?.postMessage(message);
  }

  private fail(message: string): void {
    this.messagesSubject.next({ type: 'error', runId: this.runId, message });
  }
}
