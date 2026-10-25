import { describe, expect, it } from 'vitest';
import { RandomGenerator } from './random-generator';

describe('RandomGenerator', () => {
    it('возвращает целые числа в пределах [min, max] включительно и достигает обеих границ', () => {
        const random = new RandomGenerator(1);
        const values = Array.from({ length: 10_000 }, () => random.rand(5, 15));

        expect(values.every(Number.isInteger)).toBe(true);
        expect(Math.min(...values)).toBe(5);
        expect(Math.max(...values)).toBe(15);
    });

    it('работает для диапазона из одного значения', () => {
        expect(new RandomGenerator(1).rand(7, 7)).toBe(7);
    });

    it('одинаковый seed даёт одинаковую последовательность, другой seed другую', () => {
        const sequence = (seed: number) => {
            const random = new RandomGenerator(seed);
            return Array.from({ length: 50 }, () => random.rand(0, 1_000_000));
        };

        expect(sequence(42)).toEqual(sequence(42));
        expect(sequence(43)).not.toEqual(sequence(42));
    });

    it('разные экземпляры не влияют друг на друга', () => {
        const a = new RandomGenerator(42);
        const b = new RandomGenerator(42);
        a.nextU32(); // a сдвинулся, b нет

        expect(b.nextU32()).toBe(new RandomGenerator(42).nextU32());
    });
});
