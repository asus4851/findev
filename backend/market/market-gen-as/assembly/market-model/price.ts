// Зеркало ../../../market-gen-ts/src/market-model/price.ts.
// Правила движения цены: на сколько сдвигается цена после исчерпания уровня,
// какой спред между bid и ask, с какой цены стартует инструмент.
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

// Доля цены в целых центах, округлённая до ближайшего: price × basisPoints / BASIS_POINTS.
// В TypeScript это Math.round(price * basisPoints / BASIS_POINTS) с дробными числами.
// Здесь то же самое целочисленно: +половина делителя перед делением даёт округление до ближайшего
// для положительных чисел, и результат совпадает с TypeScript-версией.
function basisPointsOf(price: i32, basisPoints: i32): i32 {
    return (price * basisPoints + BASIS_POINTS / 2) / BASIS_POINTS;
}

// Новая цена после исчерпания уровня: сдвиг на случайные PRICE_SHIFT_MIN_BP..PRICE_SHIFT_MAX_BP
// от текущей цены. Buy сдвигает цену вверх, sell вниз.
// Результат в целых центах, сдвиг не меньше PRICE_SHIFT_MIN_CENTS.
// Нижнюю границу цены проверяет Quote.setPrices.
//
// Отличие от TypeScript: сторона передаётся как Side, а не строка 'buy' | 'sell',
// потому что AssemblyScript не поддерживает строковые union-типы.
export function getPriceDelta(random: RandomGenerator, price: i32, side: Side): i32 {
    const basisPoints = random.rand(PRICE_SHIFT_MIN_BP, PRICE_SHIFT_MAX_BP);
    const delta = max<i32>(PRICE_SHIFT_MIN_CENTS, basisPointsOf(price, basisPoints));
    return side == Side.Buy ? price + delta : price - delta;
}

// Цена одной стороны стакана относительно цены котировки:
// ask выше price на случайный отступ SPREAD_DELTA_MIN_BP..SPREAD_DELTA_MAX_BP б.п., bid ниже.
// Отступ в целых центах, не меньше SPREAD_DELTA_MIN_CENTS.
// Нижнюю границу bid проверяет Quote.setPrices.
export function getSpread(random: RandomGenerator, price: i32, isAsk: bool = true): i32 {
    const basisPoints = random.rand(SPREAD_DELTA_MIN_BP, SPREAD_DELTA_MAX_BP);
    const spread = max<i32>(SPREAD_DELTA_MIN_CENTS, basisPointsOf(price, basisPoints));
    return isAsk ? price + spread : price - spread;
}

// Начальная опорная цена инструмента.
export function getStartPrice(random: RandomGenerator): i32 {
    return random.rand(START_PRICE_MIN_CENTS, START_PRICE_MAX_CENTS);
}
