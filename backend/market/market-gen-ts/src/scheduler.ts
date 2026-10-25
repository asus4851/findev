// Частота оновлень: як часто генерувати батч.
// Ця частина лишиться у воркері на TypeScript: у Wasm немає таймерів.
import { SimulationConfig, validateSimulationConfig } from './config/simulation-config';
import { MarketUpdate } from './model/market-update';
import { Quote } from './model/quote';
import { generateBatch } from './simulator';
import { RandomGenerator } from './utils/random-generator';

// Раз на batchIntervalMs генеруємо батч з updatesPerBatch угод.
// Наприклад 100 угод кожні 500 мс дають 200 угод за секунду загалом.
// Повертає функцію зупинки.
// З некоректними налаштуваннями не запускається, а кидає помилку з переліком проблем:
// ТЗ вимагає зрозумілих помилок ініціалізації.
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
