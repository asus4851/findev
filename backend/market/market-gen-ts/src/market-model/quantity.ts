// Правила кількостей: скільки штук стоїть на рівні стакана і скільки купує чи продає ордер.
import { maxOrderQty, maxQty, minOrderQty, minQty } from '../constants';
import { RandomGenerator } from '../utils/random-generator';

// Кількість на новому рівні стакана.
export function getQty(random: RandomGenerator) {
    return random.rand(minQty, maxQty);
}

// Розмір ринкового ордера.
export function getOrderQty(random: RandomGenerator) {
    return random.rand(minOrderQty, maxOrderQty);
}
