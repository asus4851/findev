import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FromWorkerMessage, SimulationSettings } from '../../contracts/protocol';
import type { MarketGenerator } from './market-generator';
import { SimulationRuntime } from './simulation-runtime';

// Підробний генератор: кожен батч це одна угода першого інструмента, 10 штук по $100.
class FakeGenerator implements MarketGenerator {
    batches = 0;
    initCalls: { settings: SimulationSettings; seed: number }[] = [];
    disposed = false;
    initResult = 0;

    init(settings: SimulationSettings, seed: number): number {
        this.initCalls.push({ settings, seed });
        return this.initResult;
    }

    nextBatch(): Int32Array {
        this.batches++;
        return Int32Array.from([0, 10_000, 10, 9_990, 10_010, 100, 100]);
    }

    dispose(): void {
        this.disposed = true;
    }
}

const settings: SimulationSettings = { instrumentCount: 2, updatesPerBatch: 1, batchIntervalMs: 500 };

describe('SimulationRuntime', () => {
    let generator: FakeGenerator;
    let messages: FromWorkerMessage[];
    let runtime: SimulationRuntime;

    const snapshots = (runId?: number) =>
        messages.filter((m): m is Extract<FromWorkerMessage, { type: 'snapshot' }> =>
            m.type === 'snapshot' && (runId === undefined || m.runId === runId));
    const lastVolume = () => snapshots().at(-1)!.rows[0].volume;
    const statuses = () => messages.filter((m) => m.type === 'status').map((m) => m.type === 'status' && m.status);

    beforeEach(() => {
        vi.useFakeTimers();
        generator = new FakeGenerator();
        messages = [];
        runtime = new SimulationRuntime(generator, (m) => messages.push(m));
    });
    afterEach(() => vi.useRealTimers());

    it('start одразу надсилає знімок без даних і стартує генерацію за інтервалом', () => {
        runtime.handle({ type: 'start', runId: 1, settings, seed: 42 });

        expect(generator.initCalls).toEqual([{ settings, seed: 42 }]);
        expect(snapshots()[0].rows).toEqual([
            { symbol: 'ALFA', lastPriceCents: undefined, spreadCents: undefined, volume: 0, vwapCents: undefined, imbalance: undefined },
            { symbol: 'BETA', lastPriceCents: undefined, spreadCents: undefined, volume: 0, vwapCents: undefined, imbalance: undefined },
        ]);
        expect(statuses()).toEqual(['running']);

        vi.advanceTimersByTime(1_500);
        expect(generator.batches).toBe(3);
        expect(lastVolume()).toBe(30);
    });

    it('пауза зупиняє генерацію і зберігає значення', () => {
        runtime.handle({ type: 'start', runId: 1, settings, seed: 1 });
        vi.advanceTimersByTime(1_000);
        runtime.handle({ type: 'pause', runId: 1 });

        vi.advanceTimersByTime(10_000);

        expect(generator.batches).toBe(2);
        expect(lastVolume()).toBe(20);
        expect(statuses()).toEqual(['running', 'paused']);
    });

    it('відновлення продовжує з тих самих значень і не догенеровує час паузи', () => {
        runtime.handle({ type: 'start', runId: 1, settings, seed: 1 });
        vi.advanceTimersByTime(1_000);              // 2 батчі
        runtime.handle({ type: 'pause', runId: 1 });
        vi.advanceTimersByTime(60_000);             // хвилина паузи
        runtime.handle({ type: 'resume', runId: 1 });
        vi.advanceTimersByTime(500);                // 1 батч

        expect(generator.batches).toBe(3);
        expect(lastVolume()).toBe(30);
        expect(statuses()).toEqual(['running', 'paused', 'running']);
    });

    it('новий start скидає значення, стартує навіть з паузи і використовує новий runId', () => {
        runtime.handle({ type: 'start', runId: 1, settings, seed: 1 });
        vi.advanceTimersByTime(1_000);
        runtime.handle({ type: 'pause', runId: 1 });

        runtime.handle({ type: 'start', runId: 2, settings: { ...settings, instrumentCount: 3 }, seed: 2 });

        expect(snapshots(2)[0].rows).toHaveLength(3);
        expect(snapshots(2)[0].rows.every((row) => row.volume === 0)).toBe(true);
        vi.advanceTimersByTime(500);
        expect(snapshots().at(-1)).toMatchObject({ runId: 2 });
        expect(lastVolume()).toBe(10);
    });

    it('після нового start таймер старого запуску більше нічого не надсилає', () => {
        runtime.handle({ type: 'start', runId: 1, settings, seed: 1 });
        runtime.handle({ type: 'start', runId: 2, settings: { ...settings, batchIntervalMs: 2_000 }, seed: 2 });
        messages = [];

        vi.advanceTimersByTime(2_000);

        expect(messages.every((m) => m.runId === 2)).toBe(true);
        expect(generator.batches).toBe(1);
    });

    it('команди зі старим runId ігноруються', () => {
        runtime.handle({ type: 'start', runId: 1, settings, seed: 1 });
        runtime.handle({ type: 'start', runId: 2, settings, seed: 2 });

        runtime.handle({ type: 'pause', runId: 1 });
        vi.advanceTimersByTime(1_000);

        expect(generator.batches).toBe(2);
        expect(statuses()).not.toContain('paused');
    });

    it('некоректні налаштування дають зрозумілу помилку і не запускають генерацію', () => {
        runtime.handle({ type: 'start', runId: 5, settings: { ...settings, updatesPerBatch: 0 }, seed: 1 });
        vi.advanceTimersByTime(5_000);

        expect(messages).toEqual([{
            type: 'error',
            runId: 5,
            message: 'updatesPerBatch must be between 1 and 1000, got 0',
        }]);
        expect(generator.initCalls).toEqual([]);
        expect(generator.batches).toBe(0);
    });

    it('якщо генератор відхилив налаштування, повідомляє про помилку', () => {
        generator.initResult = 2;
        runtime.handle({ type: 'start', runId: 1, settings, seed: 1 });

        expect(messages).toEqual([{ type: 'error', runId: 1, message: 'Market generator rejected the settings (error bits 2)' }]);
    });

    it('dispose зупиняє генерацію і звільняє генератор', () => {
        runtime.handle({ type: 'start', runId: 1, settings, seed: 1 });
        runtime.handle({ type: 'dispose' });
        vi.advanceTimersByTime(5_000);

        expect(generator.batches).toBe(0);
        expect(generator.disposed).toBe(true);
    });
});
