import { Pipe, PipeTransform } from '@angular/core';

const signed = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: 'exceptZero' });

// Дисбаланс від −1 до +1 з двома знаками і знаком: 0.2 дає +0.20.
// Недоступне значення показується як тире.
export function formatImbalance(value: number | undefined): string {
  return value === undefined || !Number.isFinite(value) ? '—' : signed.format(value);
}

@Pipe({ name: 'imbalance' })
export class Imbalance implements PipeTransform {
  transform(value: number | undefined): string {
    return formatImbalance(value);
  }
}
