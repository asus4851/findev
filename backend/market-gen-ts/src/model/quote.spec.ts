import { beforeEach, describe, expect, it } from 'vitest';
import {
    MAX_PRICE_CENTS,
    MIN_PRICE_CENTS,
    START_PRICE_MAX_CENTS,
    START_PRICE_MIN_CENTS,
    maxQty,
    minQty,
} from '../constants';
import { Order } from './order';
import { Quote } from './quote';
import { Side } from './side';
import { RandomGenerator } from '../utils/random-generator';

const buy = (quantity: number) => new Order(0, Side.Buy, quantity);
const sell = (quantity: number) => new Order(0, Side.Sell, quantity);

describe('Quote', () => {
    let random: RandomGenerator;
    beforeEach(() => {
        random = new RandomGenerator(1);
    });

    describe('початковий стан', () => {
        it('будує стакан навколо заданої ціни', () => {
            const quote = new Quote(3, random, 10_000);

            expect(quote.instrument).toBe(3);
            expect(quote.price).toBe(10_000);
            expect(quote.bid).toBeLessThan(quote.price);
            expect(quote.ask).toBeGreaterThan(quote.price);
            expect(quote.askQty).toBeGreaterThanOrEqual(minQty);
            expect(quote.askQty).toBeLessThanOrEqual(maxQty);
            expect(quote.bidQty).toBeGreaterThanOrEqual(minQty);
            expect(quote.bidQty).toBeLessThanOrEqual(maxQty);
        });

        it('без заданої ціни стартує з діапазону початкових цін', () => {
            const quote = new Quote(0, random);

            expect(quote.price).toBeGreaterThanOrEqual(START_PRICE_MIN_CENTS);
            expect(quote.price).toBeLessThanOrEqual(START_PRICE_MAX_CENTS);
        });
    });

    describe('applyOrder, коли рівня вистачає', () => {
        it('покупець бере з ask за ціною ask, ціни не змінюються', () => {
            const quote = new Quote(0, random, 10_000);
            quote.askQty = 500;
            const { bid, ask, bidQty } = quote;

            const price = quote.applyOrder(buy(30));

            expect(price).toBe(ask);
            expect(quote.askQty).toBe(470);
            expect(quote.bidQty).toBe(bidQty);
            expect([quote.bid, quote.ask]).toEqual([bid, ask]);
        });

        it('продавець віддає в bid за ціною bid, ціни не змінюються', () => {
            const quote = new Quote(0, random, 10_000);
            quote.bidQty = 600;
            const { bid, ask, askQty } = quote;

            const price = quote.applyOrder(sell(100));

            expect(price).toBe(bid);
            expect(quote.bidQty).toBe(500);
            expect(quote.askQty).toBe(askQty);
            expect([quote.bid, quote.ask]).toEqual([bid, ask]);
        });

        it('ордер рівно на всю кількість лишає рівень порожнім без зсуву ціни', () => {
            const quote = new Quote(0, random, 10_000);
            quote.askQty = 40;
            const { ask } = quote;

            expect(quote.applyOrder(buy(40))).toBe(ask);
            expect(quote.askQty).toBe(0);
        });
    });

    describe('applyOrder, коли рівня не вистачає', () => {
        it('покупець проходить рівень: ціна зсувається від старого ask вгору на 5..15 б.п.', () => {
            const quote = new Quote(0, random, 10_000);
            quote.askQty = 10;
            const oldAsk = quote.ask;

            const price = quote.applyOrder(buy(50));

            expect(quote.price).toBeGreaterThanOrEqual(oldAsk + 5);
            expect(quote.price).toBeLessThanOrEqual(oldAsk + 15);
            expect(quote.ask).toBeGreaterThan(oldAsk);
            expect(price).toBe(quote.ask);
            expect(quote.bid).toBeLessThan(quote.ask);
            expect(quote.askQty).toBeGreaterThanOrEqual(minQty);
            expect(quote.bidQty).toBeGreaterThanOrEqual(minQty);
        });

        it('продавець проходить рівень: ціна зсувається від старого bid вниз на 5..15 б.п.', () => {
            const quote = new Quote(0, random, 10_000);
            quote.bidQty = 10;
            const oldBid = quote.bid;

            const price = quote.applyOrder(sell(50));

            expect(quote.price).toBeLessThanOrEqual(oldBid - 5);
            expect(quote.price).toBeGreaterThanOrEqual(oldBid - 15);
            expect(quote.bid).toBeLessThan(oldBid);
            expect(price).toBe(quote.bid);
            expect(quote.bid).toBeLessThan(quote.ask);
        });
    });

    describe('межі ціни', () => {
        it('ціна і bid не опускаються нижче 1 цента навіть під постійними продажами', () => {
            const quote = new Quote(0, random, 2);

            for (let i = 0; i < 5_000; i++) {
                quote.applyOrder(sell(100));
                expect(quote.bid).toBeGreaterThanOrEqual(MIN_PRICE_CENTS);
                expect(quote.bid).toBeLessThan(quote.ask);
            }
            expect(quote.price).toBe(MIN_PRICE_CENTS);
        });

        it('ціна не піднімається вище MAX_PRICE_CENTS і вміщається в i32', () => {
            const quote = new Quote(0, random, MAX_PRICE_CENTS - 10);

            for (let i = 0; i < 5_000; i++) {
                quote.applyOrder(buy(100));
                expect(quote.price).toBeLessThanOrEqual(MAX_PRICE_CENTS);
                expect(quote.ask).toBeLessThan(2 ** 31);
            }
            expect(quote.price).toBe(MAX_PRICE_CENTS);
        });
    });
});
