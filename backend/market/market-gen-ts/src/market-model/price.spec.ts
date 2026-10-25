import { describe, expect, it } from 'vitest';
import { START_PRICE_MAX_CENTS, START_PRICE_MIN_CENTS } from '../constants';
import { RandomGenerator } from '../utils/random-generator';
import { getPriceDelta, getSpread, getStartPrice } from './price';

const repeat = <T>(times: number, fn: () => T): T[] => Array.from({ length: times }, fn);

describe('getPriceDelta', () => {
    it('buy сдвигает цену вверх на 0,05%..0,15% в целых центах', () => {
        // $100.00: 5..15 б.п. дают 5..15 центов.
        const random = new RandomGenerator(1);
        const prices = repeat(1_000, () => getPriceDelta(random, 10_000, 'buy'));

        expect(prices.every(Number.isInteger)).toBe(true);
        expect(Math.min(...prices)).toBe(10_005);
        expect(Math.max(...prices)).toBe(10_015);
    });

    it('sell сдвигает цену вниз на 0,05%..0,15%', () => {
        const random = new RandomGenerator(1);
        const prices = repeat(1_000, () => getPriceDelta(random, 10_000, 'sell'));

        expect(Math.min(...prices)).toBe(9_985);
        expect(Math.max(...prices)).toBe(9_995);
    });

    it('на дешёвом инструменте сдвиг минимум 1 цент', () => {
        // $1.00: 0,15% — это 0,15 цента, округление дало бы 0.
        const random = new RandomGenerator(1);

        expect(repeat(100, () => getPriceDelta(random, 100, 'buy'))).toEqual(repeat(100, () => 101));
        expect(repeat(100, () => getPriceDelta(random, 100, 'sell'))).toEqual(repeat(100, () => 99));
    });
});

describe('getSpread', () => {
    it('ask выше цены на 0,01%..0,05%, bid ниже', () => {
        const random = new RandomGenerator(1);
        const asks = repeat(1_000, () => getSpread(random, 10_000));
        const bids = repeat(1_000, () => getSpread(random, 10_000, false));

        expect(Math.min(...asks)).toBe(10_001);
        expect(Math.max(...asks)).toBe(10_005);
        expect(Math.min(...bids)).toBe(9_995);
        expect(Math.max(...bids)).toBe(9_999);
    });

    it('на дешёвом инструменте отступ минимум 1 цент', () => {
        const random = new RandomGenerator(1);

        expect(getSpread(random, 100)).toBe(101);
        expect(getSpread(random, 100, false)).toBe(99);
    });
});

describe('getStartPrice', () => {
    it('возвращает цену в диапазоне начальных цен', () => {
        const random = new RandomGenerator(1);
        const prices = repeat(1_000, () => getStartPrice(random));

        expect(prices.every((p) => p >= START_PRICE_MIN_CENTS && p <= START_PRICE_MAX_CENTS)).toBe(true);
    });
});
