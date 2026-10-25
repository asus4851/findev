import { describe, expect, it } from 'vitest';
import { InstrumentStats } from './instrument-stats';

// Стакан из примера ТЗ: bid $101.96, ask $102.00, 600 на покупку, 400 на продажу.
function applyTrade(stats: InstrumentStats, priceCents: number, tradeQuantity: number, bidQuantity = 600, askQuantity = 400): void {
    stats.applyTrade(priceCents, tradeQuantity, 10_196, 10_200, bidQuantity, askQuantity);
}

describe('InstrumentStats', () => {
    it('считает пример из ТЗ: 10 по $100 и 30 по $102', () => {
        const stats = new InstrumentStats('ALFA');
        applyTrade(stats, 10_000, 10);
        applyTrade(stats, 10_200, 30);

        expect(stats.toMetrics()).toEqual({
            symbol: 'ALFA',
            lastPriceCents: 10_200,   // $102
            spreadCents: 4,           // $0.04
            volume: 40,
            vwapCents: 10_150,        // $101.50
            imbalance: 0.2,
        });
    });

    it('до первой сделки все значения недоступны, а объём нулевой', () => {
        expect(new InstrumentStats('ALFA').toMetrics()).toEqual({
            symbol: 'ALFA',
            lastPriceCents: undefined,
            spreadCents: undefined,
            volume: 0,
            vwapCents: undefined,
            imbalance: undefined,
        });
    });

    it('стакан берёт из последней сделки, а суммы накапливает из всех', () => {
        const stats = new InstrumentStats('ALFA');
        stats.applyTrade(10_000, 10, 9_990, 10_010, 100, 300);
        stats.applyTrade(10_020, 5, 10_015, 10_025, 500, 500);

        expect(stats.toMetrics()).toMatchObject({
            lastPriceCents: 10_020,
            spreadCents: 10,
            volume: 15,
            imbalance: 0,
        });
        expect(stats.notionalCents).toBe(10_000 * 10 + 10_020 * 5);
    });

    it('дисбаланс недоступен, когда в стакане ноль на обеих сторонах', () => {
        const stats = new InstrumentStats('ALFA');
        applyTrade(stats, 10_000, 5, 0, 0);

        expect(stats.toMetrics().imbalance).toBeUndefined();
    });

    it('дисбаланс −1 и +1, когда одна сторона пустая', () => {
        const onlyAsks = new InstrumentStats('A');
        applyTrade(onlyAsks, 10_000, 5, 0, 300);
        const onlyBids = new InstrumentStats('B');
        applyTrade(onlyBids, 10_000, 5, 300, 0);

        expect(onlyAsks.toMetrics().imbalance).toBe(-1);
        expect(onlyBids.toMetrics().imbalance).toBe(1);
    });

    it('количества в стакане не входят в объём, считается только количество сделок', () => {
        const stats = new InstrumentStats('ALFA');
        applyTrade(stats, 10_000, 7, 999, 999);

        expect(stats.toMetrics().volume).toBe(7);
    });

    it('VWAP не округляется до отображения', () => {
        const stats = new InstrumentStats('ALFA');
        applyTrade(stats, 10_000, 1);
        applyTrade(stats, 10_001, 2);

        expect(stats.toMetrics().vwapCents).toBeCloseTo(30_002 / 3, 10);
    });
});
