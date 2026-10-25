import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FromWorkerMessage, SimulationSettings, ToWorkerMessage } from '../../contracts/protocol';
import { MarketSimulation } from './market-simulation';
import type { WasmExports } from './wasm/wasm-exports';

// Поддельный Wasm: каждый батч состоит из сделок первого инструмента, 10 штук по $100.
// Настоящий генератор проверяют тесты в backend/market/market-gen-as.
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

// Один батч на инструмент за 500 мс: так легко считать сделки.
const settings: SimulationSettings = { instrumentCount: 2, updatesPerBatch: 1, batchIntervalMs: 500 };
// 20 батчей в секунду: чаще, чем по умолчанию обновляется таблица.
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
        it('start инициализирует Wasm, сразу отправляет пустой снимок и генерирует батчи по интервалу', () => {
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

        it('seed передаётся в Wasm как беззнаковое 32-битное число', () => {
            send({ type: 'start', runId: 1, settings, seed: -1 });

            expect(wasm.initCalls[0][3]).toBe(0xffff_ffff);
        });

        it('новый start сбрасывает значения, стартует даже с паузы и использует новый runId', () => {
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

        it('после нового start таймер предыдущего запуска ничего не генерирует и не отправляет', () => {
            send({ type: 'start', runId: 1, settings, seed: 1 });
            send({ type: 'start', runId: 2, settings: { ...settings, batchIntervalMs: 2_000 }, seed: 2 });
            messages = [];

            vi.advanceTimersByTime(2_000);

            expect(wasm.batches).toBe(1);
            expect(messages.every((m) => m.runId === 2)).toBe(true);
        });
    });

    describe('пауза и Resume', () => {
        it('пауза останавливает генерацию и сохраняет значения', () => {
            send({ type: 'start', runId: 1, settings, seed: 1 });
            vi.advanceTimersByTime(1_000);
            send({ type: 'pause', runId: 1 });

            vi.advanceTimersByTime(10_000);

            expect(wasm.batches).toBe(2);
            expect(lastVolume()).toBe(2 * TRADE_QUANTITY);
            expect(statuses()).toEqual(['running', 'paused']);
        });

        it('пауза сразу отправляет сделки, которых ещё не было в снимке', () => {
            send({ type: 'start', runId: 1, settings: fast, seed: 1 });
            vi.advanceTimersByTime(300);              // 6 батчей, снимок ушёл только с первым
            expect(lastVolume()).toBe(TRADE_QUANTITY);

            send({ type: 'pause', runId: 1 });

            expect(lastVolume()).toBe(6 * TRADE_QUANTITY);
            expect(messages.at(-1)).toEqual({ type: 'status', runId: 1, status: 'paused' });
        });

        it('Resume продолжает с тех же значений и не догенерирует время паузы', () => {
            send({ type: 'start', runId: 1, settings, seed: 1 });
            vi.advanceTimersByTime(1_000);              // 2 батча
            send({ type: 'pause', runId: 1 });
            vi.advanceTimersByTime(60_000);             // минута паузы
            send({ type: 'resume', runId: 1 });
            vi.advanceTimersByTime(500);                // 1 батч

            expect(wasm.batches).toBe(3);
            expect(lastVolume()).toBe(3 * TRADE_QUANTITY);
            expect(statuses()).toEqual(['running', 'paused', 'running']);
        });

        it('повторные pause и resume ничего не меняют', () => {
            send({ type: 'start', runId: 1, settings, seed: 1 });
            send({ type: 'resume', runId: 1 });
            send({ type: 'pause', runId: 1 });
            send({ type: 'pause', runId: 1 });

            expect(statuses()).toEqual(['running', 'paused']);
        });

        it('pause со старым runId не останавливает новый запуск', () => {
            send({ type: 'start', runId: 1, settings, seed: 1 });
            send({ type: 'start', runId: 2, settings, seed: 2 });
            messages = [];

            send({ type: 'pause', runId: 1 });
            vi.advanceTimersByTime(1_000);

            expect(wasm.batches).toBe(2);
            expect(statuses()).toEqual([]);
        });

        it('resume со старым runId не снимает с паузы новый запуск', () => {
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

    describe('ошибки', () => {
        it('если Wasm отклонил настройки, сообщает, какие именно поля, и не генерирует', () => {
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

        it('после отклонённого start resume не оживляет предыдущий запуск', () => {
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

        it('dispose останавливает генерацию и освобождает Wasm', () => {
            send({ type: 'start', runId: 1, settings, seed: 1 });
            send({ type: 'dispose' });
            vi.advanceTimersByTime(5_000);

            expect(wasm.batches).toBe(0);
            expect(wasm.disposed).toBe(true);
        });
    });

    describe('частота снимков', () => {
        it('по умолчанию не чаще раза в 0,5 с, но учитывает каждую сделку', () => {
            send({ type: 'start', runId: 1, settings: fast, seed: 1 });
            vi.advanceTimersByTime(2_000);              // 40 батчей

            // Без учёта пустого снимка на старте: по одному на каждое окно 0,5 с.
            expect(snapshots().length - 1).toBeLessThanOrEqual(5);
            expect(snapshots().length - 1).toBeGreaterThanOrEqual(4);

            send({ type: 'pause', runId: 1 });
            expect(wasm.batches).toBe(40);
            expect(lastVolume()).toBe(40 * TRADE_QUANTITY);
        });

        it('в конце окна отправляет самые свежие сделки, а не только первую в окне', () => {
            send({ type: 'start', runId: 1, settings: fast, seed: 1 });
            vi.advanceTimersByTime(560);                // первое окно 0,5 с закрылось

            expect(lastVolume()).toBeGreaterThan(TRADE_QUANTITY);
        });

        it('без ограничения отправляет снимок после каждого батча', () => {
            send({ type: 'setRefresh', refreshMs: 0 });
            send({ type: 'start', runId: 1, settings: fast, seed: 1 });
            vi.advanceTimersByTime(500);

            expect(snapshots()).toHaveLength(1 + 10);
            expect(lastVolume()).toBe(10 * TRADE_QUANTITY);
        });

        it('новая частота действует без нового запуска и сохраняется для следующего', () => {
            send({ type: 'start', runId: 1, settings: fast, seed: 1 });
            send({ type: 'setRefresh', refreshMs: 5_000 });
            vi.advanceTimersByTime(4_000);
            expect(snapshots(1)).toHaveLength(1 + 1);   // только первый снимок окна 5 с

            send({ type: 'start', runId: 2, settings: fast, seed: 2 });
            vi.advanceTimersByTime(4_000);
            expect(snapshots(2)).toHaveLength(1 + 1);
        });

        it('не отправляет снимок, если новых сделок не было', () => {
            send({ type: 'start', runId: 1, settings: { ...settings, batchIntervalMs: 2_000 }, seed: 1 });
            vi.advanceTimersByTime(1_900);

            expect(snapshots()).toHaveLength(1);
        });

        it('игнорирует некорректную частоту', () => {
            send({ type: 'setRefresh', refreshMs: -5 });
            send({ type: 'setRefresh', refreshMs: 1.5 });
            send({ type: 'start', runId: 1, settings: fast, seed: 1 });
            vi.advanceTimersByTime(2_000);

            expect(snapshots().length - 1).toBeLessThanOrEqual(5);
        });
    });

    describe('загрузка Wasm', () => {
        it('команды до окончания загрузки не теряются и выполняются по порядку', async () => {
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
            expect(snapshots()).toHaveLength(1 + 2);    // режим без ограничения применён до старта
        });

        it('ошибка загрузки привязывается к ждавшему запуску и повторяется для следующих', async () => {
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
