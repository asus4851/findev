/// <reference lib="webworker" />
// Точка входу Web Worker. Завантажує Wasm-генератор і передає команди в SimulationRuntime.
//
// Файл market_gen.wasm кладе поруч зі збіркою фронтенд (каталог wasm/), тому шлях
// рахується відносно адреси самого воркера і працює з будь-яким base href.
import type { FromWorkerMessage, ToWorkerMessage } from '../../contracts/protocol';
import { WasmMarketGenerator } from './market-generator';
import { SimulationRuntime } from './simulation-runtime';

const post = (message: FromWorkerMessage) => postMessage(message);

// Команди, що прийшли до завершення завантаження Wasm, виконуються після нього.
const pending: ToWorkerMessage[] = [];
let runtime: SimulationRuntime | undefined;
let failure: string | undefined;

function lastRunId(): number {
    const start = [...pending].reverse().find((m) => m.type === 'start');
    return start && 'runId' in start ? start.runId : 0;
}

addEventListener('message', ({ data }: MessageEvent<ToWorkerMessage>) => {
    if (runtime) {
        runtime.handle(data);
    } else if (failure && data.type === 'start') {
        post({ type: 'error', runId: data.runId, message: failure });
    } else {
        pending.push(data);
    }
});

WasmMarketGenerator.load(new URL('wasm/market_gen.wasm', self.location.href))
    .then((generator) => {
        runtime = new SimulationRuntime(generator, post);
        pending.splice(0).forEach((message) => runtime!.handle(message));
    })
    .catch((error: unknown) => {
        failure = `Cannot initialize the market generator: ${error instanceof Error ? error.message : String(error)}`;
        post({ type: 'error', runId: lastRunId(), message: failure });
    });
