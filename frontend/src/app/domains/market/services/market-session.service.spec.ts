import { TestBed } from '@angular/core/testing';
import { REFRESH_DEFAULT_MS } from '@backend/market';
import { FakeMarketApi } from '../../../../testing/fake-market-api';
import { metricsRow } from '../../../../testing/fake-market-worker';
import { MarketApiService } from './market-api.service';
import { MarketSessionService } from './market-session.service';

const defaults = { instrumentCount: 5, updatesPerBatch: 100, batchIntervalMs: 500 };

describe('MarketSessionService', () => {
  let api: FakeMarketApi;
  let session: MarketSessionService;

  beforeEach(() => {
    api = new FakeMarketApi();
    TestBed.configureTestingModule({ providers: [{ provide: MarketApiService, useValue: api }] });
    session = TestBed.inject(MarketSessionService);
  });

  describe('старт', () => {
    it('запускает бэкенд с настройками по умолчанию', () => {
      session.start();

      expect(api.starts).toEqual([{ runId: 1, settings: defaults, seed: expect.any(Number) }]);
      expect(session.state()).toBe('starting');
      expect(session.settings()).toEqual(defaults);
    });

    it('повторный старт не создаёт второго запуска', () => {
      session.start();
      session.start();

      expect(api.starts).toHaveLength(1);
    });
  });

  describe('данные с бэкенда', () => {
    beforeEach(() => session.start());

    it('показывает снимок и статус текущего запуска', () => {
      api.emit({ type: 'snapshot', runId: 1, rows: [metricsRow('ALFA', { volume: 40 })] });
      api.emit({ type: 'status', runId: 1, status: 'running' });

      expect(session.rows()).toEqual([metricsRow('ALFA', { volume: 40 })]);
      expect(session.state()).toBe('running');
    });

    it('показывает ошибку инициализации', () => {
      api.emit({ type: 'error', runId: 1, message: 'Cannot initialize the market generator: HTTP 404' });

      expect(session.state()).toBe('error');
      expect(session.error()).toBe('Cannot initialize the market generator: HTTP 404');
    });
  });

  describe('Apply', () => {
    beforeEach(() => {
      session.start();
      api.emit({ type: 'snapshot', runId: 1, rows: [metricsRow('ALFA', { volume: 40, lastPriceCents: 10_200 })] });
      api.emit({ type: 'status', runId: 1, status: 'running' });
    });

    it('начинает новый запуск с новыми настройками и очищает значения предыдущего', () => {
      const next = { instrumentCount: 3, updatesPerBatch: 50, batchIntervalMs: 200 };
      session.apply(next);

      expect(api.starts.at(-1)).toEqual({ runId: 2, settings: next, seed: expect.any(Number) });
      expect(session.settings()).toEqual(next);
      expect(session.rows()).toEqual([]);
      expect(session.state()).toBe('starting');
    });

    it('стартует новый запуск и тогда, когда предыдущий был на паузе', () => {
      session.pause();
      api.emit({ type: 'status', runId: 1, status: 'paused' });

      session.apply(defaults);

      expect(api.starts.at(-1)).toMatchObject({ runId: 2 });
    });

    it('отбрасывает результаты предыдущего запуска', () => {
      session.apply(defaults);

      // Сообщения старого запуска ещё были в очереди воркера.
      api.emit({ type: 'snapshot', runId: 1, rows: [metricsRow('ALFA', { volume: 999 })] });
      api.emit({ type: 'status', runId: 1, status: 'paused' });
      api.emit({ type: 'error', runId: 1, message: 'stale' });

      expect(session.rows()).toEqual([]);
      expect(session.state()).toBe('starting');
      expect(session.error()).toBeUndefined();

      api.emit({ type: 'snapshot', runId: 2, rows: [metricsRow('ALFA')] });
      expect(session.rows()).toEqual([metricsRow('ALFA')]);
    });

    it('копирует настройки, поэтому изменения переданного объекта не влияют на запуск', () => {
      const next = { ...defaults };
      session.apply(next);
      next.instrumentCount = 50;

      expect(session.settings().instrumentCount).toBe(5);
    });
  });

  describe('Pause и Resume', () => {
    beforeEach(() => session.start());

    it('отправляют команду текущего запуска только в соответствующем состоянии', () => {
      session.pause(); // ещё starting: ничего
      expect(api.pauses).toEqual([]);

      api.emit({ type: 'status', runId: 1, status: 'running' });
      session.resume(); // не на паузе: ничего
      session.pause();
      expect(api.pauses).toEqual([1]);
      expect(api.resumes).toEqual([]);

      api.emit({ type: 'status', runId: 1, status: 'paused' });
      session.resume();
      expect(api.resumes).toEqual([1]);
    });

    it('пауза не очищает значения', () => {
      api.emit({ type: 'status', runId: 1, status: 'running' });
      api.emit({ type: 'snapshot', runId: 1, rows: [metricsRow('ALFA', { volume: 40 })] });
      session.pause();
      api.emit({ type: 'status', runId: 1, status: 'paused' });

      expect(session.rows()).toEqual([metricsRow('ALFA', { volume: 40 })]);
      expect(session.state()).toBe('paused');
    });
  });

  describe('частота обновления таблицы', () => {
    it('по умолчанию 0,5 с и ничего не отправляет бэкенду', () => {
      session.start();

      expect(session.refreshMs()).toBe(REFRESH_DEFAULT_MS);
      expect(api.refreshes).toEqual([]);
    });

    it('новая частота уходит на бэкенд без нового запуска и без очистки значений', () => {
      session.start();
      api.emit({ type: 'snapshot', runId: 1, rows: [metricsRow('ALFA', { volume: 40 })] });

      session.setRefresh(0);

      expect(api.refreshes).toEqual([0]);
      expect(api.starts).toHaveLength(1);
      expect(session.rows()).toEqual([metricsRow('ALFA', { volume: 40 })]);
      expect(session.refreshMs()).toBe(0);
    });

    it('та же частота повторно не отправляется', () => {
      session.setRefresh(REFRESH_DEFAULT_MS);

      expect(api.refreshes).toEqual([]);
    });
  });
});
