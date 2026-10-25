import { describe, expect, it } from 'vitest';
import { getSymbol } from './symbols';

describe('getSymbol', () => {
    it('перші десять інструментів мають імена', () => {
        expect(getSymbol(0)).toBe('ALFA');
        expect(getSymbol(1)).toBe('BETA');
        expect(getSymbol(9)).toBe('KAPA');
    });

    it('далі нумерація з двома цифрами, від 11', () => {
        expect(getSymbol(10)).toBe('SYM11');
        expect(getSymbol(49)).toBe('SYM50');
    });

    it('усі 50 символів з межі ТЗ різні', () => {
        const symbols = Array.from({ length: 50 }, (_, i) => getSymbol(i));

        expect(new Set(symbols).size).toBe(50);
    });
});
