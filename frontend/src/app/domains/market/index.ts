// Публічний API домену «ринок» у фронтенді.
//
// Код поза доменом (app.config, app.routes, тестові помічники) імпортує лише звідси.
// Файли всередині домену імпортують один одного напряму, не через цей файл.
// Сторінки сюди не експортуються: їх підключають маршрути, щоб вони лишались лінивими.

export { MARKET_ROUTES } from './market.routes';
export { MarketSession, type SessionState } from './services/market-session.service';
export { MARKET_WORKER_FACTORY, type MarketWorker, type MarketWorkerFactory } from './tokens/market-worker.token';
export type { InstrumentMetrics, SimulationSettings } from './market.model';
