import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { REFRESH_OPTIONS_MS, REFRESH_UNLIMITED } from '@backend/market';
import { DataTable, type TableColumn } from '../../../../shared/components/data-table/data-table.component';
import type { InstrumentMetrics } from '../../market.model';
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

// Колонки таблицы метрик: какое поле InstrumentMetrics, заголовок и формат отображения.
const COLUMNS: TableColumn<InstrumentMetrics>[] = [
  { field: 'symbol', header: 'Instrument' },
  { field: 'lastPriceCents', header: 'Last price', pipe: centsCurrency, numeric: true },
  { field: 'spreadCents', header: 'Bid–ask spread', pipe: centsCurrency, numeric: true },
  { field: 'volume', header: 'Volume', pipe: integer, numeric: true },
  { field: 'vwapCents', header: 'VWAP', pipe: centsCurrency, numeric: true },
  { field: 'imbalance', header: 'Imbalance', pipe: imbalance, numeric: true },
];

// Подпись варианта частоты обновления таблицы.
function refreshLabel(refreshMs: number): string {
  return refreshMs === REFRESH_UNLIMITED ? 'No limit (performance mode)' : `${refreshMs / 1000} s`;
}

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
  protected readonly refreshOptions = REFRESH_OPTIONS_MS.map((value) => ({ value, label: refreshLabel(value) }));
  protected readonly settings = this.session.settings;
  protected readonly stateLabel = computed(() => STATE_LABELS[this.session.state()]);
  protected readonly canToggle = computed(() => this.session.state() === 'running' || this.session.state() === 'paused');
  protected readonly updatesPerSecond = computed(() =>
    (this.settings().updatesPerBatch * 1000) / this.settings().batchIntervalMs);

  protected readonly unlimitedRefresh = computed(() => this.session.refreshMs() === REFRESH_UNLIMITED);

  protected toggle(): void {
    if (this.session.state() === 'paused') this.session.resume();
    else this.session.pause();
  }

  protected changeRefresh(event: Event): void {
    this.session.setRefresh(Number((event.target as HTMLSelectElement).value));
  }
}
