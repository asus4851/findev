// Генерація батча: з'єднує ордер, стакан і оновлення.
// Цю частину буде перенесено в Wasm, тому тут немає таймерів і часу.
import { getOrderQty } from './market-model/quantity';
import { MarketUpdate } from './model/market-update';
import { Order } from './model/order';
import { Quote } from './model/quote';
import { Side } from './model/side';
import { RandomGenerator } from './utils/random-generator';

// Один батч: updatesPerBatch угод по випадкових інструментах.
// Той самий інструмент може траплятися кілька разів, стакан змінюється від угоди до угоди.
export function generateBatch(quotes: Quote[], updatesPerBatch: number, random: RandomGenerator): MarketUpdate[] {
    const updates: MarketUpdate[] = [];

    for (let i = 0; i < updatesPerBatch; i++) {
        const quote = quotes[random.rand(0, quotes.length - 1)];
        const side = random.rand(0, 1) == 0 ? Side.Buy : Side.Sell;
        const order = new Order(quote.instrument, side, getOrderQty(random));

        // Ціна виконання береться після applyOrder, з того самого стану, що й знімок нижче.
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
