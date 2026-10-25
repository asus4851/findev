// Обробка даних з Wasm: розбирає батчі угод і віддає п'ять метрик з ТЗ для кожного інструмента.
// Не залежить від воркера і Wasm, тому тестується на звичайних масивах.
import type { InstrumentMetrics } from '../../contracts/protocol';
import { InstrumentStats } from './model/instrument-stats';

// ── Формат буфера ────────────────────────────────────────────────────

// Дзеркало ../../market-gen-as/assembly/index.ts. Значення мають збігатися.
// Wasm повертає батч одним плоским масивом чисел i32, по FIELDS сусідніх комірок на оновлення:
//   [ idx, price, qty, bid, ask, bidQty, askQty,   idx, price, qty, ...  ]
//     └──────────── оновлення 0 ───────────────┘   └── оновлення 1 ──┘

// Кількість чисел в одному оновленні.
export const FIELDS = 7;

// Зміщення поля всередині одного оновлення.
const F_INSTRUMENT = 0;       // індекс інструмента, символ ALFA/BETA формує цей файл
const F_PRICE_CENTS = 1;      // ціна угоди, цілі центи
const F_TRADE_QUANTITY = 2;   // кількість угоди
const F_BID_CENTS = 3;        // найкраща ціна купівлі після угоди
const F_ASK_CENTS = 4;        // найкраща ціна продажу після угоди
const F_BID_QUANTITY = 5;     // скільки чекає на купівлю по bid
const F_ASK_QUANTITY = 6;     // скільки чекає на продаж по ask

// Символи вигаданих інструментів. Wasm працює з індексами, назви з'являються тут.
const NAMES = ['ALFA', 'BETA', 'GAMA', 'DELT', 'EPSI', 'ZETA', 'ETAA', 'THET', 'IOTA', 'KAPA'];

// ── Обробка даних ────────────────────────────────────────────────────

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

// ── Допоміжне ────────────────────────────────────────────────────────

// Перші десять інструментів мають імена, решта нумерується: SYM11, SYM12, ...
function getSymbol(index: number): string {
    if (index < NAMES.length) return NAMES[index];
    return 'SYM' + String(index + 1).padStart(2, '0');
}
