// Дзеркало ../../../market-gen-ts/src/market-model/price.ts.
// Правила руху ціни: на скільки зсувається ціна після вичерпання рівня,
// який спред між bid і ask, з якої ціни стартує інструмент.
import {
    BASIS_POINTS,
    PRICE_SHIFT_MAX_BP,
    PRICE_SHIFT_MIN_BP,
    PRICE_SHIFT_MIN_CENTS,
    SPREAD_DELTA_MAX_BP,
    SPREAD_DELTA_MIN_BP,
    SPREAD_DELTA_MIN_CENTS,
    START_PRICE_MAX_CENTS,
    START_PRICE_MIN_CENTS,
} from '../constants';
import { Side } from '../model/side';
import { RandomGenerator } from '../utils/random-generator';

// Частка ціни в цілих центах, округлена до найближчого: price × basisPoints / BASIS_POINTS.
// У TypeScript це Math.round(price * basisPoints / BASIS_POINTS) з дробовими числами.
// Тут те саме цілочисельно: +половина дільника перед діленням дає округлення до найближчого
// для додатних чисел, і результат збігається з TypeScript-версією.
function basisPointsOf(price: i32, basisPoints: i32): i32 {
    return (price * basisPoints + BASIS_POINTS / 2) / BASIS_POINTS;
}

// Нова ціна після вичерпання рівня: зсув на випадкові PRICE_SHIFT_MIN_BP..PRICE_SHIFT_MAX_BP
// від поточної ціни. Buy зсуває ціну вгору, sell вниз.
// Результат у цілих центах, зсув не менше PRICE_SHIFT_MIN_CENTS.
// Нижню межу ціни перевіряє Quote.setPrices.
//
// Відмінність від TypeScript: сторона передається як Side, а не рядок 'buy' | 'sell',
// бо AssemblyScript не підтримує рядкових union-типів.
export function getPriceDelta(random: RandomGenerator, price: i32, side: Side): i32 {
    const basisPoints = random.rand(PRICE_SHIFT_MIN_BP, PRICE_SHIFT_MAX_BP);
    const delta = max<i32>(PRICE_SHIFT_MIN_CENTS, basisPointsOf(price, basisPoints));
    return side == Side.Buy ? price + delta : price - delta;
}

// Ціна одного боку стакана відносно ціни квоти:
// ask вище за price на випадковий відступ SPREAD_DELTA_MIN_BP..SPREAD_DELTA_MAX_BP б.п., bid нижче.
// Відступ у цілих центах, не менше SPREAD_DELTA_MIN_CENTS.
// Нижню межу bid перевіряє Quote.setPrices.
export function getSpread(random: RandomGenerator, price: i32, isAsk: bool = true): i32 {
    const basisPoints = random.rand(SPREAD_DELTA_MIN_BP, SPREAD_DELTA_MAX_BP);
    const spread = max<i32>(SPREAD_DELTA_MIN_CENTS, basisPointsOf(price, basisPoints));
    return isAsk ? price + spread : price - spread;
}

// Початкова опорна ціна інструмента.
export function getStartPrice(random: RandomGenerator): i32 {
    return random.rand(START_PRICE_MIN_CENTS, START_PRICE_MAX_CENTS);
}
