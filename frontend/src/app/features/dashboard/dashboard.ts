import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MarketProducer, type ProducerState } from '../../core/market/market-producer';
import { InstrumentsTable } from './instruments-table';

const STATE_LABELS: Record<ProducerState, string> = {
  starting: 'Starting',
  running: 'Running',
  paused: 'Paused',
  error: 'Error',
};

@Component({
  selector: 'app-dashboard',
  imports: [InstrumentsTable, DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard {
  protected readonly producer = inject(MarketProducer);

  protected readonly settings = this.producer.settings;
  protected readonly stateLabel = computed(() => STATE_LABELS[this.producer.state()]);
  protected readonly canToggle = computed(() => this.producer.state() === 'running' || this.producer.state() === 'paused');
  protected readonly updatesPerSecond = computed(() =>
    (this.settings().updatesPerBatch * 1000) / this.settings().batchIntervalMs);

  protected toggle(): void {
    if (this.producer.state() === 'paused') this.producer.resume();
    else this.producer.pause();
  }
}
