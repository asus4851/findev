import { Side } from './side';

export class Order {
    readonly type: 'market' = 'market';
    readonly instrument: number;
    readonly side: Side;
    readonly quantity: number;

    constructor(instrument: number, side: Side, quantity: number) {
        this.instrument = instrument;
        this.side = side;
        this.quantity = quantity;
    }
}
