// Тесты скомпилированного Wasm-модуля. Запуск: npm test (сначала собирает build/market_gen.wasm).
//
// Главная проверка здесь — паритет: с тем же seed и настройками Wasm должен выдавать
// ровно те же обновления, что и эталонная TypeScript-версия из ../market-gen-ts.
// Остальные тесты дублируют инварианты ТЗ уже для Wasm.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Quote } from '../../market-gen-ts/src/model/quote';
import { generateBatch } from '../../market-gen-ts/src/simulator';
import { RandomGenerator } from '../../market-gen-ts/src/utils/random-generator';

interface Update {
    instrument: number;
    priceCents: number;
    tradeQuantity: number;
    bidCents: number;
    askCents: number;
    bidQuantity: number;
    askQuantity: number;
}

interface WasmExports {
    memory: WebAssembly.Memory;
    FIELDS: WebAssembly.Global;
    INVALID_INSTRUMENT_COUNT: WebAssembly.Global;
    INVALID_UPDATES_PER_BATCH: WebAssembly.Global;
    INVALID_BATCH_INTERVAL_MS: WebAssembly.Global;
    validateConfig(instrumentCount: number, updatesPerBatch: number, batchIntervalMs: number): number;
    init(instrumentCount: number, updatesPerBatch: number, batchIntervalMs: number, seed: number): number;
    nextBatch(): number;
    dispose(): void;
}

const wasmModule = new WebAssembly.Module(readFileSync(new URL('../build/market_gen.wasm', import.meta.url)));

