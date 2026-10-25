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
import { RandomGenerator } from '../utils/random-generator';

// Нова ціна після вичерпання рівня: зсув на випадкові PRICE_SHIFT_MIN_BP..PRICE_SHIFT_MAX_BP
// від поточної ціни. Buy зсуває ціну вгору, sell вниз.
// Відсоток задано в базисних пунктах, тому rand лишається цілочисельним,
// а логіку легко перенести в AssemblyScript.
// Результат у цілих центах, зсув не менше PRICE_SHIFT_MIN_CENTS.
// Нижню межу ціни перевіряє Quote.setPrices.
export function getPriceDelta(random: RandomGenerator, price: number, side: 'buy' | 'sell') {
    const basisPoints = random.rand(PRICE_SHIFT_MIN_BP, PRICE_SHIFT_MAX_BP);
    const delta = Math.max(PRICE_SHIFT_MIN_CENTS, Math.round(price * basisPoints / BASIS_POINTS));
    return side == 'buy' ? price + delta : price - delta;
}

// Ціна одного боку стакана відносно ціни квоти:
// ask вище за price на випадковий відступ SPREAD_DELTA_MIN_BP..SPREAD_DELTA_MAX_BP б.п., bid нижче.
// Відступ у цілих центах, не менше SPREAD_DELTA_MIN_CENTS.
// Нижню межу bid перевіряє Quote.setPrices.
export function getSpread(random: RandomGenerator, price: number, isAsk: boolean = true) {
    const basisPoints = random.rand(SPREAD_DELTA_MIN_BP, SPREAD_DELTA_MAX_BP);
    const spread = Math.max(SPREAD_DELTA_MIN_CENTS, Math.round(price * basisPoints / BASIS_POINTS));
    return isAsk ? price + spread : price - spread;
}

// Початкова опорна ціна інструмента.
export function getStartPrice(random: RandomGenerator) {
    return random.rand(START_PRICE_MIN_CENTS, START_PRICE_MAX_CENTS);
}
