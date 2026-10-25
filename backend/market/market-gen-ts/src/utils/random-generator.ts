// Seeded генератор випадкових чисел mulberry32.
// Однаковий seed дає однакову послідовність, тому тести детерміновані.
// Працює лише з 32-бітними цілими, тож легко переноситься в AssemblyScript (u32).
//
// Це клас, а не глобальна змінна: кожен запуск отримує свій екземпляр,
// і різні запуски або тести не впливають один на одного.
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

    // Ціле число в діапазоні [min, max] включно.
    rand(min: number, max: number): number {
        return min + (this.nextU32() % (max - min + 1));
    }
}
