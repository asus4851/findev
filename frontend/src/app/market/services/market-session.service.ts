import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import type { FromWorkerMessage, ToWorkerMessage } from '@contracts/protocol';
import { REFRESH_DEFAULT_MS } from '@contracts/refresh-rate';
import { MARKET_WORKER_FACTORY, type MarketWorker } from './market-worker';
import { copySettings, defaultSettings, type InstrumentMetrics, type SimulationSettings } from '../market-types';

// starting: запуск відправлено, даних ще немає; error: запуск не вдався.
export type SessionState = 'starting' | 'running' | 'paused' | 'error';

// Єдиний на застосунок зв'язок з воркером і стан активного запуску для обох сторінок.
// Живе в корені, тому навігація між сторінками не створює нових воркерів і не зупиняє запуск.
@Injectable({ providedIn: 'root' })
export class MarketSession {
  private readonly createWorker = inject(MARKET_WORKER_FACTORY);
  private worker: MarketWorker | undefined;

  // Номер поточного запуску. Повідомлення з іншим номером належать старому запуску і відкидаються.
  private runId = 0;

  private readonly rowsState = signal<InstrumentMetrics[]>([]);
  private readonly stateState = signal<SessionState>('starting');
  private readonly errorState = signal<string | undefined>(undefined);
  private readonly settingsState = signal<SimulationSettings>(defaultSettings());
  private readonly refreshMsState = signal(REFRESH_DEFAULT_MS);

  readonly rows = this.rowsState.asReadonly();
  readonly state = this.stateState.asReadonly();
  readonly error = this.errorState.asReadonly();
  // Налаштування активного запуску. Форма редагує власну копію і не змінює їх до Apply.
  readonly settings = this.settingsState.asReadonly();
  // Як часто воркер надсилає знімки таблиці. Налаштування клієнта: діє одразу, без нового запуску.
  readonly refreshMs = this.refreshMsState.asReadonly();

  constructor() {
    inject(DestroyRef).onDestroy(() => this.destroy());
  }

  // Перший запуск зі значеннями за замовчуванням. Повторний виклик нічого не робить.
  start(): void {
    if (this.worker) return;
    this.apply(this.settingsState());
  }

  // Новий запуск з новими налаштуваннями: значення й підсумки попереднього стираються,
  // генерація стартує навіть після паузи.
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

  // Змінює частоту знімків. Генерацію і накопичені значення не зачіпає.
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

  // Воркер створюється при першому запуску і далі використовується повторно.
  private ensureWorker(): MarketWorker | undefined {
    if (this.worker) return this.worker;
    try {
      const worker = this.createWorker();
      worker.onmessage = (event) => this.handle(event.data as FromWorkerMessage);
      worker.onerror = (event) => this.fail(`Market worker failed: ${event.message || 'unknown error'}`);
      this.worker = worker;
      // Воркер стартує з частотою за замовчуванням. Якщо її змінили раніше, повідомляємо одразу.
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

  // Звільняє воркер і пам'ять Wasm, коли застосунок знищується.
  private destroy(): void {
    this.send({ type: 'dispose' });
    this.worker?.terminate();
    this.worker = undefined;
  }
}

function randomSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0];
}
