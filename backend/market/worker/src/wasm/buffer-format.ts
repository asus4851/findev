// Зеркало формата буфера из ../../../market-gen-as/assembly/index.ts. Значения должны совпадать.
//
// Wasm возвращает батч одним плоским массивом чисел i32, по FIELDS соседних ячеек на обновление:
//   [ idx, price, qty, bid, ask, bidQty, askQty,   idx, price, qty, ...  ]
//     └──────────── обновление 0 ──────────────┘   └── обновление 1 ─┘

// Количество чисел в одном обновлении.
export const FIELDS = 7;

// Смещение поля внутри одного обновления: цена обновления k лежит в ячейке k × FIELDS + F_PRICE_CENTS.
export const F_INSTRUMENT = 0;       // индекс инструмента, символ ALFA/BETA формирует воркер
export const F_PRICE_CENTS = 1;      // цена сделки, целые центы
export const F_TRADE_QUANTITY = 2;   // количество сделки
export const F_BID_CENTS = 3;        // лучшая цена покупки после сделки
export const F_ASK_CENTS = 4;        // лучшая цена продажи после сделки
export const F_BID_QUANTITY = 5;     // сколько ждёт покупки по bid
export const F_ASK_QUANTITY = 6;     // сколько ждёт продажи по ask
