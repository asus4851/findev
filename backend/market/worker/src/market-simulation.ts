// Логика воркера: запускает и останавливает Wasm-генератор, получает от него батчи и отправляет снимки.
// Метрики считает MarketData, здесь только управление: загрузка Wasm, таймер, команды.
//
// Класс не зависит от глобального объекта воркера: сообщения отдаёт через post,
// а Wasm получает через функцию загрузки. Поэтому в тестах его создают с подделками.
import { BehaviorSubject, Subject, asyncScheduler, switchMap, throttleTime } from 'rxjs';
import type { FromWorkerMessage, SimulationSettings, ToWorkerMessage } from '../../contracts/protocol';
import { REFRESH_DEFAULT_MS, REFRESH_UNLIMITED } from '../../contracts/refresh-rate';
import { MarketData } from './metrics/market-data';
import { FIELDS } from './wasm/buffer-format';
import { describeInitErrors } from './wasm/init-errors';
import type { WasmExports } from './wasm/wasm-exports';

export class MarketSimulation {
    private readonly post: (message: FromWorkerMessage) => void;

    // ── Состояние ───────────────────────────────────────────────────

    private wasm: WasmExports | null = null;
    // Команды, пришедшие до окончания загрузки Wasm, выполняются после неё.
    private readonly pending: ToWorkerMessage[] = [];
    // Текст ошибки загрузки. После неё каждый новый start получает эту ошибку.
    private failure: string | null = null;

    // Текущий запуск. runId идентифицирует его, чтобы Angular отбрасывал ответы старого.
    private runId: number = 0;
    private settings: SimulationSettings | null = null;
    private data: MarketData | null = null;
    // Таймер генерации. null означает, что Wasm остановлен.
    private timer: ReturnType<typeof setInterval> | null = null;
    // Есть сделки, которых Angular ещё не видел в снимке.
    private changed: boolean = false;

    // Частота снимков для Angular. Не принадлежит запуску: выбранная частота действует и для следующих.
    private readonly refreshMs$ = new BehaviorSubject<number>(REFRESH_DEFAULT_MS);
    // Событие на каждый обработанный батч: по нему отправляется снимок.
    private readonly batch$ = new Subject<void>();

    // Каждый батч сразу идёт в метрики, а снимок отправляется не чаще refreshMs.
    // leading: снимок уходит сразу с первым батчем окна; trailing: самые свежие сделки
    // не застревают, а уходят в конце окна. Без ограничения снимок уходит после каждого батча.
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

    // ── Команды из Angular ──────────────────────────────────────────

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

    // Новый запуск: Wasm сбрасывает всё предыдущее состояние, метрики начинаются с нуля.
    private start(wasm: WasmExports, runId: number, settings: SimulationSettings, seed: number): void {
        this.stop();
        this.runId = runId;
        // Состояние предыдущего запуска отбрасывается сразу: после ошибки init оно не должно ожить.
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

    // ── Генерация ───────────────────────────────────────────────────

    // Запускает таймер: на каждый тик Wasm генерирует один батч.
    private run(wasm: WasmExports): void {
        if (this.settings === null || this.timer !== null) return;
        this.timer = setInterval(() => this.tick(wasm), this.settings.batchIntervalMs);
        this.post({ type: 'status', runId: this.runId, status: 'running' });
    }

    // Останавливает Wasm: новые батчи не генерируются, накопленные значения остаются.
    private stop(): void {
        if (this.timer === null) return;
        clearInterval(this.timer);
        this.timer = null;
        this.post({ type: 'status', runId: this.runId, status: 'paused' });
    }

    // Получает батч от Wasm: все сделки сразу попадают в метрики, независимо от частоты снимков.
    // Int32Array лишь смотрит в память Wasm, без копирования.
    private tick(wasm: WasmExports): void {
        const pointer = wasm.nextBatch();
        if (pointer === 0 || this.settings === null || this.data === null) return;

        this.data.applyBatch(new Int32Array(wasm.memory.buffer, pointer, this.settings.updatesPerBatch * FIELDS));
        this.changed = true;
        this.batch$.next();
    }

    // ── Снимки для Angular ──────────────────────────────────────────

    // Новая частота действует со следующего батча, без нового запуска. Генерацию и метрики не меняет.
    private setRefresh(refreshMs: number): void {
        if (!Number.isInteger(refreshMs) || refreshMs < 0) return;
        this.refreshMs$.next(refreshMs);
    }

    // Отправляет снимок, только если с прошлого были новые сделки.
    private flush(): void {
        if (this.changed) this.sendSnapshot();
    }

    private sendSnapshot(): void {
        if (this.data === null) return;
        this.changed = false;
        this.post({ type: 'snapshot', runId: this.runId, rows: this.data.snapshot() });
    }

    // ── Загрузка Wasm ───────────────────────────────────────────────

    // После загрузки выполняет команды, ждавшие в очереди.
    // Если Wasm не удалось загрузить, сообщает Angular об ошибке запуска, который ждал.
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

    // runId запуска, который ждал загрузки: ошибку Angular должен привязать к своему запуску.
    private pendingRunId(): number {
        for (let i = this.pending.length - 1; i >= 0; i--) {
            const message = this.pending[i];
            if (message.type === 'start') return message.runId;
        }
        return 0;
    }
}
