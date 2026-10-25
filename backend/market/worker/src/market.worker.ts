/// <reference lib="webworker" />
// Точка входа Web Worker: создаёт MarketSimulation, передаёт ему команды из Angular и загружает Wasm.
//
// Файл market_gen.wasm кладёт рядом со сборкой фронтенд (каталог wasm/), поэтому путь
// считается относительно адреса самого воркера и работает с любым base href.
import type { ToWorkerMessage } from '../../contracts/protocol';
import { MarketSimulation } from './market-simulation';
import { fetchWasm } from './wasm/wasm-exports';

const worker = new MarketSimulation((message) => postMessage(message));

addEventListener('message', (event: MessageEvent<ToWorkerMessage>) => worker.handle(event.data));

void worker.load(() => fetchWasm(new URL('wasm/market_gen.wasm', self.location.href)));
