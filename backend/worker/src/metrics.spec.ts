import { describe, expect, it } from 'vitest';
import { FIELDS, MetricsAggregator, applyTrade, createAccumulator, toMetrics, type TradeUpdate } from './metrics';

// Угода з прикладу ТЗ: bid $101.96, ask $102.00, на купівлю 600, на продаж 400.
const trade = (priceCents: number, tradeQuantity: number, book: Partial<TradeUpdate> = {}): TradeUpdate => ({
    priceCents,
    tradeQuantity,
    bidCents: 10_196,
    askCents: 10_200,
    bidQuantity: 600,
    askQuantity: 400,
    ...book,
});

// Буфер у форматі Wasm: [instrument, price, qty, bid, ask, bidQty, askQty].
const buffer = (...rows: number[][]) => Int32Array.from(rows.flat());

describe('метрики інструмента', () => {
    it('рахує приклад з ТЗ: 10 по $100 і 30 по $102', () => {
        const accumulator = createAccumulator();
        applyTrade(accumulator, trade(10_000, 10));
        applyTrade(accumulator, trade(10_200, 30));

        expect(toMetrics('ALFA', accumulator)).toEqual({
            symbol: 'ALFA',
            lastPriceCents: 10_200,   // $102
            spreadCents: 4,           // $0.04
            volume: 40,
            vwapCents: 10_150,        // $101.50
            imbalance: 0.2,
        });
    });

    it('до першої угоди всі значення недоступні, а обсяг нульовий', () => {
        expect(toMetrics('ALFA', createAccumulator())).toEqual({
            symbol: 'ALFA',
            lastPriceCents: undefined,
            spreadCents: undefined,
            volume: 0,
            vwapCents: undefined,
            imbalance: undefined,
        });
    });

    it('дисбаланс недоступний, коли в стакані нуль на обох боках', () => {
        const accumulator = createAccumulator();
        applyTrade(accumulator, trade(10_000, 5, { bidQuantity: 0, askQuantity: 0 }));

        expect(toMetrics('ALFA', accumulator).imbalance).toBeUndefined();
    });

    it('дисбаланс −1 і +1, коли один бік порожній', () => {
        const onlyAsks = createAccumulator();
        applyTrade(onlyAsks, trade(10_000, 5, { bidQuantity: 0, askQuantity: 300 }));
        const onlyBids = createAccumulator();
        applyTrade(onlyBids, trade(10_000, 5, { bidQuantity: 300, askQuantity: 0 }));

        expect(toMetrics('A', onlyAsks).imbalance).toBe(-1);
        expect(toMetrics('B', onlyBids).imbalance).toBe(1);
    });

    it('кількості в стакані не входять в обсяг, рахується лише кількість угод', () => {
        const accumulator = createAccumulator();
        applyTrade(accumulator, trade(10_000, 7, { bidQuantity: 999, askQuantity: 999 }));

        expect(toMetrics('ALFA', accumulator).volume).toBe(7);
    });

    it('VWAP не округлюється до показу', () => {
        const accumulator = createAccumulator();
        applyTrade(accumulator, trade(10_000, 1));
        applyTrade(accumulator, trade(10_001, 2));

        expect(toMetrics('ALFA', accumulator).vwapCents).toBeCloseTo(30_002 / 3, 10);
    });
});

describe('MetricsAggregator', () => {
    it('інструменти не впливають один на одного', () => {
        const aggregator = new MetricsAggregator(['ALFA', 'BETA', 'GAMA']);
        aggregator.applyBuffer(buffer(
            [0, 10_000, 10, 10_196, 10_200, 600, 400],
            [1, 5_000, 3, 4_990, 5_010, 100, 300],
            [0, 10_200, 30, 10_196, 10_200, 600, 400],
        ));

        const [alfa, beta, gama] = aggregator.snapshot();
        expect(alfa).toMatchObject({ lastPriceCents: 10_200, volume: 40, vwapCents: 10_150, imbalance: 0.2 });
        expect(beta).toMatchObject({ lastPriceCents: 5_000, volume: 3, vwapCents: 5_000, spreadCents: 20, imbalance: -0.5 });
        expect(gama).toMatchObject({ lastPriceCents: undefined, volume: 0, vwapCents: undefined });
    });

    it('кожна угода рахується рівно один раз, у тому числі між батчами', () => {
        const aggregator = new MetricsAggregator(['ALFA']);
        aggregator.applyBuffer(buffer([0, 10_000, 10, 10_196, 10_200, 600, 400]));
        aggregator.snapshot();
        aggregator.snapshot(); // знімки нічого не додають
        aggregator.applyBuffer(buffer([0, 10_200, 30, 10_196, 10_200, 600, 400]));

        expect(aggregator.snapshot()[0]).toMatchObject({ volume: 40, vwapCents: 10_150 });
    });

    it('формат буфера: сім чисел на оновлення', () => {
        expect(FIELDS).toBe(7);
    });
});
