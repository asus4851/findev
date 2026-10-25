// Зеркало ../../market-gen-ts/src/simulator.ts.
// Генерация батча: соединяет ордер, стакан и обновление.
import { getOrderQty } from './market-model/quantity';
import { MarketUpdate } from './model/market-update';
import { Order } from './model/order';
import { Quote } from './model/quote';
import { Side } from './model/side';
import { RandomGenerator } from './utils/random-generator';

// Один батч: updatesPerBatch сделок по случайным инструментам.
// Один и тот же инструмент может встречаться несколько раз, стакан меняется от сделки к сделке.
export function generateBatch(quotes: Array<Quote>, updatesPerBatch: i32, random: RandomGenerator): Array<MarketUpdate> {
    const updates = new Array<MarketUpdate>(0);

    for (let i = 0; i < updatesPerBatch; i++) {
        const quote = quotes[random.rand(0, quotes.length - 1)];
        const side = random.rand(0, 1) == 0 ? Side.Buy : Side.Sell;
        const order = new Order(quote.instrument, side, getOrderQty(random));

        // Цена исполнения берётся после applyOrder, из того же состояния, что и снимок ниже.
        const price = quote.applyOrder(order);

        updates.push(new MarketUpdate(
            order.instrument,
            price,
            order.quantity,
            quote.bid,
            quote.ask,
            quote.bidQty,
            quote.askQty,
        ));
    }

    return updates;
}
