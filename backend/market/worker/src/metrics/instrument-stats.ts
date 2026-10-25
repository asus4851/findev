// Накопленное состояние одного инструмента с начала запуска.
//
// Полная история сделок не хранится, как требует ТЗ: только две суммы и последнее обновление.
// Из них в любой момент считаются все пять метрик.
import type { InstrumentMetrics } from '../../../contracts/protocol';

export class InstrumentStats {
    readonly symbol: string;

    // Суммы с начала запуска. Каждая сделка добавляется ровно один раз.
    volume: number = 0;          // Σ количеств сделок
    notionalCents: number = 0;   // Σ цена × количество, для VWAP; number точен до 2^53

    // Последнее обновление: каждая новая сделка просто перезаписывает предыдущую.
    // Пока hasTrade == false, эти поля не имеют смысла.
    hasTrade: boolean = false;
    lastPriceCents: number = 0;
    bidCents: number = 0;
    askCents: number = 0;
    bidQuantity: number = 0;
    askQuantity: number = 0;

    constructor(symbol: string) {
        this.symbol = symbol;
    }

    // Добавляет одну сделку. Количества в стакане в объём не входят, как требует ТЗ.
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

    // Пять метрик из ТЗ. undefined означает «значение недоступно»:
    // до первой сделки или когда знаменатель формулы равен нулю.
    // Цены остаются в дробных центах и округляются только при отображении.
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
