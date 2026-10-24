// Дзеркало ../../../market-gen-ts/src/utils/random-generator.ts.
//
// Seeded генератор випадкових чисел mulberry32.
// Однаковий seed дає однакову послідовність, тому тести детерміновані.
//
// Відмінність від TypeScript: тут стан має тип u32, тому множення й додавання
// самі обрізаються до 32 біт. У TypeScript для цього потрібні Math.imul і `>>> 0`.
// Результат побітово той самий, тож обидві версії видають однакові числа.
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

    // Ціле число в діапазоні [min, max] включно.
    rand(min: i32, max: i32): i32 {
        return min + <i32>(this.nextU32() % <u32>(max - min + 1));
    }
}
