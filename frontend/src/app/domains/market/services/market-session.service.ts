import { Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { REFRESH_DEFAULT_MS, type FromWorkerMessage } from '@backend/market';
import { copySettings, defaultSettings, type InstrumentMetrics, type SimulationSettings } from '../market.model';
import { MarketApiService } from './market-api.service';

// starting: запуск отправлен, данных ещё нет; error: запуск не удался.
export type SessionState = 'starting' | 'running' | 'paused' | 'error';

// Состояние активного запуска для обеих страниц. С бэкендом разговаривает через MarketApiService.
// Живёт в корне, поэтому навигация между страницами не создаёт новых воркеров и не останавливает запуск.
@Injectable({ providedIn: 'root' })
export class MarketSessionService {
  private readonly api = inject(MarketApiService);
  private started = false;

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
  // Как часто бэкенд отправляет снимки таблицы. Настройка клиента: действует сразу, без нового запуска.
  readonly refreshMs = this.refreshMsState.asReadonly();

  constructor() {
    this.api.messages$.pipe(takeUntilDestroyed()).subscribe((message) => this.handle(message));
  }

  // Первый запуск со значениями по умолчанию. Повторный вызов ничего не делает.
  start(): void {
    if (this.started) return;
    this.started = true;
    this.apply(this.settingsState());
  }

  // Новый запуск с новыми настройками: значения и итоги предыдущего стираются,
  // генерация стартует даже после паузы.
  apply(settings: SimulationSettings): void {
    this.runId++;
    this.settingsState.set(copySettings(settings));
    this.rowsState.set([]);
    this.errorState.set(undefined);
    this.stateState.set('starting');
    this.api.start(this.runId, this.settingsState(), randomSeed());
  }

  pause(): void {
    if (this.stateState() === 'running') this.api.pause(this.runId);
  }

  resume(): void {
    if (this.stateState() === 'paused') this.api.resume(this.runId);
  }

  // Меняет частоту снимков. Генерацию и накопленные значения не затрагивает.
  setRefresh(refreshMs: number): void {
    if (refreshMs === this.refreshMsState()) return;
    this.refreshMsState.set(refreshMs);
    this.api.setRefresh(refreshMs);
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
        this.errorState.set(message.message);
        this.stateState.set('error');
        break;
    }
  }
}

function randomSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0];
}
