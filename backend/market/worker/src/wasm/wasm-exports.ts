// Межа з Wasm: які функції експортує ../../../market-gen-as/assembly/index.ts і як їх завантажити.

export interface WasmExports {
    memory: WebAssembly.Memory;
    FIELDS: WebAssembly.Global;
    // Новий запуск. Повертає 0 або біти некоректних налаштувань (див. init-errors.ts).
    init(instrumentCount: number, updatesPerBatch: number, batchIntervalMs: number, seed: number): number;
    // Вказівник на буфер батча або 0. Буфер дійсний до наступного виклику.
    nextBatch(): number;
    dispose(): void;
}

// Завантажує і компілює Wasm-модуль за адресою. Кидає зрозумілу помилку, якщо файл недоступний.
export async function fetchWasm(url: URL): Promise<WasmExports> {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`HTTP ${response.status} while loading ${String(url)}`);
    }
    const { instance } = await WebAssembly.instantiate(await response.arrayBuffer(), {});
    return instance.exports as unknown as WasmExports;
}
