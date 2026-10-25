// Накопичений стан одного інструмента з початку запуску.
//
// Повна історія угод не зберігається, як вимагає ТЗ: лише дві суми і останнє оновлення.
// З них у будь-який момент рахуються всі п'ять метрик.
import type { InstrumentMetrics } from '../../../contracts/protocol';

export class InstrumentStats {
    readonly symbol: string;

    // Суми з початку запуску. Кожна угода додається рівно один раз.
    volume: number = 0;          // Σ кількостей угод
    notionalCents: number = 0;   // Σ ціна × кількість, для VWAP; number точний до 2^53

    // Останнє оновлення: кожна нова угода просто перезаписує попередню.
    // Поки hasTrade == false, ці поля не мають змісту.
    hasTrade: boolean = false;
    lastPriceCents: number = 0;
    bidCents: number = 0;
    askCents: number = 0;
    bidQuantity: number = 0;
    askQuantity: number = 0;

    constructor(symbol: string) {
        this.symbol = symbol;
    }

    // Додає одну угоду. Кількості в стакані до обсягу не входять, як вимагає ТЗ.
    applyTrade(
        priceCents: number,
        tradeQuantity: number,
        bidCents: number,
        askCents: number,
        bidQuantity: number,
        askQuantity: number,
    ): void {
        this.volume += tradeQuantity;
        this.notionalCents += priceCents * tradeQuantity;

        this.hasTrade = true;
        this.lastPriceCents = priceCents;
        this.bidCents = bidCents;
        this.askCents = askCents;
        this.bidQuantity = bidQuantity;
        this.askQuantity = askQuantity;
    }

    // П'ять метрик з ТЗ. undefined означає «значення недоступне»:
    // до першої угоди або коли знаменник формули дорівнює нулю.
    // Ціни лишаються в дробових центах і округлюються лише при показі.
    toMetrics(): InstrumentMetrics {
        const depth = this.bidQuantity + this.askQuantity;

        return {
            symbol: this.symbol,
            lastPriceCents: this.hasTrade ? this.lastPriceCents : undefined,
            spreadCents: this.hasTrade ? this.askCents - this.bidCents : undefined,
            volume: this.volume,
            vwapCents: this.volume > 0 ? this.notionalCents / this.volume : undefined,
            imbalance: this.hasTrade && depth > 0 ? (this.bidQuantity - this.askQuantity) / depth : undefined,
        };
    }
}
