import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FromWorkerMessage, SimulationSettings, ToWorkerMessage } from '../../contracts/protocol';
import { MarketSimulation } from './market-simulation';
import type { WasmExports } from './wasm/wasm-exports';

// Підробний Wasm: кожен батч складається з угод першого інструмента, 10 штук по $100.
// Справжній генератор перевіряють тести в backend/market/market-gen-as.
const POINTER = 8;
const TRADE_QUANTITY = 10;

class FakeWasm implements WasmExports {
    readonly memory = new WebAssembly.Memory({ initial: 1 });
    readonly FIELDS = { value: 7 } as WebAssembly.Global;
    batches = 0;
    initCalls: number[][] = [];
    initResult = 0;
    disposed = false;
    private updatesPerBatch = 0;

    init(instrumentCount: number, updatesPerBatch: number, batchIntervalMs: number, seed: number): number {
        this.initCalls.push([instrumentCount, updatesPerBatch, batchIntervalMs, seed]);
        if (this.initResult === 0) this.updatesPerBatch = updatesPerBatch;
        return this.initResult;
    }

    nextBatch(): number {
        this.batches++;
        const view = new Int32Array(this.memory.buffer, POINTER);
        for (let k = 0; k < this.updatesPerBatch; k++) {
            view.set([0, 10_000, TRADE_QUANTITY, 9_990, 10_010, 100, 100], k * 7);
        }
        return POINTER;
    }

    dispose(): void {
        this.disposed = true;
    }
}

// Один батч на інструмент за 500 мс: так легко рахувати угоди.
const settings: SimulationSettings = { instrumentCount: 2, updatesPerBatch: 1, batchIntervalMs: 500 };
// 20 батчів за секунду: частіше, ніж за замовчуванням оновлюється таблиця.
const fast: SimulationSettings = { ...settings, batchIntervalMs: 50 };

