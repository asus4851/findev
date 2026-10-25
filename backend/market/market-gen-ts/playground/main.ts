// Песочница: запускает Wasm-генератор из ../market-gen-as и рисует цены выбранного инструмента.
// Страница ведёт себя как воркер: проверяет настройки, вызывает init в Wasm
// и по таймеру забирает батчи через nextBatch. Сам генератор полностью работает в Wasm.
// Ось X — номер сделки инструмента, а не реальное время: так видна каждая сделка отдельно.
import {
    createChart,
    LineSeries,
    LineType,
    type ISeriesApi,
    type Time,
    type UTCTimestamp,
} from 'lightweight-charts';
import { SimulationConfig, validateSimulationConfig } from '../src/config/simulation-config';
import type { MarketUpdate } from '../src/model/market-update';
import { WasmGenerator } from './wasm-generator';

// Сколько последних сделок каждого инструмента держать для графика.
const HISTORY_LIMIT = 3_000;

interface Point { n: number; price: number; bid: number; ask: number }

interface InstrumentStats {
    trades: number;
    volume: number;
    notional: number;   // Σ цена × количество, для VWAP
    priceMoves: number; // сколько раз уровень исчерпан и цена сдвинулась
    last?: MarketUpdate;
    history: Point[];
}

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const numberInput = (id: string) => Number($<HTMLInputElement>(id).value);
const dollars = (cents: number) => `$${(cents / 100).toFixed(2)}`;

// ── График ───────────────────────────────────────────────────────────

const chart = createChart($('chart'), {
    autoSize: true,
    layout: { background: { color: '#ffffff' }, textColor: '#5d6673' },
    grid: { vertLines: { color: '#eef0f3' }, horzLines: { color: '#eef0f3' } },
    timeScale: { tickMarkFormatter: (time: Time) => `#${time}` },
    localization: { timeFormatter: (time: Time) => `сделка #${time}` },
});

const priceFormat = { type: 'price' as const, precision: 2, minMove: 0.01 };
const askSeries = chart.addSeries(LineSeries, { color: '#d64545', lineWidth: 1, lineType: LineType.WithSteps, priceFormat });
const bidSeries = chart.addSeries(LineSeries, { color: '#2e9e5b', lineWidth: 1, lineType: LineType.WithSteps, priceFormat });
const priceSeries = chart.addSeries(LineSeries, { color: '#1f5fbf', lineWidth: 2, priceFormat });

const toPoint = (series: 'price' | 'bid' | 'ask') => (p: Point) =>
    ({ time: p.n as UTCTimestamp, value: p[series] / 100 });

function redraw(history: Point[]): void {
    priceSeries.setData(history.map(toPoint('price')));
    bidSeries.setData(history.map(toPoint('bid')));
    askSeries.setData(history.map(toPoint('ask')));
    chart.timeScale().fitContent();
}

function append(series: ISeriesApi<'Line'>, time: number, cents: number): void {
    series.update({ time: time as UTCTimestamp, value: cents / 100 });
}

// ── Состояние запуска ────────────────────────────────────────────────

let generator: WasmGenerator | undefined;
let config: SimulationConfig | undefined;
let timer: number | undefined;
let running = false;
let stats: InstrumentStats[] = [];
let selected = 0;

function onBatch(batch: MarketUpdate[]): void {
    for (const u of batch) {
        const s = stats[u.instrument];
        const previous = s.last;
        s.trades++;
        s.volume += u.tradeQuantity;
        s.notional += u.priceCents * u.tradeQuantity;
        if (previous && (previous.bidCents !== u.bidCents || previous.askCents !== u.askCents)) s.priceMoves++;
        s.last = u;

        const point: Point = { n: s.trades, price: u.priceCents, bid: u.bidCents, ask: u.askCents };
        s.history.push(point);
        if (s.history.length > HISTORY_LIMIT) s.history.shift();

        if (u.instrument === selected) {
            append(priceSeries, point.n, point.price);
            append(bidSeries, point.n, point.bid);
            append(askSeries, point.n, point.ask);
        }
    }
    renderStats();
}

