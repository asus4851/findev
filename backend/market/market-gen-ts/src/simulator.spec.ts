import { describe, expect, it } from 'vitest';
import { maxOrderQty, minOrderQty } from './constants';
import { MarketUpdate } from './model/market-update';
import { Quote } from './model/quote';
import { generateBatch } from './simulator';
import { RandomGenerator } from './utils/random-generator';

const makeQuotes = (count: number, random: RandomGenerator) =>
    Array.from({ length: count }, (_, index) => new Quote(index, random));

// Фіксований seed: і квоти, і батчі детерміновані.
function run(seed: number, instruments: number, batches: number, size: number): MarketUpdate[] {
    const random = new RandomGenerator(seed);
    const quotes = makeQuotes(instruments, random);
    return Array.from({ length: batches }, () => generateBatch(quotes, size, random)).flat();
}

describe('generateBatch', () => {
    it('повертає рівно запитану кількість оновлень', () => {
        const random = new RandomGenerator(1);
        const quotes = makeQuotes(5, random);

        for (const size of [1, 7, 100, 1000]) {
            expect(generateBatch(quotes, size, random)).toHaveLength(size);
        }
    });

    it('кожне оновлення відповідає інваріантам ТЗ', () => {
        const updates = run(42, 20, 100, 1000);

        const isValid = (u: MarketUpdate) =>
            // Цілі центи і додатні ціни.
            Number.isInteger(u.priceCents) && Number.isInteger(u.bidCents) && Number.isInteger(u.askCents)
            && u.priceCents > 0 && u.bidCents > 0
            // bid нижчий за ask.
            && u.bidCents < u.askCents
            // Ціна угоди це bid або ask цього ж оновлення.
            && (u.priceCents === u.bidCents || u.priceCents === u.askCents)
            // Кількість угоди додатна, кількості в стакані невід'ємні.
            && u.tradeQuantity >= minOrderQty && u.tradeQuantity <= maxOrderQty
            && u.bidQuantity >= 0 && u.askQuantity >= 0;

        // Один expect на всі 100 000 оновлень: у разі помилки видно саме ті, що порушили правило.
        expect(updates).toHaveLength(100_000);
        expect(updates.filter((u) => !isValid(u))).toEqual([]);
    });

    it('усі інструменти отримують оновлення, і є і купівлі, і продажі', () => {
        const updates = run(42, 20, 10, 1000);

        expect(new Set(updates.map((u) => u.instrument)).size).toBe(20);
        expect(updates.some((u) => u.priceCents === u.askCents)).toBe(true);
        expect(updates.some((u) => u.priceCents === u.bidCents)).toBe(true);
    });

    it('інструмент може траплятися в батчі кілька разів', () => {
        const random = new RandomGenerator(1);
        const updates = generateBatch(makeQuotes(1, random), 100, random);

        expect(updates.every((u) => u.instrument === 0)).toBe(true);
    });

    it('однаковий seed дає однакові дані, інший seed інші', () => {
        expect(run(7, 5, 1, 200)).toEqual(run(7, 5, 1, 200));
        expect(run(8, 5, 1, 200)).not.toEqual(run(7, 5, 1, 200));
    });

    it('стан інструментів зберігається між батчами', () => {
        // Два батчі по 50 мають дорівнювати одному батчу на 100.
        expect(run(3, 5, 2, 50)).toEqual(run(3, 5, 1, 100));
    });

    it('ціни тримаються, поки рівня вистачає, і зсуваються в бік угоди після його вичерпання', () => {
        const updates = run(11, 3, 20, 1000);
        const previous = new Map<number, MarketUpdate>();
        let priceMoves = 0;

        for (const u of updates) {
            const p = previous.get(u.instrument);
            const isBuy = u.priceCents === u.askCents;

            if (p && p.bidCents === u.bidCents && p.askCents === u.askCents) {
                // Рівень живий: зменшився лише бік угоди, рівно на її кількість.
                if (isBuy) {
                    expect(u.askQuantity).toBe(p.askQuantity - u.tradeQuantity);
                    expect(u.bidQuantity).toBe(p.bidQuantity);
                } else {
                    expect(u.bidQuantity).toBe(p.bidQuantity - u.tradeQuantity);
                    expect(u.askQuantity).toBe(p.askQuantity);
                }
            } else if (p) {
                // Рівень пройдено: ціна рухнулась у бік угоди.
                priceMoves++;
                if (isBuy) expect(u.askCents).toBeGreaterThan(p.askCents);
                else expect(u.bidCents).toBeLessThan(p.bidCents);
            }
            previous.set(u.instrument, u);
        }

        expect(priceMoves).toBeGreaterThan(100);
    });
});
