import { describe, expect, it } from 'vitest';
import { getSymbol } from './symbols';

describe('getSymbol', () => {
    it('первые десять инструментов имеют имена', () => {
        expect(getSymbol(0)).toBe('ALFA');
        expect(getSymbol(1)).toBe('BETA');
        expect(getSymbol(9)).toBe('KAPA');
    });

    it('дальше нумерация из двух цифр, с 11', () => {
        expect(getSymbol(10)).toBe('SYM11');
        expect(getSymbol(49)).toBe('SYM50');
    });

    it('все 50 символов из границы ТЗ разные', () => {
        const symbols = Array.from({ length: 50 }, (_, i) => getSymbol(i));

        expect(new Set(symbols).size).toBe(50);
    });
});
