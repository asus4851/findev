// Зеркало ../../../market-gen-ts/src/model/market-update.ts.
// Одно обновление из ТЗ: одна сделка и снимок стакана после неё.
export class MarketUpdate {
    readonly instrument: i32;
    readonly priceCents: i32;
    readonly tradeQuantity: i32;
    readonly bidCents: i32;
    readonly askCents: i32;
    readonly bidQuantity: i32;
    readonly askQuantity: i32;

    constructor(
        instrument: i32,
        priceCents: i32,
        tradeQuantity: i32,
        bidCents: i32,
        askCents: i32,
        bidQuantity: i32,
        askQuantity: i32,
    ) {
        this.instrument = instrument;
        this.priceCents = priceCents;
        this.tradeQuantity = tradeQuantity;
        this.bidCents = bidCents;
        this.askCents = askCents;
        this.bidQuantity = bidQuantity;
        this.askQuantity = askQuantity;
    }
}
