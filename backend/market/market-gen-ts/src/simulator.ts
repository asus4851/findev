// Генерация батча: соединяет ордер, стакан и обновление.
// Эта часть перенесена в Wasm, поэтому здесь нет таймеров и времени.
import { getOrderQty } from './market-model/quantity';
import { MarketUpdate } from './model/market-update';
import { Order } from './model/order';
import { Quote } from './model/quote';
import { Side } from './model/side';
import { RandomGenerator } from './utils/random-generator';

// Один батч: updatesPerBatch сделок по случайным инструментам.
// Один и тот же инструмент может встречаться несколько раз, стакан меняется от сделки к сделке.
export function generateBatch(quotes: Quote[], updatesPerBatch: number, random: RandomGenerator): MarketUpdate[] {
    const updates: MarketUpdate[] = [];

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
