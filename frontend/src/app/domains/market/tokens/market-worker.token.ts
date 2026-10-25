import { InjectionToken } from '@angular/core';

// Мінімум від Web Worker, який потрібен сервісу. У тестах його замінює підробка.
export interface MarketWorker {
  onmessage: ((event: MessageEvent) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  postMessage(message: unknown): void;
  terminate(): void;
}

export type MarketWorkerFactory = () => MarketWorker;

// Як створити воркер "бекенду". Angular сам збирає файл воркера з backend/market/worker
// окремим бандлом, бо знаходить шаблон new Worker(new URL(...)).
export const MARKET_WORKER_FACTORY = new InjectionToken<MarketWorkerFactory>('MARKET_WORKER_FACTORY', {
  providedIn: 'root',
  factory: () => () =>
    new Worker(new URL('../../../../../../backend/market/worker/src/market.worker', import.meta.url), { type: 'module' }),
});
