import { describe, expect, it } from 'vitest';
import { FIELDS, MetricsAggregator } from './metrics';

// Угода в форматі буфера Wasm. За замовчуванням стакан з прикладу ТЗ:
// bid $101.96, ask $102.00, на купівлю 600, на продаж 400.
const trade = (
    instrument: number,
    priceCents: number,
    tradeQuantity: number,
    book: { bid?: number; ask?: number; bidQty?: number; askQty?: number } = {},
): number[] => [
    instrument, priceCents, tradeQuantity,
    book.bid ?? 10_196, book.ask ?? 10_200, book.bidQty ?? 600, book.askQty ?? 400,
];

// Агрегатор з одного інструмента, якому віддали угоди одним буфером.
function single(...rows: number[][]) {
    const aggregator = new MetricsAggregator(['ALFA']);
    aggregator.applyBuffer(Int32Array.from(rows.flat()));
    return aggregator.snapshot()[0];
}

describe('метрики інструмента', () => {
    it('рахує приклад з ТЗ: 10 по $100 і 30 по $102', () => {
        expect(single(trade(0, 10_000, 10), trade(0, 10_200, 30))).toEqual({
            symbol: 'ALFA',
            lastPriceCents: 10_200,   // $102
            spreadCents: 4,           // $0.04
            volume: 40,
            vwapCents: 10_150,        // $101.50
            imbalance: 0.2,
        });
    });

    it('до першої угоди всі значення недоступні, а обсяг нульовий', () => {
        expect(single()).toEqual({
            symbol: 'ALFA',
            lastPriceCents: undefined,
            spreadCents: undefined,
            volume: 0,
            vwapCents: undefined,
            imbalance: undefined,
        });
    });

    it('дисбаланс недоступний, коли в стакані нуль на обох боках', () => {
        expect(single(trade(0, 10_000, 5, { bidQty: 0, askQty: 0 })).imbalance).toBeUndefined();
    });

    it('дисбаланс −1 і +1, коли один бік порожній', () => {
        expect(single(trade(0, 10_000, 5, { bidQty: 0, askQty: 300 })).imbalance).toBe(-1);
        expect(single(trade(0, 10_000, 5, { bidQty: 300, askQty: 0 })).imbalance).toBe(1);
    });

    it('кількості в стакані не входять в обсяг, рахується лише кількість угод', () => {
        expect(single(trade(0, 10_000, 7, { bidQty: 999, askQty: 999 })).volume).toBe(7);
    });

    it('VWAP не округлюється до показу', () => {
        expect(single(trade(0, 10_000, 1), trade(0, 10_001, 2)).vwapCents).toBeCloseTo(30_002 / 3, 10);
    });
});

describe('MetricsAggregator', () => {
    it('інструменти не впливають один на одного', () => {
        const aggregator = new MetricsAggregator(['ALFA', 'BETA', 'GAMA']);
        aggregator.applyBuffer(Int32Array.from([
            ...trade(0, 10_000, 10),
            ...trade(1, 5_000, 3, { bid: 4_990, ask: 5_010, bidQty: 100, askQty: 300 }),
            ...trade(0, 10_200, 30),
        ]));

        const [alfa, beta, gama] = aggregator.snapshot();
        expect(alfa).toMatchObject({ lastPriceCents: 10_200, volume: 40, vwapCents: 10_150, imbalance: 0.2 });
        expect(beta).toMatchObject({ lastPriceCents: 5_000, volume: 3, vwapCents: 5_000, spreadCents: 20, imbalance: -0.5 });
        expect(gama).toMatchObject({ lastPriceCents: undefined, volume: 0, vwapCents: undefined });
    });

    it('кожна угода рахується рівно один раз, у тому числі між батчами', () => {
        const aggregator = new MetricsAggregator(['ALFA']);
        aggregator.applyBuffer(Int32Array.from(trade(0, 10_000, 10)));
        aggregator.snapshot();
        aggregator.snapshot(); // знімки нічого не додають
        aggregator.applyBuffer(Int32Array.from(trade(0, 10_200, 30)));

        expect(aggregator.snapshot()[0]).toMatchObject({ volume: 40, vwapCents: 10_150 });
    });

    it('формат буфера: сім чисел на оновлення', () => {
        expect(FIELDS).toBe(7);
    });
});
