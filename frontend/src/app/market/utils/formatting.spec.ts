import { formatCents } from './cents-currency.pipe';
import { formatImbalance } from './imbalance.pipe';

describe('formatCents', () => {
  it('показує ціну в центах як долари', () => {
    expect(formatCents(10_200)).toBe('$102.00');
    expect(formatCents(4)).toBe('$0.04');
    expect(formatCents(123_456_789)).toBe('$1,234,567.89');
  });

  it('округлює дробові центи лише при показі', () => {
    expect(formatCents(10_150)).toBe('$101.50');
    expect(formatCents(30_002 / 3)).toBe('$100.01');
  });

  it('показує недоступне значення як тире', () => {
    expect(formatCents(undefined)).toBe('—');
    expect(formatCents(Number.NaN)).toBe('—');
  });
});

describe('formatImbalance', () => {
  it('показує значення від −1 до +1 зі знаком і двома знаками після коми', () => {
    expect(formatImbalance(0.2)).toBe('+0.20');
    expect(formatImbalance(-0.5)).toBe('-0.50');
    expect(formatImbalance(1)).toBe('+1.00');
    expect(formatImbalance(-1)).toBe('-1.00');
    expect(formatImbalance(0)).toBe('0.00');
  });

  it('показує недоступне значення як тире', () => {
    expect(formatImbalance(undefined)).toBe('—');
  });
});
