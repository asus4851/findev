// Дзеркало ../../../market-gen-ts/src/config/simulation-config.ts.
// Налаштування симулятора з ТЗ: їх вводить користувач на сторінці налаштувань.

// Три налаштування з ТЗ, значення за замовчуванням.
export class SimulationConfig {
    instrumentCount: i32 = 5;    // кількість інструментів
    updatesPerBatch: i32 = 100;  // угод у батчі, загалом на всі інструменти
    batchIntervalMs: i32 = 500;  // інтервал між батчами, мс
}

// Допустимі межі з ТЗ, включно.
// Відмінність від TypeScript: там межі зібрані в об'єкт SIMULATION_LIMITS,
// а AssemblyScript не має таких об'єктів-літералів, тому тут окремі константи.
export const INSTRUMENT_COUNT_MIN: i32 = 1;
export const INSTRUMENT_COUNT_MAX: i32 = 50;
export const UPDATES_PER_BATCH_MIN: i32 = 1;
export const UPDATES_PER_BATCH_MAX: i32 = 1000;
export const BATCH_INTERVAL_MS_MIN: i32 = 50;
export const BATCH_INTERVAL_MS_MAX: i32 = 2000;

// Біти результату перевірки: кожне некоректне поле вмикає свій біт.
export const INVALID_INSTRUMENT_COUNT: i32 = 1;
export const INVALID_UPDATES_PER_BATCH: i32 = 2;
export const INVALID_BATCH_INTERVAL_MS: i32 = 4;

// Перевіряє всі поля і повертає набір бітів некоректних полів. 0 означає, що все коректно.
//
// Відмінність від TypeScript: там повертається масив помилок з текстом.
// Передавати рядки й масиви об'єктів з Wasm у JavaScript складно, тому тут повертається число,
// а тексти помилок формує воркер. Перевірки на цілі числа немає: поля типу i32 завжди цілі.
export function validateSimulationConfig(config: SimulationConfig): i32 {
    let errors = 0;
    if (config.instrumentCount < INSTRUMENT_COUNT_MIN || config.instrumentCount > INSTRUMENT_COUNT_MAX) {
        errors |= INVALID_INSTRUMENT_COUNT;
    }
    if (config.updatesPerBatch < UPDATES_PER_BATCH_MIN || config.updatesPerBatch > UPDATES_PER_BATCH_MAX) {
        errors |= INVALID_UPDATES_PER_BATCH;
    }
    if (config.batchIntervalMs < BATCH_INTERVAL_MS_MIN || config.batchIntervalMs > BATCH_INTERVAL_MS_MAX) {
        errors |= INVALID_BATCH_INTERVAL_MS;
    }
    return errors;
}
