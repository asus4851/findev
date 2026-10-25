// Граница с Wasm: какие функции экспортирует ../../../market-gen-as/assembly/index.ts и как их загрузить.

export interface WasmExports {
    memory: WebAssembly.Memory;
    FIELDS: WebAssembly.Global;
    // Новый запуск. Возвращает 0 или биты некорректных настроек (см. init-errors.ts).
    init(instrumentCount: number, updatesPerBatch: number, batchIntervalMs: number, seed: number): number;
    // Указатель на буфер батча или 0. Буфер действителен до следующего вызова.
    nextBatch(): number;
    dispose(): void;
}

// Загружает и компилирует Wasm-модуль по адресу. Бросает понятную ошибку, если файл недоступен.
export async function fetchWasm(url: URL): Promise<WasmExports> {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`HTTP ${response.status} while loading ${String(url)}`);
    }
    const { instance } = await WebAssembly.instantiate(await response.arrayBuffer(), {});
    return instance.exports as unknown as WasmExports;
}
