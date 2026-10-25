import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FakeMarketWorker, metricsRow } from '../../../../../testing/fake-market-worker';
import { MarketSession } from '../../services/market-session.service';
import { MARKET_WORKER_FACTORY } from '../../tokens/market-worker.token';
import { Dashboard } from './dashboard.component';

describe('Dashboard', () => {
  let worker: FakeMarketWorker;
  let fixture: ComponentFixture<Dashboard>;
  let element: HTMLElement;

  const cells = () =>
    [...element.querySelectorAll('tbody tr')].map((row) =>
      [...row.querySelectorAll('th, td')].map((cell) => cell.textContent!.trim()));
  const button = () => element.querySelector('button')!;

  beforeEach(async () => {
    worker = new FakeMarketWorker();
    TestBed.configureTestingModule({
      providers: [{ provide: MARKET_WORKER_FACTORY, useValue: () => worker }],
    });
    TestBed.inject(MarketSession).start();
    fixture = TestBed.createComponent(Dashboard);
    element = fixture.nativeElement;
    await fixture.whenStable();
  });

  it('до перших даних показує очікування і вимкнену кнопку', () => {
    expect(cells()).toEqual([['Waiting for the market data…']]);
    expect(button().disabled).toBe(true);
    expect(element.querySelector('.badge')!.textContent).toContain('Starting');
  });

  it('до першої угоди показує недоступні значення і нульовий обсяг', async () => {
    worker.emit({ type: 'snapshot', runId: 1, rows: [metricsRow('ALFA'), metricsRow('BETA')] });
    await fixture.whenStable();

    expect(cells()).toEqual([
      ['ALFA', '—', '—', '0', '—', '—'],
      ['BETA', '—', '—', '0', '—', '—'],
    ]);
  });

  it('показує метрики прикладу з ТЗ у форматі валюти і дисбалансу', async () => {
    worker.emit({
      type: 'snapshot',
      runId: 1,
      rows: [metricsRow('ALFA', { lastPriceCents: 10_200, spreadCents: 4, volume: 40, vwapCents: 10_150, imbalance: 0.2 })],
    });
    await fixture.whenStable();

    expect(cells()).toEqual([['ALFA', '$102.00', '$0.04', '40', '$101.50', '+0.20']]);
  });

  it('Pause і Resume керують запуском і показують статус', async () => {
    worker.emit({ type: 'status', runId: 1, status: 'running' });
    await fixture.whenStable();
    expect(button().textContent).toContain('Pause');

    button().click();
    expect(worker.sent.at(-1)).toEqual({ type: 'pause', runId: 1 });

    worker.emit({ type: 'status', runId: 1, status: 'paused' });
    await fixture.whenStable();
    expect(button().textContent).toContain('Resume');
    expect(element.querySelector('.badge')!.textContent).toContain('Paused');

    button().click();
    expect(worker.sent.at(-1)).toEqual({ type: 'resume', runId: 1 });
  });

  it('показує помилку ініціалізації', async () => {
    worker.emit({ type: 'error', runId: 1, message: 'Cannot initialize the market generator: HTTP 404' });
    await fixture.whenStable();

    expect(element.querySelector('[role="alert"]')!.textContent).toContain('HTTP 404');
    expect(element.querySelector('.badge')!.textContent).toContain('Error');
  });
});
