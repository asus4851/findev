// Частота обновлений: как часто генерировать батч.
// Эта часть остаётся в воркере на TypeScript: в Wasm нет таймеров.
import { SimulationConfig, validateSimulationConfig } from './config/simulation-config';
import { MarketUpdate } from './model/market-update';
import { Quote } from './model/quote';
import { generateBatch } from './simulator';
import { RandomGenerator } from './utils/random-generator';

// Раз в batchIntervalMs генерируем батч из updatesPerBatch сделок.
// Например, 100 сделок каждые 500 мс дают 200 сделок в секунду всего.
// Возвращает функцию остановки.
// С некорректными настройками не запускается, а бросает ошибку с перечнем проблем:
// ТЗ требует понятных ошибок инициализации.
export function startSimulation(
    quotes: Quote[],
    config: SimulationConfig,
    random: RandomGenerator,
    onBatch: (batch: MarketUpdate[]) => void,
): () => void {
    const errors = validateSimulationConfig(config);
    if (errors.length > 0) {
        throw new Error(`Invalid simulation config: ${errors.map((error) => error.message).join('; ')}`);
    }

    const timer = setInterval(
        () => onBatch(generateBatch(quotes, config.updatesPerBatch, random)),
        config.batchIntervalMs,
    );

    return () => clearInterval(timer);
}
