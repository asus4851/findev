// Граница Wasm: функции, которые вызывает воркер на TypeScript.
//
// В TypeScript-версии этого файла нет: там generateBatch возвращает массив объектов напрямую.
// Из Wasm в JavaScript передавать массивы объектов сложно и медленно, поэтому здесь результат
// переводится в один плоский буфер чисел i32, который воркер читает без копирования объектов.
import {
    SimulationConfig,
    UPDATES_PER_BATCH_MAX,
    validateSimulationConfig,
} from './config/simulation-config';
import { MarketUpdate } from './model/market-update';
import { Quote } from './model/quote';
import { generateBatch } from './simulator';
import { RandomGenerator } from './utils/random-generator';

export {
    INVALID_BATCH_INTERVAL_MS,
    INVALID_INSTRUMENT_COUNT,
    INVALID_UPDATES_PER_BATCH,
} from './config/simulation-config';

// ── Формат буфера ────────────────────────────────────────────────────

// Генератор возвращает не список объектов, а один плоский массив чисел i32.
// Каждое обновление занимает в нём ровно FIELDS соседних ячеек:
//   [ idx, price, qty, bid, ask, bidQty, askQty,   idx, price, qty, ...  ]
//     └──────────── обновление 0 ──────────────┘   └── обновление 1 ─┘
//
// instrument     какой инструмент (в буфере это индекс, символ ALFA/BETA формирует TypeScript)
// priceCents     цена этой сделки, целые центы (10200 означает $102.00)
// tradeQuantity  сколько единиц куплено или продано в этой сделке
// bidCents       лучшая цена покупки после сделки, целые центы
// askCents       лучшая цена продажи после сделки, целые центы
// bidQuantity    сколько единиц ждёт покупки по bid
// askQuantity    сколько единиц ждёт продажи по ask

// Количество чисел в одном обновлении. Воркер должен использовать то же значение.
export const FIELDS: i32 = 7;

// Смещение поля внутри одного обновления: цена обновления k лежит в ячейке k × FIELDS + F_PRICE_CENTS.
export const F_INSTRUMENT: i32 = 0;
export const F_PRICE_CENTS: i32 = 1;
export const F_TRADE_QUANTITY: i32 = 2;
export const F_BID_CENTS: i32 = 3;
export const F_ASK_CENTS: i32 = 4;
export const F_BID_QUANTITY: i32 = 5;
export const F_ASK_QUANTITY: i32 = 6;

// Буфер выделяется один раз на максимальный батч и переиспользуется.
const buffer = new StaticArray<i32>(UPDATES_PER_BATCH_MAX * FIELDS);

// ── Состояние запуска ────────────────────────────────────────────────

let config: SimulationConfig | null = null;
let random = new RandomGenerator();
let quotes = new Array<Quote>(0);

// ── Функции для воркера ──────────────────────────────────────────────

// Проверяет настройки без запуска. Возвращает биты некорректных полей, 0 означает корректно.
export function validateConfig(instrumentCount: i32, updatesPerBatch: i32, batchIntervalMs: i32): i32 {
    return validateSimulationConfig(createConfig(instrumentCount, updatesPerBatch, batchIntervalMs));
}

// Начинает новый запуск: новый генератор случайных чисел и новые котировки.
// Предыдущее состояние полностью отбрасывается. С некорректными настройками ничего не меняет
// и возвращает биты ошибок, как validateConfig.
export function init(instrumentCount: i32, updatesPerBatch: i32, batchIntervalMs: i32, seed: u32): i32 {
    const next = createConfig(instrumentCount, updatesPerBatch, batchIntervalMs);
    const errors = validateSimulationConfig(next);
    if (errors != 0) return errors;

    config = next;
    random = new RandomGenerator(seed);
    quotes = new Array<Quote>(0);
    for (let i = 0; i < instrumentCount; i++) {
        quotes.push(new Quote(i, random));
    }
    return 0;
}

// Генерирует батч из updatesPerBatch обновлений и возвращает указатель на начало буфера.
// Длина в i32: updatesPerBatch × FIELDS. Возвращает 0, если запуск не инициализирован.
// Указатель действителен до следующего вызова nextBatch: воркер должен прочитать данные сразу.
export function nextBatch(): usize {
    const current = config;
    if (current == null) return 0;

    const updates = generateBatch(quotes, current.updatesPerBatch, random);
    for (let k = 0; k < updates.length; k++) {
        writeUpdate(k * FIELDS, updates[k]);
    }
    return changetype<usize>(buffer);
}

// Завершает запуск и отпускает котировки. Память освободит сборщик мусора.
export function dispose(): void {
    config = null;
    quotes = new Array<Quote>(0);
}

// ── Вспомогательное ──────────────────────────────────────────────────

function createConfig(instrumentCount: i32, updatesPerBatch: i32, batchIntervalMs: i32): SimulationConfig {
    const result = new SimulationConfig();
    result.instrumentCount = instrumentCount;
    result.updatesPerBatch = updatesPerBatch;
    result.batchIntervalMs = batchIntervalMs;
    return result;
}

function writeUpdate(offset: i32, update: MarketUpdate): void {
    unchecked((buffer[offset + F_INSTRUMENT] = update.instrument));
    unchecked((buffer[offset + F_PRICE_CENTS] = update.priceCents));
    unchecked((buffer[offset + F_TRADE_QUANTITY] = update.tradeQuantity));
    unchecked((buffer[offset + F_BID_CENTS] = update.bidCents));
    unchecked((buffer[offset + F_ASK_CENTS] = update.askCents));
    unchecked((buffer[offset + F_BID_QUANTITY] = update.bidQuantity));
    unchecked((buffer[offset + F_ASK_QUANTITY] = update.askQuantity));
}
