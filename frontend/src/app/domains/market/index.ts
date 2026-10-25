// Публичный API домена «рынок» во фронтенде.
//
// Код вне домена (app.config, app.routes, тестовые помощники) импортирует только отсюда.
// Файлы внутри домена импортируют друг друга напрямую, не через этот файл.
// Страницы сюда не экспортируются: их подключают маршруты, чтобы они оставались ленивыми.

export { MARKET_ROUTES } from './market.routes';
export { MarketSessionService } from './services/market-session.service';
// Тип воркера нужен тестовому помощнику вне домена (testing/fake-market-worker).
export type { MarketWorker } from './tokens/market-worker.token';
