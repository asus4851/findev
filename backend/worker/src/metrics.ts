// Розрахунок п'яти метрик з ТЗ. Чисті функції без стану воркера, тому легко тестуються.
//
// Повна історія угод не зберігається: на інструмент тримаються лише накопичені суми
// і останній знімок стакана. Кожна угода додається рівно один раз.
import type { InstrumentMetrics } from '../../contracts/protocol';

// Одне ринкове оновлення: угода і знімок стакана після неї.
export interface TradeUpdate {
    priceCents: number;
    tradeQuantity: number;
    bidCents: number;
    askCents: number;
    bidQuantity: number;
    askQuantity: number;
}

// Накопичений стан одного інструмента з початку запуску.
export interface InstrumentAccumulator {
    volume: number;          // Σ кількостей угод
    notionalCents: number;   // Σ ціна × кількість, для VWAP; number безпечний до 2^53
    last: TradeUpdate | undefined;
}

export function createAccumulator(): InstrumentAccumulator {
    return { volume: 0, notionalCents: 0, last: undefined };
}

// Додає одну угоду. Кількості в стакані до обсягу не входять, як вимагає ТЗ.
export function applyTrade(accumulator: InstrumentAccumulator, update: TradeUpdate): void {
    accumulator.volume += update.tradeQuantity;
    accumulator.notionalCents += update.priceCents * update.tradeQuantity;
    accumulator.last = update;
}

// Метрики з накопиченого стану. Недоступне значення це undefined:
// до першої угоди або коли знаменник формули дорівнює нулю.
export function toMetrics(symbol: string, accumulator: InstrumentAccumulator): InstrumentMetrics {
    const last = accumulator.last;
    const depth = last ? last.bidQuantity + last.askQuantity : 0;

    return {
        symbol,
        lastPriceCents: last?.priceCents,
        spreadCents: last ? last.askCents - last.bidCents : undefined,
        volume: accumulator.volume,
        vwapCents: accumulator.volume > 0 ? accumulator.notionalCents / accumulator.volume : undefined,
        imbalance: last && depth > 0 ? (last.bidQuantity - last.askQuantity) / depth : undefined,
    };
}

// Поля одного оновлення в буфері Wasm, у тому самому порядку, що й у backend/market-gen-as.
export const FIELDS = 7;

// Накопичувачі для всіх інструментів запуску.
export class MetricsAggregator {
    private readonly accumulators: InstrumentAccumulator[];

    constructor(private readonly symbols: readonly string[]) {
        this.accumulators = symbols.map(createAccumulator);
    }

    // Додає всі оновлення батча з плоского буфера Wasm.
    applyBuffer(buffer: Int32Array): void {
        for (let o = 0; o + FIELDS <= buffer.length; o += FIELDS) {
            const accumulator = this.accumulators[buffer[o]];
            applyTrade(accumulator, {
                priceCents: buffer[o + 1],
                tradeQuantity: buffer[o + 2],
                bidCents: buffer[o + 3],
                askCents: buffer[o + 4],
                bidQuantity: buffer[o + 5],
                askQuantity: buffer[o + 6],
            });
        }
    }

    snapshot(): InstrumentMetrics[] {
        return this.symbols.map((symbol, index) => toMetrics(symbol, this.accumulators[index]));
    }
}
