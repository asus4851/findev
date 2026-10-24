// Керування запуском у воркері: таймер, пауза, новий запуск і підрахунок метрик.
// Не залежить від глобального об'єкта воркера: повідомлення віддає через post,
// тому тестується з підробним генератором і підробними таймерами.
import type { FromWorkerMessage, SimulationSettings, ToWorkerMessage } from '../../contracts/protocol';
import { validateSimulationConfig } from '../../contracts/simulation-config';
import type { MarketGenerator } from './market-generator';
import { MetricsAggregator } from './metrics';
import { symbolsFor } from './symbols';

interface Run {
    runId: number;
    settings: SimulationSettings;
    aggregator: MetricsAggregator;
}

export class SimulationRuntime {
    private run: Run | undefined;
    private timer: ReturnType<typeof setInterval> | undefined;

    constructor(
        private readonly generator: MarketGenerator,
        private readonly post: (message: FromWorkerMessage) => void,
    ) {}

    handle(message: ToWorkerMessage): void {
        switch (message.type) {
            case 'start': return this.start(message.runId, message.settings, message.seed);
            case 'pause': return this.pause(message.runId);
            case 'resume': return this.resume(message.runId);
            case 'dispose': return this.dispose();
        }
    }

    // Новий запуск: стан попереднього повністю відкидається, генерація стартує навіть після паузи.
    private start(runId: number, settings: SimulationSettings, seed: number): void {
        this.stopTimer();
        this.run = undefined;

        const errors = validateSimulationConfig(settings);
        if (errors.length > 0) {
            this.post({ type: 'error', runId, message: errors.map((e) => e.message).join('; ') });
            return;
        }
        const wasmErrors = this.generator.init(settings, seed);
        if (wasmErrors !== 0) {
            this.post({ type: 'error', runId, message: `Market generator rejected the settings (error bits ${wasmErrors})` });
            return;
        }

        this.run = { runId, settings, aggregator: new MetricsAggregator(symbolsFor(settings.instrumentCount)) };
        // Перший знімок до будь-яких даних: недоступні значення і нульовий обсяг.
        this.post({ type: 'snapshot', runId, rows: this.run.aggregator.snapshot() });
        this.startTimer();
    }

    // Пауза зупиняє генерацію. Накопичені значення лишаються.
    private pause(runId: number): void {
        if (!this.isCurrent(runId) || this.timer === undefined) return;
        this.stopTimer();
        this.post({ type: 'status', runId, status: 'paused' });
    }

    // Відновлення продовжує з тих самих значень. Час паузи не догенеровується.
    private resume(runId: number): void {
        if (!this.isCurrent(runId) || this.timer !== undefined) return;
        this.startTimer();
    }

    private dispose(): void {
        this.stopTimer();
        this.run = undefined;
        this.generator.dispose();
    }

    // Команди для попереднього запуску ігноруються.
    private isCurrent(runId: number): boolean {
        return this.run !== undefined && this.run.runId === runId;
    }

    private startTimer(): void {
        const run = this.run!;
        this.timer = setInterval(() => this.tick(run), run.settings.batchIntervalMs);
        this.post({ type: 'status', runId: run.runId, status: 'running' });
    }

    private stopTimer(): void {
        if (this.timer !== undefined) clearInterval(this.timer);
        this.timer = undefined;
    }

    // Один батч: усі угоди потрапляють у метрики, екран отримує один знімок.
    private tick(run: Run): void {
        if (this.run !== run) return;
        run.aggregator.applyBuffer(this.generator.nextBatch());
        this.post({ type: 'snapshot', runId: run.runId, rows: run.aggregator.snapshot() });
    }
}
