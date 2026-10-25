// Публічний API домену «ринок» на бекенді.
//
// Зовнішні споживачі (Angular) імпортують лише звідси, через аліас @backend/market:
// типи метрик і налаштувань, межі ТЗ, протокол повідомлень воркера, частоти знімків.
// Модулі всередині домену (воркер, генератори) імпортують один одного напряму, не через цей файл.
//
// Сам воркер сюди не експортується: Angular збирає його окремим бандлом за шаблоном
// new Worker(new URL('…/worker/src/market.worker', import.meta.url)), тому шлях до нього
// вказується у фронтенді явно.

// ── Налаштування запуску ─────────────────────────────────────────────

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

// ── Частота знімків ──────────────────────────────────────────────────

export { REFRESH_DEFAULT_MS, REFRESH_OPTIONS_MS, REFRESH_UNLIMITED } from './contracts/refresh-rate';
