/// <reference lib="webworker" />
// Найпростіший воркер: запускає і зупиняє Wasm-генератор і отримує від нього дані.
// Метрики рахує MarketData, тут лише керування: завантаження Wasm, таймер, команди.
//
// Файл market_gen.wasm кладе поруч зі збіркою фронтенд (каталог wasm/), тому шлях
// рахується відносно адреси самого воркера і працює з будь-яким base href.
import type { FromWorkerMessage, SimulationSettings, ToWorkerMessage } from '../../contracts/protocol';
import { FIELDS, MarketData } from './market-data';

// Функції, які експортує ../../market-gen-as/assembly/index.ts.
interface WasmExports {
    memory: WebAssembly.Memory;
    FIELDS: WebAssembly.Global;
    init(instrumentCount: number, updatesPerBatch: number, batchIntervalMs: number, seed: number): number;
    // Вказівник на буфер батча або 0. Буфер дійсний до наступного виклику.
    nextBatch(): number;
    dispose(): void;
}

class MarketWorker {
    private readonly post: (message: FromWorkerMessage) => void;

    // ── Стан ─────────────────────────────────────────────────────────

    private wasm: WasmExports | null = null;
    // Команди, що прийшли до завершення завантаження Wasm, виконуються після нього.
    private readonly pending: ToWorkerMessage[] = [];

    // Поточний запуск. runId ідентифікує його, щоб Angular відкидав відповіді старого.
    private runId: number = 0;
    private settings: SimulationSettings | null = null;
    private data: MarketData | null = null;
    // Таймер генерації. null означає, що Wasm зупинено.
    private timer: ReturnType<typeof setInterval> | null = null;

    constructor(post: (message: FromWorkerMessage) => void) {
        this.post = post;
    }

    // ── Команди з Angular ────────────────────────────────────────────

    handle(message: ToWorkerMessage): void {
        const wasm = this.wasm;
        if (wasm === null) {
            this.pending.push(message);
            return;
        }

        switch (message.type) {
            case 'start':
                this.start(wasm, message.runId, message.settings, message.seed);
                break;
            case 'pause':
                if (message.runId === this.runId) this.stop();
                break;
            case 'resume':
                if (message.runId === this.runId) this.run(wasm);
                break;
            case 'dispose':
                this.stop();
                wasm.dispose();
                break;
        }
    }

    // Новий запуск: Wasm скидає весь попередній стан, метрики починаються з нуля.
    private start(wasm: WasmExports, runId: number, settings: SimulationSettings, seed: number): void {
        this.stop();
        this.runId = runId;

        const errors = wasm.init(settings.instrumentCount, settings.updatesPerBatch, settings.batchIntervalMs, seed >>> 0);
        if (errors !== 0) {
            this.post({ type: 'error', runId, message: `Wasm rejected the settings (error bits ${errors})` });
            return;
        }

        this.settings = settings;
        this.data = new MarketData(settings.instrumentCount);
        this.post({ type: 'snapshot', runId, rows: this.data.snapshot() });
        this.run(wasm);
    }

    // ── Генерація ────────────────────────────────────────────────────

    // Запускає таймер: на кожен тік Wasm генерує один батч.
    private run(wasm: WasmExports): void {
        if (this.settings === null || this.timer !== null) return;
        this.timer = setInterval(() => this.tick(wasm), this.settings.batchIntervalMs);
        this.post({ type: 'status', runId: this.runId, status: 'running' });
    }

    // Зупиняє Wasm: нові батчі не генеруються, накопичені значення лишаються.
    private stop(): void {
        if (this.timer === null) return;
        clearInterval(this.timer);
        this.timer = null;
        this.post({ type: 'status', runId: this.runId, status: 'paused' });
    }

    // Отримує батч від Wasm і віддає Angular свіжі метрики.
    // Int32Array лише дивиться в пам'ять Wasm, без копіювання.
    private tick(wasm: WasmExports): void {
        const pointer = wasm.nextBatch();
        if (pointer === 0 || this.settings === null || this.data === null) return;

        this.data.applyBatch(new Int32Array(wasm.memory.buffer, pointer, this.settings.updatesPerBatch * FIELDS));
        this.post({ type: 'snapshot', runId: this.runId, rows: this.data.snapshot() });
    }

    // ── Завантаження Wasm ────────────────────────────────────────────

    // Після завантаження виконує команди, що чекали в черзі.
    // Якщо файл недоступний, повідомляє Angular про помилку запуску, який чекав.
    async load(url: URL): Promise<void> {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status} while loading ${String(url)}`);
            }
            const { instance } = await WebAssembly.instantiate(await response.arrayBuffer(), {});
            this.wasm = instance.exports as unknown as WasmExports;
        } catch (error) {
            const reason = error instanceof Error ? error.message : String(error);
            this.post({
                type: 'error',
                runId: this.pendingRunId(),
                message: `Cannot initialize the market generator: ${reason}`,
            });
            return;
        }

        for (const message of this.pending.splice(0)) {
            this.handle(message);
        }
    }

    // runId запуску, який чекав завантаження: помилку Angular має прив'язати до свого запуску.
    private pendingRunId(): number {
        for (let i = this.pending.length - 1; i >= 0; i--) {
            const message = this.pending[i];
            if (message.type === 'start') return message.runId;
        }
        return 0;
    }
}

// ── Точка входу ──────────────────────────────────────────────────────

const worker = new MarketWorker((message) => postMessage(message));

addEventListener('message', (event: MessageEvent<ToWorkerMessage>) => worker.handle(event.data));

void worker.load(new URL('wasm/market_gen.wasm', self.location.href));
