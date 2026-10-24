// Дзеркало ../../../market-gen-ts/src/market-model/quantity.ts.
// Правила кількостей: скільки штук стоїть на рівні стакана і скільки купує чи продає ордер.
import { maxOrderQty, maxQty, minOrderQty, minQty } from '../constants';
import { RandomGenerator } from '../utils/random-generator';

// Кількість на новому рівні стакана.
export function getQty(random: RandomGenerator): i32 {
    return random.rand(minQty, maxQty);
}

// Розмір ринкового ордера.
export function getOrderQty(random: RandomGenerator): i32 {
    return random.rand(minOrderQty, maxOrderQty);
}
