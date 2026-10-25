// Генератор случайных чисел mulberry32 с seed.
// Одинаковый seed даёт одинаковую последовательность, поэтому тесты детерминированы.
// Работает только с 32-битными целыми, поэтому легко переносится в AssemblyScript (u32).
//
// Это класс, а не глобальная переменная: каждый запуск получает свой экземпляр,
// и разные запуски или тесты не влияют друг на друга.
export class RandomGenerator {
    private state: number;

    constructor(seed: number = 1) {
        this.state = seed >>> 0;
    }

    nextU32(): number {
        this.state = (this.state + 0x6d2b79f5) >>> 0;
        let t = this.state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return (t ^ (t >>> 14)) >>> 0;
    }

    // Целое число в диапазоне [min, max] включительно.
    rand(min: number, max: number): number {
        return min + (this.nextU32() % (max - min + 1));
    }
}
