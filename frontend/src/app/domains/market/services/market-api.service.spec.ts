import { TestBed } from '@angular/core/testing';
import type { FromWorkerMessage } from '@backend/market';
import { FakeMarketWorker, metricsRow } from '../../../../testing/fake-market-worker';
import { MARKET_WORKER_FACTORY } from '../tokens/market-worker.token';
import { MarketApiService } from './market-api.service';

const settings = { instrumentCount: 5, updatesPerBatch: 100, batchIntervalMs: 500 };

describe('MarketApiService', () => {
  let worker: FakeMarketWorker;
  let workersCreated: number;
  let api: MarketApiService;
  let received: FromWorkerMessage[];

  beforeEach(() => {
    worker = new FakeMarketWorker();
    workersCreated = 0;
    received = [];
    TestBed.configureTestingModule({
      providers: [{ provide: MARKET_WORKER_FACTORY, useValue: () => (workersCreated++, worker) }],
    });
    api = TestBed.inject(MarketApiService);
    api.messages$.subscribe((message) => received.push(message));
  });

  describe('команды', () => {
    it('start создаёт воркер и отправляет ему команду', () => {
      api.start(1, settings, 42);

      expect(workersCreated).toBe(1);
      expect(worker.sent).toEqual([{ type: 'start', runId: 1, settings, seed: 42 }]);
    });

    it('воркер создаётся один раз и используется повторно', () => {
      api.start(1, settings, 1);
      api.start(2, settings, 2);

      expect(workersCreated).toBe(1);
      expect(worker.sent.map((m) => m.type)).toEqual(['start', 'start']);
    });

    it('pause, resume и setRefresh уходят воркеру как есть', () => {
      api.start(1, settings, 1);
      api.pause(1);
      api.resume(1);
      api.setRefresh(1_000);

      expect(worker.sent.slice(1)).toEqual([
        { type: 'pause', runId: 1 },
        { type: 'resume', runId: 1 },
        { type: 'setRefresh', refreshMs: 1_000 },
      ]);
    });

    it('частота, выбранная до создания воркера, отправляется сразу после создания, до start', () => {
      api.setRefresh(5_000);
      api.start(1, settings, 1);

      expect(worker.sent.map((m) => m.type)).toEqual(['setRefresh', 'start']);
      expect(worker.sent[0]).toEqual({ type: 'setRefresh', refreshMs: 5_000 });
    });

    it('команды без воркера ничего не делают и не создают его', () => {
      api.pause(1);
      api.resume(1);

      expect(workersCreated).toBe(0);
    });
  });

  describe('ответы', () => {
    it('сообщения воркера приходят потоком messages$ без изменений', () => {
      api.start(1, settings, 1);
      worker.emit({ type: 'snapshot', runId: 1, rows: [metricsRow('ALFA', { volume: 40 })] });
      worker.emit({ type: 'status', runId: 1, status: 'running' });

      expect(received).toEqual([
        { type: 'snapshot', runId: 1, rows: [metricsRow('ALFA', { volume: 40 })] },
        { type: 'status', runId: 1, status: 'running' },
      ]);
    });
  });

  describe('ошибки', () => {
    it('понятная ошибка, если воркер не удалось создать, привязана к запуску', () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [{ provide: MARKET_WORKER_FACTORY, useValue: () => { throw new Error('Workers are not supported'); } }],
      });
      const failing = TestBed.inject(MarketApiService);
      const errors: FromWorkerMessage[] = [];
      failing.messages$.subscribe((message) => errors.push(message));

      failing.start(7, settings, 1);

      expect(errors).toEqual([
        { type: 'error', runId: 7, message: 'Cannot start the market worker: Workers are not supported' },
      ]);
    });

    it('ошибка упавшего воркера привязывается к последнему запуску', () => {
      api.start(3, settings, 1);
      worker.onerror?.({ message: 'Script error' } as ErrorEvent);

      expect(received).toEqual([{ type: 'error', runId: 3, message: 'Market worker failed: Script error' }]);
    });

    it('упавший воркер без сообщения получает понятный текст', () => {
      api.start(1, settings, 1);
      worker.onerror?.({ message: '' } as ErrorEvent);

      expect(received[0]).toMatchObject({ message: 'Market worker failed: unknown error' });
    });
  });

  describe('освобождение ресурсов', () => {
    it('dispose отправляет команду, останавливает воркер и завершает поток', () => {
      let completed = false;
      api.messages$.subscribe({ complete: () => (completed = true) });
      api.start(1, settings, 1);

      api.dispose();

      expect(worker.sent.at(-1)).toEqual({ type: 'dispose' });
      expect(worker.terminated).toBe(true);
      expect(completed).toBe(true);
    });

    it('воркер освобождается, когда приложение уничтожается', () => {
      api.start(1, settings, 1);
      TestBed.resetTestingModule();

      expect(worker.sent.at(-1)).toEqual({ type: 'dispose' });
      expect(worker.terminated).toBe(true);
    });
  });
});
