import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { InstrumentMetrics } from '@contracts/protocol';
import { CentsCurrency } from '../../shared/pipes/cents-currency';
import { Imbalance } from '../../shared/pipes/imbalance';

// Таблиця метрик: по одному рядку на інструмент. Лише показує дані, нічого не рахує.
@Component({
  selector: 'app-instruments-table',
  imports: [CentsCurrency, Imbalance, DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './instruments-table.html',
  styleUrl: './instruments-table.css',
})
export class InstrumentsTable {
  readonly rows = input.required<InstrumentMetrics[]>();
}
