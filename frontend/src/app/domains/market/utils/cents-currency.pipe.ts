import { Pipe, PipeTransform } from '@angular/core';

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Цена в центах как валюта: 10150 даёт $101.50. Округление только здесь, при отображении.
// Недоступное значение отображается как тире.
export function formatCents(cents: number | undefined): string {
  return cents === undefined || !Number.isFinite(cents) ? '—' : usd.format(cents / 100);
}

@Pipe({ name: 'centsCurrency' })
export class CentsCurrencyPipe implements PipeTransform {
  transform(cents: number | undefined): string {
    return formatCents(cents);
  }
}
