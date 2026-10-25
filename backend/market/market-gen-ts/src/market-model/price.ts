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
import { RandomGenerator } from '../utils/random-generator';

// Новая цена после исчерпания уровня: сдвиг на случайные PRICE_SHIFT_MIN_BP..PRICE_SHIFT_MAX_BP
// от текущей цены. Buy сдвигает цену вверх, sell вниз.
// Процент задан в базисных пунктах, поэтому rand остаётся целочисленным,
// а логику легко перенести в AssemblyScript.
// Результат в целых центах, сдвиг не меньше PRICE_SHIFT_MIN_CENTS.
// Нижнюю границу цены проверяет Quote.setPrices.
export function getPriceDelta(random: RandomGenerator, price: number, side: 'buy' | 'sell') {
    const basisPoints = random.rand(PRICE_SHIFT_MIN_BP, PRICE_SHIFT_MAX_BP);
    const delta = Math.max(PRICE_SHIFT_MIN_CENTS, Math.round(price * basisPoints / BASIS_POINTS));
    return side == 'buy' ? price + delta : price - delta;
}

// Цена одной стороны стакана относительно цены котировки:
// ask выше price на случайный отступ SPREAD_DELTA_MIN_BP..SPREAD_DELTA_MAX_BP б.п., bid ниже.
// Отступ в целых центах, не меньше SPREAD_DELTA_MIN_CENTS.
// Нижнюю границу bid проверяет Quote.setPrices.
export function getSpread(random: RandomGenerator, price: number, isAsk: boolean = true) {
    const basisPoints = random.rand(SPREAD_DELTA_MIN_BP, SPREAD_DELTA_MAX_BP);
    const spread = Math.max(SPREAD_DELTA_MIN_CENTS, Math.round(price * basisPoints / BASIS_POINTS));
    return isAsk ? price + spread : price - spread;
}

// Начальная опорная цена инструмента.
export function getStartPrice(random: RandomGenerator) {
    return random.rand(START_PRICE_MIN_CENTS, START_PRICE_MAX_CENTS);
}