describe('MarketSimulation', () => {
    let wasm: FakeWasm;
    let messages: FromWorkerMessage[];
    let worker: MarketSimulation;

    const send = (message: ToWorkerMessage) => worker.handle(message);
    const snapshots = (runId?: number) =>
        messages.filter((m): m is Extract<FromWorkerMessage, { type: 'snapshot' }> =>
            m.type === 'snapshot' && (runId === undefined || m.runId === runId));
    const lastVolume = () => snapshots().at(-1)!.rows[0].volume;
    const statuses = () => messages.flatMap((m) => (m.type === 'status' ? [m.status] : []));

    beforeEach(async () => {
        vi.useFakeTimers();
        wasm = new FakeWasm();
        messages = [];
        worker = new MarketSimulation((message) => messages.push(message));
        await worker.load(async () => wasm);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('запуск', () => {
        it('start ініціалізує Wasm, одразу надсилає порожній знімок і генерує батчі за інтервалом', () => {
            send({ type: 'start', runId: 1, settings, seed: 42 });

            expect(wasm.initCalls).toEqual([[2, 1, 500, 42]]);
            expect(snapshots()[0].rows).toEqual([
                { symbol: 'ALFA', lastPriceCents: undefined, spreadCents: undefined, volume: 0, vwapCents: undefined, imbalance: undefined },
                { symbol: 'BETA', lastPriceCents: undefined, spreadCents: undefined, volume: 0, vwapCents: undefined, imbalance: undefined },
            ]);
            expect(statuses()).toEqual(['running']);

            vi.advanceTimersByTime(1_500);

            expect(wasm.batches).toBe(3);
            expect(lastVolume()).toBe(3 * TRADE_QUANTITY);
        });

        it('seed передається у Wasm як беззнакове 32-бітне число', () => {
            send({ type: 'start', runId: 1, settings, seed: -1 });

            expect(wasm.initCalls[0][3]).toBe(0xffff_ffff);
        });

        it('новий start скидає значення, стартує навіть з паузи і використовує новий runId', () => {
            send({ type: 'start', runId: 1, settings, seed: 1 });
            vi.advanceTimersByTime(1_000);
            send({ type: 'pause', runId: 1 });

            send({ type: 'start', runId: 2, settings: { ...settings, instrumentCount: 3 }, seed: 2 });

            expect(snapshots(2)[0].rows).toHaveLength(3);
            expect(snapshots(2)[0].rows.every((row) => row.volume === 0)).toBe(true);
            expect(messages.at(-1)).toEqual({ type: 'status', runId: 2, status: 'running' });

            vi.advanceTimersByTime(500);
            expect(snapshots().at(-1)!.runId).toBe(2);
            expect(lastVolume()).toBe(TRADE_QUANTITY);
        });

        it('після нового start таймер попереднього запуску нічого не генерує і не надсилає', () => {
            send({ type: 'start', runId: 1, settings, seed: 1 });
            send({ type: 'start', runId: 2, settings: { ...settings, batchIntervalMs: 2_000 }, seed: 2 });
            messages = [];

            vi.advanceTimersByTime(2_000);

            expect(wasm.batches).toBe(1);
            expect(messages.every((m) => m.runId === 2)).toBe(true);
        });
    });

    describe('пауза і Resume', () => {
        it('пауза зупиняє генерацію і зберігає значення', () => {
            send({ type: 'start', runId: 1, settings, seed: 1 });
            vi.advanceTimersByTime(1_000);
            send({ type: 'pause', runId: 1 });

            vi.advanceTimersByTime(10_000);

            expect(wasm.batches).toBe(2);
            expect(lastVolume()).toBe(2 * TRADE_QUANTITY);
            expect(statuses()).toEqual(['running', 'paused']);
        });

        it('пауза одразу надсилає угоди, яких ще не було в знімку', () => {
            send({ type: 'start', runId: 1, settings: fast, seed: 1 });
            vi.advanceTimersByTime(300);              // 6 батчів, знімок пішов лише з першим
            expect(lastVolume()).toBe(TRADE_QUANTITY);

            send({ type: 'pause', runId: 1 });

            expect(lastVolume()).toBe(6 * TRADE_QUANTITY);
            expect(messages.at(-1)).toEqual({ type: 'status', runId: 1, status: 'paused' });
        });

        it('Resume продовжує з тих самих значень і не догенеровує час паузи', () => {
            send({ type: 'start', runId: 1, settings, seed: 1 });
            vi.advanceTimersByTime(1_000);              // 2 батчі
            send({ type: 'pause', runId: 1 });
            vi.advanceTimersByTime(60_000);             // хвилина паузи
            send({ type: 'resume', runId: 1 });
            vi.advanceTimersByTime(500);                // 1 батч

            expect(wasm.batches).toBe(3);
            expect(lastVolume()).toBe(3 * TRADE_QUANTITY);
            expect(statuses()).toEqual(['running', 'paused', 'running']);
        });

        it('повторні pause і resume нічого не змінюють', () => {
            send({ type: 'start', runId: 1, settings, seed: 1 });
            send({ type: 'resume', runId: 1 });
            send({ type: 'pause', runId: 1 });
            send({ type: 'pause', runId: 1 });

            expect(statuses()).toEqual(['running', 'paused']);
        });

        it('pause зі старим runId не зупиняє новий запуск', () => {
            send({ type: 'start', runId: 1, settings, seed: 1 });
            send({ type: 'start', runId: 2, settings, seed: 2 });
            messages = [];

            send({ type: 'pause', runId: 1 });
            vi.advanceTimersByTime(1_000);

            expect(wasm.batches).toBe(2);
            expect(statuses()).toEqual([]);
        });

        it('resume зі старим runId не знімає з паузи новий запуск', () => {
            send({ type: 'start', runId: 1, settings, seed: 1 });
            send({ type: 'start', runId: 2, settings, seed: 2 });
            send({ type: 'pause', runId: 2 });
            messages = [];

            send({ type: 'resume', runId: 1 });
            vi.advanceTimersByTime(1_000);

            expect(wasm.batches).toBe(0);
            expect(statuses()).toEqual([]);
        });
    });

    describe('помилки', () => {
        it('якщо Wasm відхилив налаштування, повідомляє, які саме поля, і не генерує', () => {
            wasm.initResult = 2 | 4;
            send({ type: 'start', runId: 1, settings, seed: 1 });
            vi.advanceTimersByTime(5_000);

            expect(messages).toEqual([{
                type: 'error',
                runId: 1,
                message: 'Market generator rejected the settings: updatesPerBatch, batchIntervalMs out of range',
            }]);
            expect(wasm.batches).toBe(0);
        });

        it('після відхиленого start resume не оживляє попередній запуск', () => {
            send({ type: 'start', runId: 1, settings, seed: 1 });
            send({ type: 'pause', runId: 1 });
            wasm.initResult = 1;
            send({ type: 'start', runId: 2, settings, seed: 2 });
            messages = [];

            send({ type: 'resume', runId: 2 });
            vi.advanceTimersByTime(5_000);

            expect(messages).toEqual([]);
            expect(wasm.batches).toBe(0);
        });

        it('dispose зупиняє генерацію і звільняє Wasm', () => {
            send({ type: 'start', runId: 1, settings, seed: 1 });
            send({ type: 'dispose' });
            vi.advanceTimersByTime(5_000);

            expect(wasm.batches).toBe(0);
            expect(wasm.disposed).toBe(true);
        });
    });

    describe('частота знімків', () => {
        it('за замовчуванням не частіше ніж раз на 0,5 с, але враховує кожну угоду', () => {
            send({ type: 'start', runId: 1, settings: fast, seed: 1 });
            vi.advanceTimersByTime(2_000);              // 40 батчів

            // Без урахування порожнього знімка на старті: по одному на кожне вікно 0,5 с.
            expect(snapshots().length - 1).toBeLessThanOrEqual(5);
            expect(snapshots().length - 1).toBeGreaterThanOrEqual(4);

            send({ type: 'pause', runId: 1 });
            expect(wasm.batches).toBe(40);
            expect(lastVolume()).toBe(40 * TRADE_QUANTITY);
        });

        it('наприкінці вікна надсилає найсвіжіші угоди, а не лише першу у вікні', () => {
            send({ type: 'start', runId: 1, settings: fast, seed: 1 });
            vi.advanceTimersByTime(560);                // перше вікно 0,5 с закрилось

            expect(lastVolume()).toBeGreaterThan(TRADE_QUANTITY);
        });

        it('без обмеження надсилає знімок після кожного батча', () => {
            send({ type: 'setRefresh', refreshMs: 0 });
            send({ type: 'start', runId: 1, settings: fast, seed: 1 });
            vi.advanceTimersByTime(500);

            expect(snapshots()).toHaveLength(1 + 10);
            expect(lastVolume()).toBe(10 * TRADE_QUANTITY);
        });

        it('нова частота діє без нового запуску і зберігається для наступного', () => {
            send({ type: 'start', runId: 1, settings: fast, seed: 1 });
            send({ type: 'setRefresh', refreshMs: 5_000 });
            vi.advanceTimersByTime(4_000);
            expect(snapshots(1)).toHaveLength(1 + 1);   // лише перший знімок вікна 5 с

            send({ type: 'start', runId: 2, settings: fast, seed: 2 });
            vi.advanceTimersByTime(4_000);
            expect(snapshots(2)).toHaveLength(1 + 1);
        });

        it('не надсилає знімок, якщо нових угод не було', () => {
            send({ type: 'start', runId: 1, settings: { ...settings, batchIntervalMs: 2_000 }, seed: 1 });
            vi.advanceTimersByTime(1_900);

            expect(snapshots()).toHaveLength(1);
        });

        it('ігнорує некоректну частоту', () => {
            send({ type: 'setRefresh', refreshMs: -5 });
            send({ type: 'setRefresh', refreshMs: 1.5 });
            send({ type: 'start', runId: 1, settings: fast, seed: 1 });
            vi.advanceTimersByTime(2_000);

            expect(snapshots().length - 1).toBeLessThanOrEqual(5);
        });
    });

    describe('завантаження Wasm', () => {
        it('команди до завершення завантаження не губляться і виконуються по порядку', async () => {
            let resolve!: (value: WasmExports) => void;
            const fresh = new MarketSimulation((message) => messages.push(message));
            const loading = fresh.load(() => new Promise((r) => { resolve = r; }));

            fresh.handle({ type: 'setRefresh', refreshMs: 0 });
            fresh.handle({ type: 'start', runId: 1, settings, seed: 1 });
            expect(messages).toEqual([]);

            resolve(wasm);
            await loading;

            expect(wasm.initCalls).toHaveLength(1);
            expect(statuses()).toEqual(['running']);
            vi.advanceTimersByTime(1_000);
            expect(snapshots()).toHaveLength(1 + 2);    // режим без обмеження застосовано до старту
        });

        it('помилка завантаження прив\'язується до запуску, що чекав, і повторюється для наступних', async () => {
            const failing = new MarketSimulation((message) => messages.push(message));
            const loading = failing.load(async () => { throw new Error('HTTP 404 while loading wasm/market_gen.wasm'); });
            failing.handle({ type: 'start', runId: 1, settings, seed: 1 });
            await loading;

            failing.handle({ type: 'pause', runId: 1 });
            failing.handle({ type: 'start', runId: 2, settings, seed: 1 });

            const message = 'Cannot initialize the market generator: HTTP 404 while loading wasm/market_gen.wasm';
            expect(messages).toEqual([
                { type: 'error', runId: 1, message },
                { type: 'error', runId: 2, message },
            ]);
        });
    });
});
