import { TestBed } from '@angular/core/testing';
import { FakeMarketWorker, metricsRow } from '../../../../testing/fake-market-worker';
import { MarketSession } from './market-session.service';
import { MARKET_WORKER_FACTORY } from '../tokens/market-worker.token';

const defaults = { instrumentCount: 5, updatesPerBatch: 100, batchIntervalMs: 500 };

describe('MarketSession', () => {
  let worker: FakeMarketWorker;
  let workersCreated: number;
  let session: MarketSession;

  beforeEach(() => {
    worker = new FakeMarketWorker();
    workersCreated = 0;
    TestBed.configureTestingModule({
      providers: [{ provide: MARKET_WORKER_FACTORY, useValue: () => (workersCreated++, worker) }],
    });
    session = TestBed.inject(MarketSession);
  });

  describe('старт', () => {
    it('запускає воркер з налаштуваннями за замовчуванням', () => {
      session.start();

      expect(worker.sent).toEqual([
        { type: 'start', runId: 1, settings: defaults, seed: expect.any(Number) },
      ]);
      expect(session.state()).toBe('starting');
      expect(session.settings()).toEqual(defaults);
    });

    it('повторний старт не створює другого воркера і другого запуску', () => {
      session.start();
      session.start();

      expect(workersCreated).toBe(1);
      expect(worker.sent).toHaveLength(1);
    });
  });

  describe('дані з воркера', () => {
    beforeEach(() => session.start());

    it('показує знімок і статус поточного запуску', () => {
      worker.emit({ type: 'snapshot', runId: 1, rows: [metricsRow('ALFA', { volume: 40 })] });
      worker.emit({ type: 'status', runId: 1, status: 'running' });

      expect(session.rows()).toEqual([metricsRow('ALFA', { volume: 40 })]);
      expect(session.state()).toBe('running');
    });

    it('показує помилку ініціалізації', () => {
      worker.emit({ type: 'error', runId: 1, message: 'Cannot initialize the market generator: HTTP 404' });

      expect(session.state()).toBe('error');
      expect(session.error()).toBe('Cannot initialize the market generator: HTTP 404');
    });
  });

  describe('Apply', () => {
    beforeEach(() => {
      session.start();
      worker.emit({ type: 'snapshot', runId: 1, rows: [metricsRow('ALFA', { volume: 40, lastPriceCents: 10_200 })] });
      worker.emit({ type: 'status', runId: 1, status: 'running' });
    });

    it('починає новий запуск з новими налаштуваннями і очищає значення попереднього', () => {
      const next = { instrumentCount: 3, updatesPerBatch: 50, batchIntervalMs: 200 };
      session.apply(next);

      expect(worker.sent.at(-1)).toEqual({ type: 'start', runId: 2, settings: next, seed: expect.any(Number) });
      expect(session.settings()).toEqual(next);
      expect(session.rows()).toEqual([]);
      expect(session.state()).toBe('starting');
      expect(workersCreated).toBe(1);
    });

    it('стартує новий запуск і тоді, коли попередній був на паузі', () => {
      session.pause();
      worker.emit({ type: 'status', runId: 1, status: 'paused' });

      session.apply(defaults);

      expect(worker.sent.at(-1)).toMatchObject({ type: 'start', runId: 2 });
    });

    it('відкидає результати попереднього запуску', () => {
      session.apply(defaults);

      // Повідомлення старого запуску ще були в черзі воркера.
      worker.emit({ type: 'snapshot', runId: 1, rows: [metricsRow('ALFA', { volume: 999 })] });
      worker.emit({ type: 'status', runId: 1, status: 'paused' });
      worker.emit({ type: 'error', runId: 1, message: 'stale' });

      expect(session.rows()).toEqual([]);
      expect(session.state()).toBe('starting');
      expect(session.error()).toBeUndefined();

      worker.emit({ type: 'snapshot', runId: 2, rows: [metricsRow('ALFA')] });
      expect(session.rows()).toEqual([metricsRow('ALFA')]);
    });

    it('копіює налаштування, тож зміни переданого об\'єкта не впливають на запуск', () => {
      const next = { ...defaults };
      session.apply(next);
      next.instrumentCount = 50;

      expect(session.settings().instrumentCount).toBe(5);
    });
  });

  describe('Pause і Resume', () => {
    beforeEach(() => session.start());

    it('надсилають команду поточного запуску лише у відповідному стані', () => {
      session.pause(); // ще starting: нічого
      expect(worker.sent).toHaveLength(1);

      worker.emit({ type: 'status', runId: 1, status: 'running' });
      session.resume(); // не на паузі: нічого
      session.pause();
      expect(worker.sent.at(-1)).toEqual({ type: 'pause', runId: 1 });

      worker.emit({ type: 'status', runId: 1, status: 'paused' });
      session.resume();
      expect(worker.sent.at(-1)).toEqual({ type: 'resume', runId: 1 });
      expect(worker.sent).toHaveLength(3);
    });

    it('пауза не очищає значення', () => {
      worker.emit({ type: 'status', runId: 1, status: 'running' });
      worker.emit({ type: 'snapshot', runId: 1, rows: [metricsRow('ALFA', { volume: 40 })] });
      session.pause();
      worker.emit({ type: 'status', runId: 1, status: 'paused' });

      expect(session.rows()).toEqual([metricsRow('ALFA', { volume: 40 })]);
      expect(session.state()).toBe('paused');
    });
  });

  describe('помилки і звільнення ресурсів', () => {
    it('показує зрозумілу помилку, якщо воркер не вдалося створити', () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [{ provide: MARKET_WORKER_FACTORY, useValue: () => { throw new Error('Workers are not supported'); } }],
      });
      const failing = TestBed.inject(MarketSession);

      failing.start();

      expect(failing.state()).toBe('error');
      expect(failing.error()).toBe('Cannot start the market worker: Workers are not supported');
    });

    it('показує помилку, якщо воркер упав', () => {
      session.start();
      worker.onerror?.({ message: 'Script error' } as ErrorEvent);

      expect(session.state()).toBe('error');
      expect(session.error()).toBe('Market worker failed: Script error');
    });

    it('звільняє воркер, коли застосунок знищується', () => {
      session.start();
      TestBed.resetTestingModule();

      expect(worker.sent.at(-1)).toEqual({ type: 'dispose' });
      expect(worker.terminated).toBe(true);
    });
  });
});
