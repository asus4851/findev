// Дзеркало формату буфера з ../../../market-gen-as/assembly/index.ts. Значення мають збігатися.
//
// Wasm повертає батч одним плоским масивом чисел i32, по FIELDS сусідніх комірок на оновлення:
//   [ idx, price, qty, bid, ask, bidQty, askQty,   idx, price, qty, ...  ]
//     └──────────── оновлення 0 ───────────────┘   └── оновлення 1 ──┘

// Кількість чисел в одному оновленні.
export const FIELDS = 7;

// Зміщення поля всередині одного оновлення: ціна оновлення k лежить у комірці k × FIELDS + F_PRICE_CENTS.
export const F_INSTRUMENT = 0;       // індекс інструмента, символ ALFA/BETA формує воркер
export const F_PRICE_CENTS = 1;      // ціна угоди, цілі центи
export const F_TRADE_QUANTITY = 2;   // кількість угоди
export const F_BID_CENTS = 3;        // найкраща ціна купівлі після угоди
export const F_ASK_CENTS = 4;        // найкраща ціна продажу після угоди
export const F_BID_QUANTITY = 5;     // скільки чекає на купівлю по bid
export const F_ASK_QUANTITY = 6;     // скільки чекає на продаж по ask
