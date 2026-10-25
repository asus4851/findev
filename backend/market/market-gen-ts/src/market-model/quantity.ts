// Правила количеств: сколько штук стоит на уровне стакана и сколько покупает или продаёт ордер.
import { maxOrderQty, maxQty, minOrderQty, minQty } from '../constants';
import { RandomGenerator } from '../utils/random-generator';

// Количество на новом уровне стакана.
export function getQty(random: RandomGenerator) {
    return random.rand(minQty, maxQty);
}

// Размер рыночного ордера.
export function getOrderQty(random: RandomGenerator) {
    return random.rand(minOrderQty, maxOrderQty);
}
