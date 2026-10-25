// Розрахунок п'яти метрик з ТЗ.
//
// Повна історія угод не зберігається: на інструмент тримаються лише накопичені суми
// і останній знімок стакана. Кожна угода додається рівно один раз.
import type { InstrumentMetrics } from '../../contracts/protocol';

// Полів одного оновлення в буфері Wasm, у тому самому порядку, що й у backend/market-gen-as:
// [instrument, price, quantity, bid, ask, bidQuantity, askQuantity].
export const FIELDS = 7;

// Накопичений стан одного інструмента з початку запуску.
interface Totals {
    volume: number;          // Σ кількостей угод
    notionalCents: number;   // Σ ціна × кількість, для VWAP; number безпечний до 2^53
    hasTrade: boolean;       // false до першої угоди: тоді решта полів не мають змісту
    priceCents: number;      // останній знімок: ціна угоди і стакан після неї
    bidCents: number;
    askCents: number;
    bidQuantity: number;
    askQuantity: number;
}

const emptyTotals = (): Totals => ({
    volume: 0, notionalCents: 0, hasTrade: false,
    priceCents: 0, bidCents: 0, askCents: 0, bidQuantity: 0, askQuantity: 0,
});

// Накопичувачі для всіх інструментів запуску.
export class MetricsAggregator {
    private readonly totals: Totals[];

    constructor(private readonly symbols: readonly string[]) {
        this.totals = symbols.map(emptyTotals);
    }

    // Додає всі оновлення батча з плоского буфера Wasm.
    // Кількості в стакані до обсягу не входять, як вимагає ТЗ.
    applyBuffer(buffer: Int32Array): void {
        for (let o = 0; o + FIELDS <= buffer.length; o += FIELDS) {
            const t = this.totals[buffer[o]];
            t.volume += buffer[o + 2];
            t.notionalCents += buffer[o + 1] * buffer[o + 2];
            t.hasTrade = true;
            t.priceCents = buffer[o + 1];
            t.bidCents = buffer[o + 3];
            t.askCents = buffer[o + 4];
            t.bidQuantity = buffer[o + 5];
            t.askQuantity = buffer[o + 6];
        }
    }

    // Метрики з накопиченого стану. Недоступне значення це undefined:
    // до першої угоди або коли знаменник формули дорівнює нулю.
    snapshot(): InstrumentMetrics[] {
        return this.symbols.map((symbol, index) => {
            const t = this.totals[index];
            const depth = t.bidQuantity + t.askQuantity;

            return {
                symbol,
                lastPriceCents: t.hasTrade ? t.priceCents : undefined,
                spreadCents: t.hasTrade ? t.askCents - t.bidCents : undefined,
                volume: t.volume,
                vwapCents: t.volume > 0 ? t.notionalCents / t.volume : undefined,
                imbalance: t.hasTrade && depth > 0 ? (t.bidQuantity - t.askQuantity) / depth : undefined,
            };
        });
    }
}
