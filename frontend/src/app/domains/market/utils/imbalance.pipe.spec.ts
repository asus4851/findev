import { formatImbalance } from './imbalance.pipe';

describe('formatImbalance', () => {
  it('показывает значение от −1 до +1 со знаком и двумя знаками после запятой', () => {
    expect(formatImbalance(0.2)).toBe('+0.20');
    expect(formatImbalance(-0.5)).toBe('-0.50');
    expect(formatImbalance(1)).toBe('+1.00');
    expect(formatImbalance(-1)).toBe('-1.00');
    expect(formatImbalance(0)).toBe('0.00');
  });

  it('показывает недоступное значение как тире', () => {
    expect(formatImbalance(undefined)).toBe('—');
  });
});