function renderStats(): void {
    const s = stats[selected];
    const u = s?.last;
    const imbalance = u && u.bidQuantity + u.askQuantity > 0
        ? ((u.bidQuantity - u.askQuantity) / (u.bidQuantity + u.askQuantity)).toFixed(2)
        : '—';
    const items: [string, string][] = [
        ['Статус', running ? 'работает' : 'на паузе'],
        ['Сделок', s ? String(s.trades) : '0'],
        ['Последняя цена', u ? dollars(u.priceCents) : '—'],
        ['Спред', u ? dollars(u.askCents - u.bidCents) : '—'],
        ['Объём', s ? String(s.volume) : '0'],
        ['VWAP', s && s.volume > 0 ? dollars(s.notional / s.volume) : '—'],
        ['Дисбаланс', imbalance],
        ['Сдвигов цены', s ? String(s.priceMoves) : '0'],
    ];
    $('stats').innerHTML = items
        .map(([label, value]) => `<div class="stat"><span>${label}</span><b>${value}</b></div>`)
        .join('');
}

// ── Управление ───────────────────────────────────────────────────────

// Таймер живёт здесь, как в воркере: Wasm лишь генерирует батч на каждый вызов.
function startTimer(): void {
    const current = config!;
    timer = window.setInterval(() => onBatch(generator!.nextBatch()), current.batchIntervalMs);
    running = true;
}

function stopTimer(): void {
    window.clearInterval(timer);
    timer = undefined;
    running = false;
}

function apply(): void {
    if (!generator) return;

    const next = Object.assign(new SimulationConfig(), {
        instrumentCount: numberInput('instrumentCount'),
        updatesPerBatch: numberInput('updatesPerBatch'),
        batchIntervalMs: numberInput('batchIntervalMs'),
    });
    // Тексты ошибок даёт TypeScript-проверка: Wasm возвращает только биты некорректных полей.
    const errors = validateSimulationConfig(next);
    $('error').textContent = errors.map((e) => e.message).join('; ');
    if (errors.length > 0) return;

    stopTimer();
    const wasmErrors = generator.init(next.instrumentCount, next.updatesPerBatch, next.batchIntervalMs, numberInput('seed'));
    if (wasmErrors !== 0) {
        $('error').textContent = `Wasm rejected the config (error bits ${wasmErrors})`;
        return;
    }

    config = next;
    stats = Array.from({ length: next.instrumentCount }, () =>
        ({ trades: 0, volume: 0, notional: 0, priceMoves: 0, history: [] }));

    const select = $<HTMLSelectElement>('instrument');
    select.innerHTML = stats.map((_, i) => `<option value="${i}">#${i}</option>`).join('');
    selected = 0;

    startTimer();
    $('pause').textContent = 'Pause';
    redraw([]);
    renderStats();
}

function togglePause(): void {
    if (!config) return;
    if (running) {
        stopTimer();
    } else {
        // Resume: состояние котировок осталось в Wasm, пропущенное время не догенерируется.
        startTimer();
    }
    $('pause').textContent = running ? 'Pause' : 'Resume';
    renderStats();
}

$('config').addEventListener('submit', (event) => {
    event.preventDefault();
    apply();
});
$('pause').addEventListener('click', togglePause);
$<HTMLSelectElement>('instrument').addEventListener('change', (event) => {
    selected = Number((event.target as HTMLSelectElement).value);
    redraw(stats[selected].history);
    renderStats();
});

// Загружаем Wasm и стартуем с настройками по умолчанию.
WasmGenerator.load()
    .then((loaded) => {
        generator = loaded;
        apply();
    })
    .catch((error: unknown) => {
        $('error').textContent = error instanceof Error ? error.message : String(error);
    });
