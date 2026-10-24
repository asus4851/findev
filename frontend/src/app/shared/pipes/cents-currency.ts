import { Pipe, PipeTransform } from '@angular/core';

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Ціна в центах як валюта: 10150 дає $101.50. Округлення лише тут, при показі.
// Недоступне значення показується як тире.
export function formatCents(cents: number | undefined): string {
  return cents === undefined || !Number.isFinite(cents) ? '—' : usd.format(cents / 100);
}

@Pipe({ name: 'centsCurrency' })
export class CentsCurrency implements PipeTransform {
  transform(cents: number | undefined): string {
    return formatCents(cents);
  }
}
