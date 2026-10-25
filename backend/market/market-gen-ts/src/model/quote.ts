import { MAX_PRICE_CENTS, MIN_PRICE_CENTS } from '../constants';
import { getPriceDelta, getSpread, getStartPrice } from '../market-model/price';
import { getQty } from '../market-model/quantity';
import { RandomGenerator } from '../utils/random-generator';
import { Order } from './order';
import { Side } from './side';

export class Quote {
    readonly instrument: number;
    // Цены задаются только через setPrices, поэтому `!`: TypeScript не видит присваивания в методе.
    ask!: number;
    bid!: number;
    price!: number;
    askQty: number;
    bidQty: number;

    // Генератор случайных чисел запуска. Все котировки запуска делят один экземпляр,
    // поэтому последовательность событий определяется одним seed.
    private readonly random: RandomGenerator;

    // Начальное состояние инструмента: опорная цена и стакан вокруг неё.
    // ask и bid строятся от price тем же getSpread, что и при перекотировке,
    // поэтому инварианты (bid < ask, цены положительны) действуют с первой сделки.
    constructor(instrument: number, random: RandomGenerator, startPrice: number = getStartPrice(random)) {
        this.instrument = instrument;
        this.random = random;
        this.setPrices(startPrice);
        this.askQty = getQty(random);
        this.bidQty = getQty(random);
    }

    // Меняет поля самого Quote, поэтому следующая сделка стартует уже от нового состояния.
    // Применяет рыночный ордер к стакану и возвращает цену исполнения:
    // ask для покупателя, bid для продавца, уже после возможной перекотировки.
    // Поэтому цена сделки всегда равна bid или ask снимка этого же обновления.
    //
    // TODO: вместо цены возвращать сущность сделки Trade
    // (instrument, side, priceCents, quantity, sweptLevel).
    // Когда ордер больше уровня, часть исполняется по старой цене,
    // а излишек по новой. Trade должен считать среднюю цену исполнения:
    //   avgPrice = (available × старыйУровень + excess × новыйУровень) / quantity
    // и вычитать излишек из количества нового уровня.
    applyOrder(order: Order): number {
        const isBuy = order.side == Side.Buy;

        // Покупатель берёт из ask, продавец отдаёт в bid.
        const available = isBuy ? this.askQty : this.bidQty;

        if (order.quantity > available) {
            // Уровню не хватает количества: ордер проходит стакан, цена сдвигается.
            this.requote(isBuy);
        } else if (isBuy) {
            // Количества хватает: уменьшаем соответствующую сторону.
            this.askQty -= order.quantity;
        } else {
            this.bidQty -= order.quantity;
        }

        return isBuy ? this.ask : this.bid;
    }

    // Уровень исчерпан: цена сдвигается в сторону сделки, обе стороны стакана котируются заново.
    // Buy двигает цену от ask вверх, sell двигает от bid вниз.
    private requote(isBuy: boolean): void {
        this.setPrices(isBuy
            ? getPriceDelta(this.random, this.ask, 'buy')
            : getPriceDelta(this.random, this.bid, 'sell'));
        this.askQty = getQty(this.random);
        this.bidQty = getQty(this.random);
    }

    // Единственное место, где меняются цены котировки, и здесь же проверяются инварианты:
    //  - опорная цена и bid не ниже MIN_PRICE_CENTS, то есть всегда положительны;
    //  - опорная цена не выше MAX_PRICE_CENTS, чтобы не переполнить i32 в AssemblyScript
    //    (ask может превысить границу лишь на отступ спреда, до 0,05%);
    //  - ask выше price минимум на SPREAD_DELTA_MIN_CENTS, а bid ниже price
    //    (или равен 1 центу, если price очень мала), поэтому bid всегда ниже ask.
    // Порядок вызовов getSpread (сначала ask, потом bid) сохранён, чтобы последовательность rand не изменилась.
    private setPrices(price: number): void {
        this.price = Math.min(MAX_PRICE_CENTS, Math.max(MIN_PRICE_CENTS, price));
        this.ask = getSpread(this.random, this.price);
        this.bid = Math.max(MIN_PRICE_CENTS, getSpread(this.random, this.price, false));
    }
}
