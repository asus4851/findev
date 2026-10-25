import { describe, expect, it } from 'vitest';
import { RandomGenerator } from './random-generator';

describe('RandomGenerator', () => {
    it('повертає цілі числа в межах [min, max] включно і досягає обох меж', () => {
        const random = new RandomGenerator(1);
        const values = Array.from({ length: 10_000 }, () => random.rand(5, 15));

        expect(values.every(Number.isInteger)).toBe(true);
        expect(Math.min(...values)).toBe(5);
        expect(Math.max(...values)).toBe(15);
    });

    it('працює для діапазону з одного значення', () => {
        expect(new RandomGenerator(1).rand(7, 7)).toBe(7);
    });

    it('однаковий seed дає однакову послідовність, інший seed іншу', () => {
        const sequence = (seed: number) => {
            const random = new RandomGenerator(seed);
            return Array.from({ length: 50 }, () => random.rand(0, 1_000_000));
        };

        expect(sequence(42)).toEqual(sequence(42));
        expect(sequence(43)).not.toEqual(sequence(42));
    });

    it('різні екземпляри не впливають один на одного', () => {
        const a = new RandomGenerator(42);
        const b = new RandomGenerator(42);
        a.nextU32(); // a зрушився, b ні

        expect(b.nextU32()).toBe(new RandomGenerator(42).nextU32());
    });
});
