// Обработка данных из Wasm: разбирает батчи сделок и отдаёт пять метрик из ТЗ для каждого инструмента.
// Не зависит от воркера и Wasm, поэтому тестируется на обычных массивах.
import type { InstrumentMetrics } from '../../../contracts/protocol';
import { getSymbol } from '../utils/symbols';
import {
    F_ASK_CENTS,
    F_ASK_QUANTITY,
    F_BID_CENTS,
    F_BID_QUANTITY,
    F_INSTRUMENT,
    F_PRICE_CENTS,
    F_TRADE_QUANTITY,
    FIELDS,
} from '../wasm/buffer-format';
import { InstrumentStats } from './instrument-stats';

export class MarketData {
    // Индекс в массиве совпадает с индексом инструмента в буфере Wasm.
    private readonly instruments: InstrumentStats[] = [];

    constructor(instrumentCount: number) {
        for (let i = 0; i < instrumentCount; i++) {
            this.instruments.push(new InstrumentStats(getSymbol(i)));
        }
    }

    // Добавляет все сделки батча. Буфер действителен только до следующего nextBatch,
    // поэтому данные разбираются сразу и нигде не хранятся.
    applyBatch(buffer: Int32Array): void {
        for (let offset = 0; offset + FIELDS <= buffer.length; offset += FIELDS) {
            this.instruments[buffer[offset + F_INSTRUMENT]].applyTrade(
                buffer[offset + F_PRICE_CENTS],
                buffer[offset + F_TRADE_QUANTITY],
                buffer[offset + F_BID_CENTS],
                buffer[offset + F_ASK_CENTS],
                buffer[offset + F_BID_QUANTITY],
                buffer[offset + F_ASK_QUANTITY],
            );
        }
    }

    // Строки таблицы для Angular, по одной на инструмент.
    snapshot(): InstrumentMetrics[] {
        const rows: InstrumentMetrics[] = [];
        for (let i = 0; i < this.instruments.length; i++) {
            rows.push(this.instruments[i].toMetrics());
        }
        return rows;
    }
}
