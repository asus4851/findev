import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DataTable, type TableColumn } from '../../components/data-table/data-table.component';
import type { InstrumentMetrics } from '../../market-types';
import { MarketSession, type SessionState } from '../../services/market-session.service';
import { CentsCurrency } from '../../utils/cents-currency.pipe';
import { Imbalance } from '../../utils/imbalance.pipe';

const STATE_LABELS: Record<SessionState, string> = {
  starting: 'Starting',
  running: 'Running',
  paused: 'Paused',
  error: 'Error',
};

const centsCurrency = new CentsCurrency();
const imbalance = new Imbalance();
const integer = new DecimalPipe('en-US');

// Колонки таблиці метрик: яке поле InstrumentMetrics, заголовок і формат показу.
const COLUMNS: TableColumn<InstrumentMetrics>[] = [
  { field: 'symbol', header: 'Instrument' },
  { field: 'lastPriceCents', header: 'Last price', pipe: centsCurrency, numeric: true },
  { field: 'spreadCents', header: 'Bid–ask spread', pipe: centsCurrency, numeric: true },
  { field: 'volume', header: 'Volume', pipe: integer, numeric: true },
  { field: 'vwapCents', header: 'VWAP', pipe: centsCurrency, numeric: true },
  { field: 'imbalance', header: 'Imbalance', pipe: imbalance, numeric: true },
];

@Component({
  selector: 'app-dashboard',
  imports: [DataTable, DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class Dashboard {
  protected readonly session = inject(MarketSession);

  protected readonly columns = COLUMNS;
  protected readonly settings = this.session.settings;
  protected readonly stateLabel = computed(() => STATE_LABELS[this.session.state()]);
  protected readonly canToggle = computed(() => this.session.state() === 'running' || this.session.state() === 'paused');
  protected readonly updatesPerSecond = computed(() =>
    (this.settings().updatesPerBatch * 1000) / this.settings().batchIntervalMs);

  protected toggle(): void {
    if (this.session.state() === 'paused') this.session.resume();
    else this.session.pause();
  }
}
