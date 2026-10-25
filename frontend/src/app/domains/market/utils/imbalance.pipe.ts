import { Pipe, PipeTransform } from '@angular/core';

const signed = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: 'exceptZero' });

// Дисбаланс от −1 до +1 с двумя знаками после запятой и знаком: 0.2 даёт +0.20.
// Недоступное значение отображается как тире.
export function formatImbalance(value: number | undefined): string {
  return value === undefined || !Number.isFinite(value) ? '—' : signed.format(value);
}

@Pipe({ name: 'imbalance' })
export class ImbalancePipe implements PipeTransform {
  transform(value: number | undefined): string {
    return formatImbalance(value);
  }
}
