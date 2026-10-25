// Зеркало ../../../market-gen-ts/src/config/simulation-config.ts.
// Настройки симулятора из ТЗ: их вводит пользователь на странице настроек.

// Три настройки из ТЗ, значения по умолчанию.
export class SimulationConfig {
    instrumentCount: i32 = 5;    // количество инструментов
    updatesPerBatch: i32 = 100;  // сделок в батче, всего на все инструменты
    batchIntervalMs: i32 = 500;  // интервал между батчами, мс
}

// Допустимые границы из ТЗ, включительно.
// Отличие от TypeScript: там границы собраны в объект SIMULATION_LIMITS,
// а в AssemblyScript нет таких объектов-литералов, поэтому здесь отдельные константы.
const INSTRUMENT_COUNT_MIN: i32 = 1;
const INSTRUMENT_COUNT_MAX: i32 = 50;
const UPDATES_PER_BATCH_MIN: i32 = 1;
export const UPDATES_PER_BATCH_MAX: i32 = 1000;
const BATCH_INTERVAL_MS_MIN: i32 = 50;
const BATCH_INTERVAL_MS_MAX: i32 = 2000;

// Биты результата проверки: каждое некорректное поле включает свой бит.
export const INVALID_INSTRUMENT_COUNT: i32 = 1;
export const INVALID_UPDATES_PER_BATCH: i32 = 2;
export const INVALID_BATCH_INTERVAL_MS: i32 = 4;

// Проверяет все поля и возвращает набор битов некорректных полей. 0 означает, что всё корректно.
//
// Отличие от TypeScript: там возвращается массив ошибок с текстом.
// Передавать строки и массивы объектов из Wasm в JavaScript сложно, поэтому здесь возвращается число,
// а тексты ошибок формирует воркер. Проверки на целые числа нет: поля типа i32 всегда целые.
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
