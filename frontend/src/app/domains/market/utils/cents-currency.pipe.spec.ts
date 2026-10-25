import { formatCents } from './cents-currency.pipe';

describe('formatCents', () => {
  it('показывает цену в центах как доллары', () => {
    expect(formatCents(10_200)).toBe('$102.00');
    expect(formatCents(4)).toBe('$0.04');
    expect(formatCents(123_456_789)).toBe('$1,234,567.89');
  });

  it('округляет дробные центы только при отображении', () => {
    expect(formatCents(10_150)).toBe('$101.50');
    expect(formatCents(30_002 / 3)).toBe('$100.01');
  });

  it('показывает недоступное значение как тире', () => {
    expect(formatCents(undefined)).toBe('—');
    expect(formatCents(Number.NaN)).toBe('—');
  });
});
