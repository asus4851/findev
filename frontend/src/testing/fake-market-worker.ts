import type { FromWorkerMessage, InstrumentMetrics, ToWorkerMessage } from '@backend/market';
import type { MarketWorker } from '../app/domains/market';

// Поддельный воркер: запоминает команды и позволяет тесту отправлять ответы «бэкенда».
export class FakeMarketWorker implements MarketWorker {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  readonly sent: ToWorkerMessage[] = [];
  terminated = false;

  postMessage(message: unknown): void {
    this.sent.push(message as ToWorkerMessage);
  }

  terminate(): void {
    this.terminated = true;
  }

  emit(message: FromWorkerMessage): void {
    this.onmessage?.({ data: message } as MessageEvent);
  }

  // runId последней команды start: так тест отвечает именно текущему запуску.
  get currentRunId(): number {
    const starts = this.sent.filter((m) => m.type === 'start');
    const last = starts.at(-1);
    return last && last.type === 'start' ? last.runId : 0;
  }
}

export function metricsRow(symbol: string, values: Partial<InstrumentMetrics> = {}): InstrumentMetrics {
  return {
    symbol,
    lastPriceCents: undefined,
    spreadCents: undefined,
    volume: 0,
    vwapCents: undefined,
    imbalance: undefined,
    ...values,
  };
}
