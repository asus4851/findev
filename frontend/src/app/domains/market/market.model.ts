// Модель домену «ринок»: метрики інструмента і налаштування запуску.
// Беруться з публічного API бекенд-домену (backend/market/index.ts): їх використовують і воркер, і фронтенд.
import { SIMULATION_LIMITS, SimulationConfig, type SimulationConfigField, type SimulationSettings } from '@backend/market';

// П'ять метрик з ТЗ. undefined означає «значення недоступне»:
// даних ще немає або знаменник формули дорівнює нулю.
export type { InstrumentMetrics } from '@backend/market';

export { SIMULATION_LIMITS };
export type { SimulationConfigField, SimulationSettings };

// Налаштування за замовчуванням: застосунок стартує з ними.
export function defaultSettings(): SimulationSettings {
  return copySettings(new SimulationConfig());
}

// Копія лише з трьох полів налаштувань: зміни переданого об'єкта не впливають на запуск.
export function copySettings({ instrumentCount, updatesPerBatch, batchIntervalMs }: SimulationSettings): SimulationSettings {
  return { instrumentCount, updatesPerBatch, batchIntervalMs };
}
