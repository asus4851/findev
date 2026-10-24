import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Quote } from './model/quote';
import { SimulationConfig } from './config/simulation-config';
import { startSimulation } from './scheduler';
import { RandomGenerator } from './utils/random-generator';

const makeQuotes = (count: number, random: RandomGenerator) =>
    Array.from({ length: count }, (_, index) => new Quote(index, random));

describe('startSimulation', () => {
    let random: RandomGenerator;
    beforeEach(() => {
        vi.useFakeTimers();
        random = new RandomGenerator(1);
    });
    afterEach(() => vi.useRealTimers());

    it('раз на batchIntervalMs видає батч з updatesPerBatch оновлень', () => {
        const config = new SimulationConfig(); // 100 оновлень кожні 500 мс
        const onBatch = vi.fn();
        const stop = startSimulation(makeQuotes(config.instrumentCount, random), config, random, onBatch);

        vi.advanceTimersByTime(499);
        expect(onBatch).not.toHaveBeenCalled();

        vi.advanceTimersByTime(1);
        expect(onBatch).toHaveBeenCalledTimes(1);
        expect(onBatch.mock.calls[0][0]).toHaveLength(100);

        // За секунду 2 батчі по 100: 200 оновлень на секунду загалом, як у прикладі з ТЗ.
        vi.advanceTimersByTime(1_000);
        expect(onBatch).toHaveBeenCalledTimes(3);

        stop();
    });

    it('після зупинки батчі більше не генеруються', () => {
        const config = new SimulationConfig();
        const onBatch = vi.fn();
        const stop = startSimulation(makeQuotes(config.instrumentCount, random), config, random, onBatch);

        vi.advanceTimersByTime(1_000);
        stop();
        vi.advanceTimersByTime(10_000);

        expect(onBatch).toHaveBeenCalledTimes(2);
    });

    it('з некоректними налаштуваннями не запускається і пояснює чому', () => {
        const config = Object.assign(new SimulationConfig(), { updatesPerBatch: 0 });
        const onBatch = vi.fn();

        expect(() => startSimulation(makeQuotes(5, random), config, random, onBatch)).toThrow(
            'Invalid simulation config: updatesPerBatch must be between 1 and 1000, got 0',
        );

        vi.advanceTimersByTime(10_000);
        expect(onBatch).not.toHaveBeenCalled();
    });
});
