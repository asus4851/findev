// Контракт між воркером ("бекендом") і Angular: які повідомлення ходять в обидва боки.
// Імпортують і воркер, і фронтенд, тому тут лише типи, без коду.
import type { SimulationConfig } from './simulation-config';

// Налаштування, як вони передаються в повідомленні: звичайний об'єкт з трьома числами.
export type SimulationSettings = Pick<SimulationConfig, 'instrumentCount' | 'updatesPerBatch' | 'batchIntervalMs'>;

// П'ять метрик з ТЗ для одного інструмента.
// undefined означає «значення недоступне»: даних ще немає або знаменник формули дорівнює нулю.
export interface InstrumentMetrics {
    symbol: string;
    lastPriceCents: number | undefined;
    spreadCents: number | undefined;
    volume: number;                     // 0, поки не було жодної угоди
    vwapCents: number | undefined;      // дробові центи, округлюються лише при показі
    imbalance: number | undefined;      // від −1 до +1
}

export type ProducerStatus = 'running' | 'paused';

// Команди з Angular у воркер. runId ідентифікує запуск: кожен Apply отримує новий.
export type ToWorkerMessage =
    | { type: 'start'; runId: number; settings: SimulationSettings; seed: number }
    | { type: 'pause'; runId: number }
    | { type: 'resume'; runId: number }
    // Частота знімків, мс, або REFRESH_UNLIMITED. Не прив'язана до запуску: діє і для наступних.
    | { type: 'setRefresh'; refreshMs: number }
    | { type: 'dispose' };

// Повідомлення з воркера в Angular. Кожне несе runId запуску, до якого належить,
// щоб Angular міг відкинути результати попереднього запуску.
export type FromWorkerMessage =
    | { type: 'snapshot'; runId: number; rows: InstrumentMetrics[] }
    | { type: 'status'; runId: number; status: ProducerStatus }
    | { type: 'error'; runId: number; message: string };
