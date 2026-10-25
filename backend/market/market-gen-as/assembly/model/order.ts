// Дзеркало ../../../market-gen-ts/src/model/order.ts.
import { Side } from './side';

export class Order {
    readonly type: string = 'market';
    readonly instrument: i32;
    readonly side: Side;
    readonly quantity: i32;

    constructor(instrument: i32, side: Side, quantity: i32) {
        this.instrument = instrument;
        this.side = side;
        this.quantity = quantity;
    }
}
