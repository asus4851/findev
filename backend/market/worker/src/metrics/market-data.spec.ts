import { describe, expect, it } from 'vitest';
import { FIELDS } from '../wasm/buffer-format';
import { MarketData } from './market-data';

// Буфер в формате Wasm: [instrument, price, qty, bid, ask, bidQty, askQty].
const buffer = (...rows: number[][]) => Int32Array.from(rows.flat());

// Сделка первого инструмента со стаканом из примера ТЗ: bid $101.96, ask $102.00, 600 на покупку, 400 на продажу.
const trade = (priceCents: number, tradeQuantity: number, bidQuantity = 600, askQuantity = 400) =>
    [0, priceCents, tradeQuantity, 10_196, 10_200, bidQuantity, askQuantity];

describe('MarketData', () => {
    it('считает пример из ТЗ: 10 по $100 и 30 по $102', () => {
        const data = new MarketData(1);
        data.applyBatch(buffer(trade(10_000, 10), trade(10_200, 30)));

        expect(data.snapshot()).toEqual([{
            symbol: 'ALFA',
            lastPriceCents: 10_200,   // $102
            spreadCents: 4,           // $0.04
            volume: 40,
            vwapCents: 10_150,        // $101.50
            imbalance: 0.2,
        }]);
    });

    it('до первой сделки все значения недоступны, а объём нулевой', () => {
        expect(new MarketData(1).snapshot()).toEqual([{
            symbol: 'ALFA',
            lastPriceCents: undefined,
            spreadCents: undefined,
            volume: 0,
            vwapCents: undefined,
            imbalance: undefined,
        }]);
    });

    it('инструменты не влияют друг на друга', () => {
        const data = new MarketData(3);
        data.applyBatch(buffer(
            [0, 10_000, 10, 10_196, 10_200, 600, 400],
            [1, 5_000, 3, 4_990, 5_010, 100, 300],
            [0, 10_200, 30, 10_196, 10_200, 600, 400],
        ));

        const [alfa, beta, gama] = data.snapshot();
        expect(alfa).toMatchObject({ symbol: 'ALFA', lastPriceCents: 10_200, volume: 40, vwapCents: 10_150, imbalance: 0.2 });
        expect(beta).toMatchObject({ symbol: 'BETA', lastPriceCents: 5_000, volume: 3, vwapCents: 5_000, spreadCents: 20, imbalance: -0.5 });
        expect(gama).toMatchObject({ symbol: 'GAMA', lastPriceCents: undefined, volume: 0, vwapCents: undefined });
    });

    it('каждая сделка учитывается ровно один раз, в том числе между батчами', () => {
        const data = new MarketData(1);
        data.applyBatch(buffer(trade(10_000, 10)));
        data.snapshot();
        data.snapshot(); // снимки ничего не добавляют
        data.applyBatch(buffer(trade(10_200, 30)));

        expect(data.snapshot()[0]).toMatchObject({ volume: 40, vwapCents: 10_150 });
    });

    it('первые десять инструментов имеют имена, дальше нумерация', () => {
        const symbols = new MarketData(12).snapshot().map((row) => row.symbol);

        expect(symbols.slice(0, 2)).toEqual(['ALFA', 'BETA']);
        expect(symbols.slice(10)).toEqual(['SYM11', 'SYM12']);
    });

    it('читает поля обновления по смещениям формата Wasm', () => {
        const data = new MarketData(2);
        data.applyBatch(buffer([1, 5_000, 3, 4_990, 5_010, 100, 300]));

        expect(data.snapshot()[1]).toEqual({
            symbol: 'BETA',
            lastPriceCents: 5_000,
            spreadCents: 20,
            volume: 3,
            vwapCents: 5_000,
            imbalance: -0.5,
        });
    });

    it('неполное обновление в конце буфера игнорируется', () => {
        const data = new MarketData(1);
        const rows = buffer(trade(10_000, 10));
        const withTail = Int32Array.from([...rows, ...rows.slice(0, FIELDS - 1)]);

        data.applyBatch(withTail);

        expect(data.snapshot()[0].volume).toBe(10);
    });

    it('пустой буфер ничего не меняет', () => {
        const data = new MarketData(1);
        data.applyBatch(new Int32Array(0));

        expect(data.snapshot()[0].volume).toBe(0);
    });

});
