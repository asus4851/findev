// Зеркало битов из ../../../market-gen-as/assembly/config/simulation-config.ts.
// Wasm возвращает из init не тексты, а набор битов некорректных полей. Тексты формирует воркер.
export const INVALID_INSTRUMENT_COUNT = 1;
export const INVALID_UPDATES_PER_BATCH = 2;
export const INVALID_BATCH_INTERVAL_MS = 4;

// Текст ошибки из битов, которые вернул init в Wasm.
export function describeInitErrors(errors: number): string {
    const fields: string[] = [];
    if (errors & INVALID_INSTRUMENT_COUNT) fields.push('instrumentCount');
    if (errors & INVALID_UPDATES_PER_BATCH) fields.push('updatesPerBatch');
    if (errors & INVALID_BATCH_INTERVAL_MS) fields.push('batchIntervalMs');
    return `Market generator rejected the settings: ${fields.join(', ')} out of range`;
}
