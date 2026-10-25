// Одне оновлення з ТЗ: одна угода і знімок стакана після неї.
export class MarketUpdate {
    readonly instrument: number;
    readonly priceCents: number;
    readonly tradeQuantity: number;
    readonly bidCents: number;
    readonly askCents: number;
    readonly bidQuantity: number;
    readonly askQuantity: number;

    constructor(
        instrument: number,
        priceCents: number,
        tradeQuantity: number,
        bidCents: number,
        askCents: number,
        bidQuantity: number,
        askQuantity: number,
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
