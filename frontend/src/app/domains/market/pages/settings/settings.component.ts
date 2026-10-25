import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormField, form, max, min, submit, validate, type SchemaPath } from '@angular/forms/signals';
import { SIMULATION_LIMITS, type SimulationConfigField, type SimulationSettings } from '../../market.model';
import { MarketSession } from '../../services/market-session.service';

interface FieldInfo {
  key: SimulationConfigField;
  label: string;
  hint: string;
}

const FIELDS: FieldInfo[] = [
  { key: 'instrumentCount', label: 'Instrument count', hint: 'Number of fictional instruments.' },
  { key: 'updatesPerBatch', label: 'Updates per batch', hint: 'Market updates in each batch, across all instruments.' },
  { key: 'batchIntervalMs', label: 'Batch interval, ms', hint: 'Requested time between batches.' },
];

// Границы из ТЗ, целое число. Границы берутся из общего контракта, как и в воркере.
function limited(path: SchemaPath<number>, field: SimulationConfigField): void {
  const { min: lower, max: upper } = SIMULATION_LIMITS[field];
  const message = `Enter a whole number from ${lower} to ${upper}.`;
  validate(path, ({ value }) =>
    Number.isInteger(value()) ? undefined : { kind: 'integer', message });
  min(path, lower, { message });
  max(path, upper, { message });
}

@Component({
  selector: 'app-settings',
  imports: [FormField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.css',
})
export class Settings {
  private readonly session = inject(MarketSession);

  protected readonly fields = FIELDS;
  protected readonly applied = signal(false);

  // Собственная копия настроек: редактирование не влияет на запуск до Apply.
  protected readonly model = signal<SimulationSettings>({ ...this.session.settings() });

  protected readonly settingsForm = form(this.model, (path) => {
    limited(path.instrumentCount, 'instrumentCount');
    limited(path.updatesPerBatch, 'updatesPerBatch');
    limited(path.batchIntervalMs, 'batchIntervalMs');
  });

  protected apply(event: Event): void {
    event.preventDefault();
    this.applied.set(false);
    void submit(this.settingsForm, async () => {
      this.session.apply(this.model());
      this.applied.set(true);
    });
  }
}
