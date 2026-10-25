// Зеркало ../../../market-gen-ts/src/market-model/quantity.ts.
// Правила количеств: сколько штук стоит на уровне стакана и сколько покупает или продаёт ордер.
import { maxOrderQty, maxQty, minOrderQty, minQty } from '../constants';
import { RandomGenerator } from '../utils/random-generator';

// Количество на новом уровне стакана.
export function getQty(random: RandomGenerator): i32 {
    return random.rand(minQty, maxQty);
}

// Размер рыночного ордера.
export function getOrderQty(random: RandomGenerator): i32 {
    return random.rand(minOrderQty, maxOrderQty);
}
