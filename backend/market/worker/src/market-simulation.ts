// Логіка воркера: запускає і зупиняє Wasm-генератор, отримує від нього батчі і надсилає знімки.
// Метрики рахує MarketData, тут лише керування: завантаження Wasm, таймер, команди.
//
// Клас не залежить від глобального об'єкта воркера: повідомлення віддає через post,
// а Wasm отримує через функцію завантаження. Тому в тестах його створюють з підробками.
import { BehaviorSubject, Subject, asyncScheduler, switchMap, throttleTime } from 'rxjs';
import type { FromWorkerMessage, SimulationSettings, ToWorkerMessage } from '../../contracts/protocol';
import { REFRESH_DEFAULT_MS, REFRESH_UNLIMITED } from '../../contracts/refresh-rate';
import { MarketData } from './metrics/market-data';
import { FIELDS } from './wasm/buffer-format';
import { describeInitErrors } from './wasm/init-errors';
import type { WasmExports } from './wasm/wasm-exports';

export class MarketSimulation {
    private readonly post: (message: FromWorkerMessage) => void;

    // ── Стан ────────────────────────────────────────────────────────

    private wasm: WasmExports | null = null;
    // Команди, що прийшли до завершення завантаження Wasm, виконуються після нього.
    private readonly pending: ToWorkerMessage[] = [];
    // Текст помилки завантаження. Після неї кожен новий start отримує цю помилку.
    private failure: string | null = null;

    // Поточний запуск. runId ідентифікує його, щоб Angular відкидав відповіді старого.
    private runId: number = 0;
    private settings: SimulationSettings | null = null;
    private data: MarketData | null = null;
    // Таймер генерації. null означає, що Wasm зупинено.
    private timer: ReturnType<typeof setInterval> | null = null;
    // Є угоди, яких Angular ще не бачив у знімку.
    private changed: boolean = false;

    // Частота знімків для Angular. Не належить запуску: обрана частота діє і для наступних.
    private readonly refreshMs$ = new BehaviorSubject<number>(REFRESH_DEFAULT_MS);
    // Подія на кожен оброблений батч: за нею надсилається знімок.
    private readonly batch$ = new Subject<void>();

    // Кожен батч одразу йде в метрики, а знімок надсилається не частіше за refreshMs.
    // leading: знімок іде одразу з першим батчем вікна; trailing: найсвіжіші угоди
    // не застрягають, а йдуть наприкінці вікна. Без обмеження знімок іде після кожного батча.
    constructor(post: (message: FromWorkerMessage) => void) {
        this.post = post;
        this.refreshMs$
            .pipe(
                switchMap((refreshMs) => refreshMs === REFRESH_UNLIMITED
                    ? this.batch$
                    : this.batch$.pipe(throttleTime(refreshMs, asyncScheduler, { leading: true, trailing: true }))),
            )
            .subscribe(() => this.flush());
    }

    // ── Команди з Angular ───────────────────────────────────────────

    handle(message: ToWorkerMessage): void {
        const wasm = this.wasm;
        if (wasm === null) {
            if (this.failure === null) {
                this.pending.push(message);
            } else if (message.type === 'start') {
                this.post({ type: 'error', runId: message.runId, message: this.failure });
            }
            return;
        }

        switch (message.type) {
            case 'start':
                this.start(wasm, message.runId, message.settings, message.seed);
                break;
            case 'pause':
                if (message.runId === this.runId) {
                    this.flush();
                    this.stop();
                }
                break;
            case 'resume':
                if (message.runId === this.runId) this.run(wasm);
                break;
            case 'setRefresh':
                this.setRefresh(message.refreshMs);
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
        // Стан попереднього запуску відкидається одразу: після помилки init він не має ожити.
        this.settings = null;
        this.data = null;

        const errors = wasm.init(settings.instrumentCount, settings.updatesPerBatch, settings.batchIntervalMs, seed >>> 0);
        if (errors !== 0) {
            this.post({ type: 'error', runId, message: describeInitErrors(errors) });
            return;
        }

        this.settings = settings;
        this.data = new MarketData(settings.instrumentCount);
        this.sendSnapshot();
        this.run(wasm);
    }

    // ── Генерація ───────────────────────────────────────────────────

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

    // Отримує батч від Wasm: усі угоди одразу потрапляють у метрики, незалежно від частоти знімків.
    // Int32Array лише дивиться в пам'ять Wasm, без копіювання.
    private tick(wasm: WasmExports): void {
        const pointer = wasm.nextBatch();
        if (pointer === 0 || this.settings === null || this.data === null) return;

        this.data.applyBatch(new Int32Array(wasm.memory.buffer, pointer, this.settings.updatesPerBatch * FIELDS));
        this.changed = true;
        this.batch$.next();
    }

    // ── Знімки для Angular ──────────────────────────────────────────

    // Нова частота діє з наступного батча, без нового запуску. Генерацію і метрики не змінює.
    private setRefresh(refreshMs: number): void {
        if (!Number.isInteger(refreshMs) || refreshMs < 0) return;
        this.refreshMs$.next(refreshMs);
    }

    // Надсилає знімок, лише якщо з минулого були нові угоди.
    private flush(): void {
        if (this.changed) this.sendSnapshot();
    }

    private sendSnapshot(): void {
        if (this.data === null) return;
        this.changed = false;
        this.post({ type: 'snapshot', runId: this.runId, rows: this.data.snapshot() });
    }

    // ── Завантаження Wasm ───────────────────────────────────────────

    // Після завантаження виконує команди, що чекали в черзі.
    // Якщо Wasm не вдалося завантажити, повідомляє Angular про помилку запуску, який чекав.
    async load(instantiate: () => Promise<WasmExports>): Promise<void> {
        try {
            this.wasm = await instantiate();
        } catch (error) {
            const reason = error instanceof Error ? error.message : String(error);
            this.failure = `Cannot initialize the market generator: ${reason}`;
            this.post({ type: 'error', runId: this.pendingRunId(), message: this.failure });
            this.pending.length = 0;
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
