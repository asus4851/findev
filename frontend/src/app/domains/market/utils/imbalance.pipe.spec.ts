import { formatImbalance } from './imbalance.pipe';

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
