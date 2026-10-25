// Зеркало ../../../market-gen-ts/src/utils/random-generator.ts.
//
// Генератор случайных чисел mulberry32 с seed.
// Одинаковый seed даёт одинаковую последовательность, поэтому тесты детерминированы.
//
// Отличие от TypeScript: здесь состояние имеет тип u32, поэтому умножение и сложение
// сами обрезаются до 32 бит. В TypeScript для этого нужны Math.imul и `>>> 0`.
// Результат побитово тот же, так что обе версии выдают одинаковые числа.
export class RandomGenerator {
    private state: u32;

    constructor(seed: u32 = 1) {
        this.state = seed;
    }

    nextU32(): u32 {
        this.state += 0x6d2b79f5;
        let t: u32 = this.state;
        t = (t ^ (t >> 15)) * (t | 1);
        t ^= t + (t ^ (t >> 7)) * (t | 61);
        return t ^ (t >> 14);
    }

    // Целое число в диапазоне [min, max] включительно.
    rand(min: i32, max: i32): i32 {
        return min + <i32>(this.nextU32() % <u32>(max - min + 1));
    }
}
