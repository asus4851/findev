// Адаптер к Wasm-генератору из ../../market-gen-as.
// Загружает .wasm, вызывает его функции и превращает плоский буфер чисел в обновления.
// Похожий адаптер используется в воркере приложения.
import wasmUrl from '../../market-gen-as/build/market_gen.wasm?url';
import type { MarketUpdate } from '../src/model/market-update';

// Функции, которые экспортирует assembly/index.ts.
interface WasmExports {
    memory: WebAssembly.Memory;
    FIELDS: WebAssembly.Global;
    init(instrumentCount: number, updatesPerBatch: number, batchIntervalMs: number, seed: number): number;
    nextBatch(): number;
    dispose(): void;
}

export class WasmGenerator {
    private readonly fields: number;
    private updatesPerBatch = 0;

    private constructor(private readonly wasm: WasmExports) {
        this.fields = wasm.FIELDS.value as number;
    }

    // Загружает и компилирует модуль. Бросает понятную ошибку, если файл недоступен
    // или браузер не может его выполнить: ТЗ требует содержательных ошибок инициализации.
    static async load(): Promise<WasmGenerator> {
        const response = await fetch(wasmUrl);
        if (!response.ok) {
            throw new Error(`Cannot load Wasm generator: HTTP ${response.status} for ${wasmUrl}`);
        }
        const { instance } = await WebAssembly.instantiateStreaming(response, {});
        return new WasmGenerator(instance.exports as unknown as WasmExports);
    }

    // Новый запуск: Wasm сбрасывает всё предыдущее состояние.
    // Возвращает биты некорректных полей, 0 означает успех.
    init(instrumentCount: number, updatesPerBatch: number, batchIntervalMs: number, seed: number): number {
        const errors = this.wasm.init(instrumentCount, updatesPerBatch, batchIntervalMs, seed >>> 0);
        if (errors === 0) this.updatesPerBatch = updatesPerBatch;
        return errors;
    }

    // Генерирует батч в Wasm и сразу копирует его из буфера в объекты:
    // буфер перезапишется следующим вызовом.
    nextBatch(): MarketUpdate[] {
        const pointer = this.wasm.nextBatch();
        if (pointer === 0) return [];

        const raw = new Int32Array(this.wasm.memory.buffer, pointer, this.updatesPerBatch * this.fields);
        const updates: MarketUpdate[] = [];
        for (let o = 0; o < raw.length; o += this.fields) {
            updates.push({
                instrument: raw[o],
                priceCents: raw[o + 1],
                tradeQuantity: raw[o + 2],
                bidCents: raw[o + 3],
                askCents: raw[o + 4],
                bidQuantity: raw[o + 5],
                askQuantity: raw[o + 6],
            });
        }
        return updates;
    }

    dispose(): void {
        this.wasm.dispose();
        this.updatesPerBatch = 0;
    }
}
