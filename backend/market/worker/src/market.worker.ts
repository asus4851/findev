/// <reference lib="webworker" />
// Точка входу Web Worker: створює MarketSimulation, передає йому команди з Angular і завантажує Wasm.
//
// Файл market_gen.wasm кладе поруч зі збіркою фронтенд (каталог wasm/), тому шлях
// рахується відносно адреси самого воркера і працює з будь-яким base href.
import type { ToWorkerMessage } from '../../contracts/protocol';
import { MarketSimulation } from './market-simulation';
import { fetchWasm } from './wasm/wasm-exports';

const worker = new MarketSimulation((message) => postMessage(message));

addEventListener('message', (event: MessageEvent<ToWorkerMessage>) => worker.handle(event.data));

void worker.load(() => fetchWasm(new URL('wasm/market_gen.wasm', self.location.href)));
