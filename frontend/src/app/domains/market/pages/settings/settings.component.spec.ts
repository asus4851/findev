import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FakeMarketWorker, metricsRow } from '../../../../../testing/fake-market-worker';
import { MarketSession } from '../../services/market-session.service';
import { MARKET_WORKER_FACTORY } from '../../tokens/market-worker.token';
import { Settings } from './settings.component';

describe('Settings', () => {
  let worker: FakeMarketWorker;
  let session: MarketSession;
  let fixture: ComponentFixture<Settings>;
  let element: HTMLElement;

  const input = (id: string) => element.querySelector<HTMLInputElement>(`#${id}`)!;
  const applyButton = () => element.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  const errorText = () => [...element.querySelectorAll('.error')].map((e) => e.textContent!.trim());

  async function type(id: string, value: string): Promise<void> {
    const field = input(id);
    field.value = value;
    field.dispatchEvent(new Event('input'));
    field.dispatchEvent(new Event('blur'));
    await fixture.whenStable();
  }

  async function apply(): Promise<void> {
    applyButton().click();
    await fixture.whenStable();
  }

  beforeEach(async () => {
    worker = new FakeMarketWorker();
    TestBed.configureTestingModule({
      providers: [{ provide: MARKET_WORKER_FACTORY, useValue: () => worker }],
    });
    session = TestBed.inject(MarketSession);
    session.start();
    fixture = TestBed.createComponent(Settings);
    element = fixture.nativeElement;
    await fixture.whenStable();
  });

  it('показывает настройки активного запуска', () => {
    expect([input('instrumentCount').value, input('updatesPerBatch').value, input('batchIntervalMs').value])
      .toEqual(['5', '100', '500']);
  });

  it.each([
    ['instrumentCount', '0', 'Enter a whole number from 1 to 50.'],
    ['instrumentCount', '51', 'Enter a whole number from 1 to 50.'],
    ['updatesPerBatch', '1001', 'Enter a whole number from 1 to 1000.'],
    ['batchIntervalMs', '49', 'Enter a whole number from 50 to 2000.'],
    ['batchIntervalMs', '2001', 'Enter a whole number from 50 to 2000.'],
    ['updatesPerBatch', '2.5', 'Enter a whole number from 1 to 1000.'],
  ])('%s = %s некорректно: показывает ошибку и блокирует Apply', async (id, value, message) => {
    await type(id, value);

    expect(errorText()).toEqual([message]);
    expect(applyButton().disabled).toBe(true);
  });

  it('принимает границы из ТЗ', async () => {
    await type('instrumentCount', '50');
    await type('updatesPerBatch', '1');
    await type('batchIntervalMs', '2000');

    expect(errorText()).toEqual([]);
    expect(applyButton().disabled).toBe(false);
  });

  it('редактирование не влияет на запуск до Apply', async () => {
    await type('instrumentCount', '12');

    expect(session.settings().instrumentCount).toBe(5);
    expect(worker.sent).toHaveLength(1);
  });

  it('Apply начинает новый запуск с новыми настройками и очищает значения', async () => {
    worker.emit({ type: 'snapshot', runId: 1, rows: [metricsRow('ALFA', { volume: 40 })] });
    await type('instrumentCount', '12');
    await type('batchIntervalMs', '250');

    await apply();

    expect(worker.sent.at(-1)).toEqual({
      type: 'start',
      runId: 2,
      settings: { instrumentCount: 12, updatesPerBatch: 100, batchIntervalMs: 250 },
      seed: expect.any(Number),
    });
    expect(session.settings()).toEqual({ instrumentCount: 12, updatesPerBatch: 100, batchIntervalMs: 250 });
    expect(session.rows()).toEqual([]);
    expect(element.querySelector('[role="status"]')!.textContent).toContain('New run started');
  });

  it('с некорректными настройками Apply ничего не запускает', async () => {
    await type('instrumentCount', '0');
    // Кнопка выключена, но форму можно отправить и другим способом, например Enter.
    element.querySelector('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    expect(worker.sent).toHaveLength(1);
  });
});
