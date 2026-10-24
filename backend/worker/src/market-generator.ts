// Генератор, з яким працює воркер. Справжня реалізація це Wasm,
// а в тестах його замінює підробка з передбачуваними даними.
import type { SimulationSettings } from '../../contracts/protocol';

export interface MarketGenerator {
    // Починає новий запуск. Повертає 0 або біти некоректних налаштувань.
    init(settings: SimulationSettings, seed: number): number;
    // Генерує батч. Повертає плоский буфер: по FIELDS чисел на оновлення.
    // Буфер дійсний лише до наступного виклику.
    nextBatch(): Int32Array;
    dispose(): void;
}

// Функції, які експортує backend/market-gen-as/assembly/index.ts.
interface WasmExports {
    memory: WebAssembly.Memory;
    FIELDS: WebAssembly.Global;
    init(instrumentCount: number, updatesPerBatch: number, batchIntervalMs: number, seed: number): number;
    nextBatch(): number;
    dispose(): void;
}

export class WasmMarketGenerator implements MarketGenerator {
    private readonly fields: number;
    private updatesPerBatch = 0;

    private constructor(private readonly wasm: WasmExports) {
        this.fields = wasm.FIELDS.value as number;
    }

    // Завантажує і компілює модуль. Кидає зрозумілу помилку, якщо файл недоступний.
    static async load(url: URL | string): Promise<WasmMarketGenerator> {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status} while loading ${String(url)}`);
        }
        const { instance } = await WebAssembly.instantiate(await response.arrayBuffer(), {});
        return new WasmMarketGenerator(instance.exports as unknown as WasmExports);
    }

    init(settings: SimulationSettings, seed: number): number {
        const errors = this.wasm.init(settings.instrumentCount, settings.updatesPerBatch, settings.batchIntervalMs, seed >>> 0);
        if (errors === 0) this.updatesPerBatch = settings.updatesPerBatch;
        return errors;
    }

    nextBatch(): Int32Array {
        const pointer = this.wasm.nextBatch();
        if (pointer === 0) return new Int32Array(0);
        return new Int32Array(this.wasm.memory.buffer, pointer, this.updatesPerBatch * this.fields);
    }

    dispose(): void {
        this.wasm.dispose();
        this.updatesPerBatch = 0;
    }
}
