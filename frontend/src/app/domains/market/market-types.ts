// Типи домену «ринок»: метрики інструмента і налаштування запуску.
// Описані в backend/contracts, бо їх використовують і воркер, і фронтенд.
import type { SimulationSettings } from '@contracts/protocol';
import { SIMULATION_LIMITS, SimulationConfig, type SimulationConfigField } from '@contracts/simulation-config';

// П'ять метрик з ТЗ. undefined означає «значення недоступне»:
// даних ще немає або знаменник формули дорівнює нулю.
export type { InstrumentMetrics } from '@contracts/protocol';

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
