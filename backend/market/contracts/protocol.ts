// Контракт между воркером («бэкендом») и Angular: какие сообщения ходят в обе стороны.
// Импортируют и воркер, и фронтенд, поэтому здесь только типы, без кода.
import type { SimulationConfig } from './simulation-config';

// Настройки в том виде, в каком они передаются в сообщении: обычный объект из трёх чисел.
export type SimulationSettings = Pick<SimulationConfig, 'instrumentCount' | 'updatesPerBatch' | 'batchIntervalMs'>;

// Пять метрик из ТЗ для одного инструмента.
// undefined означает «значение недоступно»: данных ещё нет или знаменатель формулы равен нулю.
export interface InstrumentMetrics {
    symbol: string;
    lastPriceCents: number | undefined;
    spreadCents: number | undefined;
    volume: number;                     // 0, пока не было ни одной сделки
    vwapCents: number | undefined;      // дробные центы, округляются только при отображении
    imbalance: number | undefined;      // от −1 до +1
}

export type ProducerStatus = 'running' | 'paused';

// Команды из Angular в воркер. runId идентифицирует запуск: каждый Apply получает новый.
export type ToWorkerMessage =
    | { type: 'start'; runId: number; settings: SimulationSettings; seed: number }
    | { type: 'pause'; runId: number }
    | { type: 'resume'; runId: number }
    // Частота снимков, мс, или REFRESH_UNLIMITED. Не привязана к запуску: действует и для следующих.
    | { type: 'setRefresh'; refreshMs: number }
    | { type: 'dispose' };

// Сообщения из воркера в Angular. Каждое несёт runId запуска, к которому относится,
// чтобы Angular мог отбросить результаты предыдущего запуска.
export type FromWorkerMessage =
    | { type: 'snapshot'; runId: number; rows: InstrumentMetrics[] }
    | { type: 'status'; runId: number; status: ProducerStatus }
    | { type: 'error'; runId: number; message: string };
