// Настройки симулятора из ТЗ: их вводит пользователь на странице настроек.
// Это не сущность рынка, а входные параметры запуска, поэтому они лежат отдельно от model/.

// Три настройки из ТЗ, значения по умолчанию.
export class SimulationConfig {
    instrumentCount: number = 5;    // количество инструментов
    updatesPerBatch: number = 100;  // сделок в батче, всего на все инструменты
    batchIntervalMs: number = 500;  // интервал между батчами, мс
}

export type SimulationConfigField = keyof SimulationConfig;

// Допустимые границы из ТЗ, включительно. Все значения должны быть целыми.
// Те же границы использует форма настроек в Angular.
export const SIMULATION_LIMITS: Record<SimulationConfigField, { min: number; max: number }> = {
    instrumentCount: { min: 1, max: 50 },
    updatesPerBatch: { min: 1, max: 1000 },
    batchIntervalMs: { min: 50, max: 2000 },
};

export interface SimulationConfigError {
    field: SimulationConfigField;
    message: string;
}

// Проверяет все поля и возвращает список ошибок. Пустой список означает, что настройки корректны.
// Возвращает все ошибки сразу, чтобы пользователь видел все проблемы, а не только первую.
export function validateSimulationConfig(config: SimulationConfig): SimulationConfigError[] {
    const errors: SimulationConfigError[] = [];

    for (const field of Object.keys(SIMULATION_LIMITS) as SimulationConfigField[]) {
        const value = config[field];
        const { min, max } = SIMULATION_LIMITS[field];

        if (!Number.isInteger(value)) {
            errors.push({ field, message: `${field} must be an integer, got ${value}` });
        } else if (value < min || value > max) {
            errors.push({ field, message: `${field} must be between ${min} and ${max}, got ${value}` });
        }
    }

    return errors;
}
