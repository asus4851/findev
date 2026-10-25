// Публичный API домена «рынок» на бэкенде.
//
// Внешние потребители (Angular) импортируют только отсюда, через алиас @backend/market:
// типы метрик и настроек, границы ТЗ, протокол сообщений воркера, частоты снимков.
// Модули внутри домена (воркер, генераторы) импортируют друг друга напрямую, не через этот файл.
//
// Сам воркер сюда не экспортируется: Angular собирает его отдельным бандлом по шаблону
// new Worker(new URL('…/worker/src/market.worker', import.meta.url)), поэтому путь к нему
// указывается во фронтенде явно.

// ── Настройки запуска ────────────────────────────────────────────────

export { SIMULATION_LIMITS, SimulationConfig, validateSimulationConfig } from './contracts/simulation-config';
export type { SimulationConfigError, SimulationConfigField } from './contracts/simulation-config';

// ── Протокол воркера ─────────────────────────────────────────────────

export type {
    FromWorkerMessage,
    InstrumentMetrics,
    ProducerStatus,
    SimulationSettings,
    ToWorkerMessage,
} from './contracts/protocol';

// ── Частота снимков ──────────────────────────────────────────────────

export { REFRESH_DEFAULT_MS, REFRESH_OPTIONS_MS, REFRESH_UNLIMITED } from './contracts/refresh-rate';
