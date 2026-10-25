import { InjectionToken } from '@angular/core';

// Минимум от Web Worker, который нужен сервису. В тестах его заменяет подделка.
export interface MarketWorker {
  onmessage: ((event: MessageEvent) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  postMessage(message: unknown): void;
  terminate(): void;
}

export type MarketWorkerFactory = () => MarketWorker;

// Как создать воркер «бэкенда». Angular сам собирает файл воркера из backend/market/worker
// отдельным бандлом, потому что находит шаблон new Worker(new URL(...)).
export const MARKET_WORKER_FACTORY = new InjectionToken<MarketWorkerFactory>('MARKET_WORKER_FACTORY', {
  providedIn: 'root',
  factory: () => () =>
    new Worker(new URL('../../../../../../backend/market/worker/src/market.worker', import.meta.url), { type: 'module' }),
});
