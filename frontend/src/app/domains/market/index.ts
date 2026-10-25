// Публичный API домена «рынок» во фронтенде.
//
// Код вне домена (app.config, app.routes, тестовые помощники) импортирует только отсюда.
// Файлы внутри домена импортируют друг друга напрямую, не через этот файл.
// Страницы сюда не экспортируются: их подключают маршруты, чтобы они оставались ленивыми.

export { MARKET_ROUTES } from './market.routes';
export { MarketSession, type SessionState } from './services/market-session.service';
export { MARKET_WORKER_FACTORY, type MarketWorker, type MarketWorkerFactory } from './tokens/market-worker.token';
export type { InstrumentMetrics, SimulationSettings } from './market.model';