// Новый экземпляр модуля на каждый тест, чтобы тесты не делили состояние.
function load() {
    const x = new WebAssembly.Instance(wasmModule, {}).exports as unknown as WasmExports;
    const fields = x.FIELDS.value as number;

    // Читает батч из буфера Wasm и сразу копирует в объекты, как это делал бы воркер.
    function nextBatch(size: number): Update[] {
        const pointer = x.nextBatch();
        expect(pointer).not.toBe(0);
        const raw = new Int32Array(x.memory.buffer, pointer, size * fields);
        const updates: Update[] = [];
        for (let o = 0; o < raw.length; o += fields) {
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

    return { x, fields, nextBatch };
}

// Запуск TypeScript-версии с теми же параметрами, для сравнения.
function runTypeScript(seed: number, instruments: number, size: number, batches: number): Update[] {
    const random = new RandomGenerator(seed);
    const quotes = Array.from({ length: instruments }, (_, i) => new Quote(i, random));
    return Array.from({ length: batches }, () => generateBatch(quotes, size, random))
        .flat()
        .map((u) => ({ ...u }));
}

function runWasm(seed: number, instruments: number, size: number, batches: number): Update[] {
    const wasm = load();
    expect(wasm.x.init(instruments, size, 500, seed)).toBe(0);
    return Array.from({ length: batches }, () => wasm.nextBatch(size)).flat();
}

describe('Wasm-модуль', () => {
    it('не требует импортов и имеет семь полей на обновление', () => {
        expect(WebAssembly.Module.imports(wasmModule)).toEqual([]);
        expect(load().fields).toBe(7);
    });

    it('без init ничего не генерирует, после dispose тоже', () => {
        const { x } = load();
        expect(x.nextBatch()).toBe(0);

        x.init(5, 100, 500, 1);
        expect(x.nextBatch()).not.toBe(0);

        x.dispose();
        expect(x.nextBatch()).toBe(0);
    });
});

describe('паритет с TypeScript-версией', () => {
    it.each([
        { seed: 1, instruments: 5, size: 100, batches: 20 },
        { seed: 42, instruments: 50, size: 1000, batches: 10 },
        { seed: 2026, instruments: 1, size: 1, batches: 500 },
        { seed: 4_294_967_295, instruments: 7, size: 333, batches: 5 },
    ])('seed $seed, $instruments инструментов, батч $size: обновления идентичны', ({ seed, instruments, size, batches }) => {
        expect(runWasm(seed, instruments, size, batches)).toEqual(runTypeScript(seed, instruments, size, batches));
    });
});

describe('проверка настроек', () => {
    it('принимает границы из ТЗ и отклоняет значения за ними', () => {
        const { x } = load();
        const bit = {
            instruments: x.INVALID_INSTRUMENT_COUNT.value as number,
            batch: x.INVALID_UPDATES_PER_BATCH.value as number,
            interval: x.INVALID_BATCH_INTERVAL_MS.value as number,
        };

        expect(x.validateConfig(1, 1, 50)).toBe(0);
        expect(x.validateConfig(50, 1000, 2000)).toBe(0);
        expect(x.validateConfig(0, 100, 500)).toBe(bit.instruments);
        expect(x.validateConfig(51, 100, 500)).toBe(bit.instruments);
        expect(x.validateConfig(5, 0, 500)).toBe(bit.batch);
        expect(x.validateConfig(5, 1001, 500)).toBe(bit.batch);
        expect(x.validateConfig(5, 100, 49)).toBe(bit.interval);
        expect(x.validateConfig(5, 100, 2001)).toBe(bit.interval);
        expect(x.validateConfig(0, 0, 0)).toBe(bit.instruments | bit.batch | bit.interval);
    });

    it('init с некорректными настройками возвращает ошибки и не меняет текущий запуск', () => {
        const wasm = load();
        wasm.x.init(3, 10, 500, 7);
        const before = wasm.nextBatch(10);

        expect(wasm.x.init(0, 10, 500, 7)).toBe(wasm.x.INVALID_INSTRUMENT_COUNT.value);

        // Предыдущий запуск жив: генерирует дальше, будто неудачного init не было.
        const reference = load();
        reference.x.init(3, 10, 500, 7);
        reference.nextBatch(10);
        expect(before).toHaveLength(10);
        expect(wasm.nextBatch(10)).toEqual(reference.nextBatch(10));
    });
});

describe('инварианты ТЗ в Wasm', () => {
    it('батч ровно запрошенного размера, обновления корректны', () => {
        for (const size of [1, 7, 100, 1000]) {
            expect(runWasm(1, 5, size, 1)).toHaveLength(size);
        }

        const updates = runWasm(42, 20, 1000, 100);
        const broken = updates.filter((u) => !(
            u.priceCents > 0 && u.bidCents > 0 && u.bidCents < u.askCents
            && (u.priceCents === u.bidCents || u.priceCents === u.askCents)
            && u.tradeQuantity >= 1 && u.bidQuantity >= 0 && u.askQuantity >= 0
            && u.instrument >= 0 && u.instrument < 20
        ));
        expect(updates).toHaveLength(100_000);
        expect(broken).toEqual([]);
    });

    it('состояние сохраняется между батчами: два по 50 равны одному на 100', () => {
        expect(runWasm(3, 5, 50, 2)).toEqual(runWasm(3, 5, 100, 1));
    });

    it('новый init полностью сбрасывает предыдущий запуск', () => {
        const wasm = load();
        wasm.x.init(5, 100, 500, 9);
        wasm.nextBatch(100);
        wasm.x.init(5, 100, 500, 9);

        expect(wasm.nextBatch(100)).toEqual(runWasm(9, 5, 100, 1));
    });

    it('память не растёт бесконечно при длительной работе', () => {
        const wasm = load();
        wasm.x.init(50, 1000, 50, 1);
        for (let i = 0; i < 300; i++) wasm.x.nextBatch();
        const afterWarmUp = wasm.x.memory.buffer.byteLength;

        for (let i = 0; i < 2_000; i++) wasm.x.nextBatch();

        // 2 000 000 обновлений: сборщик мусора освобождает ордера и обновления, память не растёт.
        expect(wasm.x.memory.buffer.byteLength).toBe(afterWarmUp);
    });
});
