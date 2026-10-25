// Модель домена «рынок»: метрики инструмента и настройки запуска.
// Берутся из публичного API бэкенд-домена (backend/market/index.ts): их используют и воркер, и фронтенд.
import { SIMULATION_LIMITS, SimulationConfig, type SimulationConfigField, type SimulationSettings } from '@backend/market';

// Пять метрик из ТЗ. undefined означает «значение недоступно»:
// данных ещё нет или знаменатель формулы равен нулю.
export type { InstrumentMetrics } from '@backend/market';

export { SIMULATION_LIMITS };
export type { SimulationConfigField, SimulationSettings };

// Настройки по умолчанию: приложение стартует с ними.
export function defaultSettings(): SimulationSettings {
  return copySettings(new SimulationConfig());
}

// Копия только трёх полей настроек: изменения переданного объекта не влияют на запуск.
export function copySettings({ instrumentCount, updatesPerBatch, batchIntervalMs }: SimulationSettings): SimulationSettings {
  return { instrumentCount, updatesPerBatch, batchIntervalMs };
}
