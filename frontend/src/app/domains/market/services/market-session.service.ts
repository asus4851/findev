import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { REFRESH_DEFAULT_MS, type FromWorkerMessage, type ToWorkerMessage } from '@backend/market';
import { MARKET_WORKER_FACTORY, type MarketWorker } from '../tokens/market-worker.token';
import { copySettings, defaultSettings, type InstrumentMetrics, type SimulationSettings } from '../market.model';

// starting: запуск отправлен, данных ещё нет; error: запуск не удался.
export type SessionState = 'starting' | 'running' | 'paused' | 'error';

// Единственная на приложение связь с воркером и состояние активного запуска для обеих страниц.
// Живёт в корне, поэтому навигация между страницами не создаёт новых воркеров и не останавливает запуск.
@Injectable({ providedIn: 'root' })
export class MarketSession {
  private readonly createWorker = inject(MARKET_WORKER_FACTORY);
  private worker: MarketWorker | undefined;

  // Номер текущего запуска. Сообщения с другим номером относятся к старому запуску и отбрасываются.
  private runId = 0;

  private readonly rowsState = signal<InstrumentMetrics[]>([]);
  private readonly stateState = signal<SessionState>('starting');
  private readonly errorState = signal<string | undefined>(undefined);
  private readonly settingsState = signal<SimulationSettings>(defaultSettings());
  private readonly refreshMsState = signal(REFRESH_DEFAULT_MS);

  readonly rows = this.rowsState.asReadonly();
  readonly state = this.stateState.asReadonly();
  readonly error = this.errorState.asReadonly();
  // Настройки активного запуска. Форма редактирует собственную копию и не меняет их до Apply.
  readonly settings = this.settingsState.asReadonly();
  // Как часто воркер отправляет снимки таблицы. Настройка клиента: действует сразу, без нового запуска.
  readonly refreshMs = this.refreshMsState.asReadonly();

  constructor() {
    inject(DestroyRef).onDestroy(() => this.destroy());
  }

  // Первый запуск со значениями по умолчанию. Повторный вызов ничего не делает.
  start(): void {
    if (this.worker) return;
    this.apply(this.settingsState());
  }

  // Новый запуск с новыми настройками: значения и итоги предыдущего стираются,
  // генерация стартует даже после паузы.
  apply(settings: SimulationSettings): void {
    const worker = this.ensureWorker();
    if (!worker) return;

    this.runId++;
    this.settingsState.set(copySettings(settings));
    this.rowsState.set([]);
    this.errorState.set(undefined);
    this.stateState.set('starting');
    this.send({ type: 'start', runId: this.runId, settings: this.settingsState(), seed: randomSeed() });
  }

  pause(): void {
    if (this.stateState() === 'running') this.send({ type: 'pause', runId: this.runId });
  }

  resume(): void {
    if (this.stateState() === 'paused') this.send({ type: 'resume', runId: this.runId });
  }

  // Меняет частоту снимков. Генерацию и накопленные значения не затрагивает.
  setRefresh(refreshMs: number): void {
    if (refreshMs === this.refreshMsState()) return;
    this.refreshMsState.set(refreshMs);
    this.send({ type: 'setRefresh', refreshMs });
  }

  private handle(message: FromWorkerMessage): void {
    if (message.runId !== this.runId) return;

    switch (message.type) {
      case 'snapshot':
        this.rowsState.set(message.rows);
        break;
      case 'status':
        this.stateState.set(message.status);
        break;
      case 'error':
        this.fail(message.message);
        break;
    }
  }

  // Воркер создаётся при первом запуске и дальше используется повторно.
  private ensureWorker(): MarketWorker | undefined {
    if (this.worker) return this.worker;
    try {
      const worker = this.createWorker();
      worker.onmessage = (event) => this.handle(event.data as FromWorkerMessage);
      worker.onerror = (event) => this.fail(`Market worker failed: ${event.message || 'unknown error'}`);
      this.worker = worker;
      // Воркер стартует с частотой по умолчанию. Если её изменили раньше, сообщаем сразу.
      if (this.refreshMsState() !== REFRESH_DEFAULT_MS) {
        this.send({ type: 'setRefresh', refreshMs: this.refreshMsState() });
      }
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
    this.errorState.set(message);
    this.stateState.set('error');
  }

  // Освобождает воркер и память Wasm, когда приложение уничтожается.
  private destroy(): void {
    this.send({ type: 'dispose' });
    this.worker?.terminate();
    this.worker = undefined;
  }
}

function randomSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0];
}
