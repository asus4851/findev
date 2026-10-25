// Обробка даних з Wasm: розбирає батчі угод і віддає п'ять метрик з ТЗ для кожного інструмента.
// Не залежить від воркера і Wasm, тому тестується на звичайних масивах.
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
    // Індекс у масиві збігається з індексом інструмента в буфері Wasm.
    private readonly instruments: InstrumentStats[] = [];

    constructor(instrumentCount: number) {
        for (let i = 0; i < instrumentCount; i++) {
            this.instruments.push(new InstrumentStats(getSymbol(i)));
        }
    }

    // Додає всі угоди батча. Буфер дійсний лише до наступного nextBatch,
    // тому дані розбираються одразу і ніде не зберігаються.
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

    // Рядки таблиці для Angular, по одному на інструмент.
    snapshot(): InstrumentMetrics[] {
        const rows: InstrumentMetrics[] = [];
        for (let i = 0; i < this.instruments.length; i++) {
            rows.push(this.instruments[i].toMetrics());
        }
        return rows;
    }
}
