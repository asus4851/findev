// Дзеркало ../../../market-gen-ts/src/model/quote.ts.
import { MAX_PRICE_CENTS, MIN_PRICE_CENTS } from '../constants';
import { getPriceDelta, getSpread, getStartPrice } from '../market-model/price';
import { getQty } from '../market-model/quantity';
import { RandomGenerator } from '../utils/random-generator';
import { Order } from './order';
import { Side } from './side';

export class Quote {
    readonly instrument: i32;
    // Ціни задаються лише через setPrices. Числові поля в AssemblyScript стартують з 0,
    // тому позначка `!`, як у TypeScript, тут не потрібна.
    ask: i32 = 0;
    bid: i32 = 0;
    price: i32 = 0;
    askQty: i32 = 0;
    bidQty: i32 = 0;

    // Генератор випадкових чисел запуску. Усі квоти запуску ділять один екземпляр,
    // тому послідовність подій визначається одним seed.
    private readonly random: RandomGenerator;

    // Початковий стан інструмента: опорна ціна і стакан навколо неї.
    // ask і bid будуються від price тим самим getSpread, що й при перекотируванні,
    // тому інваріанти (bid < ask, ціни додатні) діють з першої угоди.
    constructor(instrument: i32, random: RandomGenerator, startPrice: i32 = getStartPrice(random)) {
        this.instrument = instrument;
        this.random = random;
        this.setPrices(startPrice);
        this.askQty = getQty(random);
        this.bidQty = getQty(random);
    }

    // Змінює поля самого Quote, тому наступна угода стартує вже від нового стану.
    // Застосовує ринковий ордер до стакана і повертає ціну виконання:
    // ask для покупця, bid для продавця, вже після можливого перекотирування.
    // Тому ціна угоди завжди дорівнює bid або ask знімка цього ж оновлення.
    //
    // TODO: замість ціни повертати сутність угоди Trade
    // (instrument, side, priceCents, quantity, sweptLevel).
    // Коли ордер більший за рівень, частина виконується за старою ціною,
    // а надлишок за новою. Trade має рахувати середню ціну виконання:
    //   avgPrice = (available × старийРівень + excess × новийРівень) / quantity
    // і віднімати надлишок від кількості нового рівня.
    applyOrder(order: Order): i32 {
        const isBuy = order.side == Side.Buy;

        // Покупець бере з ask, продавець віддає в bid.
        const available = isBuy ? this.askQty : this.bidQty;

        if (order.quantity > available) {
            // Рівню не вистачає кількості: ордер проходить стакан, ціна зсувається.
            this.requote(isBuy);
        } else if (isBuy) {
            // Кількості вистачає: зменшуємо відповідний бік.
            this.askQty -= order.quantity;
        } else {
            this.bidQty -= order.quantity;
        }

        return isBuy ? this.ask : this.bid;
    }

    // Рівень вичерпано: ціна зсувається в бік угоди, обидва боки стакана котируються заново.
    // Buy рухає ціну від ask вгору, sell рухає від bid вниз.
    private requote(isBuy: bool): void {
        this.setPrices(isBuy
            ? getPriceDelta(this.random, this.ask, Side.Buy)
            : getPriceDelta(this.random, this.bid, Side.Sell));
        this.askQty = getQty(this.random);
        this.bidQty = getQty(this.random);
    }

    // Єдине місце, де змінюються ціни квоти, і тут же перевіряються інваріанти:
    //  - опорна ціна і bid не нижче MIN_PRICE_CENTS, тобто завжди додатні;
    //  - опорна ціна не вище MAX_PRICE_CENTS, щоб не переповнити i32
    //    (ask може перевищити межу лише на відступ спреду, до 0,05%);
    //  - ask вищий за price щонайменше на SPREAD_DELTA_MIN_CENTS, а bid нижчий за price
    //    (або дорівнює 1 центу, якщо price дуже мала), тому bid завжди нижчий за ask.
    // Порядок викликів getSpread (спершу ask, потім bid) збережено, щоб послідовність rand не змінилась.
    private setPrices(price: i32): void {
        this.price = min<i32>(MAX_PRICE_CENTS, max<i32>(MIN_PRICE_CENTS, price));
        this.ask = getSpread(this.random, this.price);
        this.bid = max<i32>(MIN_PRICE_CENTS, getSpread(this.random, this.price, false));
    }
}
