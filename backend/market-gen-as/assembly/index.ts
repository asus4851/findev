// Межа Wasm: функції, які викликає воркер на TypeScript.
//
// У TypeScript-версії цього файлу немає: там generateBatch повертає масив об'єктів напряму.
// З Wasm у JavaScript передавати масиви об'єктів складно і повільно, тому тут результат
// перекладається в один плоский буфер чисел i32, який воркер читає без копіювання об'єктів.
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

// Генератор повертає не список об'єктів, а один плоский масив чисел i32.
// Кожне оновлення займає в ньому рівно FIELDS сусідніх комірок:
//   [ idx, price, qty, bid, ask, bidQty, askQty,   idx, price, qty, ...  ]
//     └──────────── оновлення 0 ───────────────┘   └── оновлення 1 ──┘
//
// instrument     який інструмент (в буфері це індекс, символ ALFA/BETA формує TypeScript)
// priceCents     ціна цієї угоди, цілі центи (10200 означає $102.00)
// tradeQuantity  скільки одиниць куплено або продано в цій угоді
// bidCents       найкраща ціна купівлі після угоди, цілі центи
// askCents       найкраща ціна продажу після угоди, цілі центи
// bidQuantity    скільки одиниць чекає на купівлю по bid
// askQuantity    скільки одиниць чекає на продаж по ask

// Кількість чисел в одному оновленні. Воркер повинен використовувати те саме значення.
export const FIELDS: i32 = 7;

// Зміщення поля всередині одного оновлення: ціна оновлення k лежить у комірці k × FIELDS + F_PRICE_CENTS.
export const F_INSTRUMENT: i32 = 0;
export const F_PRICE_CENTS: i32 = 1;
export const F_TRADE_QUANTITY: i32 = 2;
export const F_BID_CENTS: i32 = 3;
export const F_ASK_CENTS: i32 = 4;
export const F_BID_QUANTITY: i32 = 5;
export const F_ASK_QUANTITY: i32 = 6;

// Буфер виділяється один раз на максимальний батч і перевикористовується.
const buffer = new StaticArray<i32>(UPDATES_PER_BATCH_MAX * FIELDS);

// ── Стан запуску ─────────────────────────────────────────────────────

let config: SimulationConfig | null = null;
let random = new RandomGenerator();
let quotes = new Array<Quote>(0);

// ── Функції для воркера ──────────────────────────────────────────────

// Перевіряє налаштування без запуску. Повертає біти некоректних полів, 0 означає коректно.
export function validateConfig(instrumentCount: i32, updatesPerBatch: i32, batchIntervalMs: i32): i32 {
    return validateSimulationConfig(createConfig(instrumentCount, updatesPerBatch, batchIntervalMs));
}

// Починає новий запуск: новий генератор випадкових чисел і нові квоти.
// Попередній стан повністю відкидається. З некоректними налаштуваннями нічого не змінює
// і повертає біти помилок, як validateConfig.
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

// Генерує батч з updatesPerBatch оновлень і повертає вказівник на початок буфера.
// Довжина в i32: updatesPerBatch × FIELDS. Повертає 0, якщо запуск не ініціалізовано.
// Вказівник дійсний до наступного виклику nextBatch: воркер має скопіювати дані одразу.
export function nextBatch(): usize {
    const current = config;
    if (current == null) return 0;

    const updates = generateBatch(quotes, current.updatesPerBatch, random);
    for (let k = 0; k < updates.length; k++) {
        writeUpdate(k * FIELDS, updates[k]);
    }
    return changetype<usize>(buffer);
}

// Завершує запуск і відпускає квоти. Пам'ять звільнить збирач сміття.
export function dispose(): void {
    config = null;
    quotes = new Array<Quote>(0);
}

// ── Допоміжне ────────────────────────────────────────────────────────

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
