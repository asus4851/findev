// Налаштування симулятора з ТЗ: їх вводить користувач на сторінці налаштувань.
// Це не сутність ринку, а вхідні параметри запуску, тому вони лежать окремо від model/.

// Три налаштування з ТЗ, значення за замовчуванням.
export class SimulationConfig {
    instrumentCount: number = 5;    // кількість інструментів
    updatesPerBatch: number = 100;  // угод у батчі, загалом на всі інструменти
    batchIntervalMs: number = 500;  // інтервал між батчами, мс
}

export type SimulationConfigField = keyof SimulationConfig;

// Допустимі межі з ТЗ, включно. Усі значення мають бути цілими.
// Ті самі межі пізніше використає форма налаштувань в Angular.
export const SIMULATION_LIMITS: Record<SimulationConfigField, { min: number; max: number }> = {
    instrumentCount: { min: 1, max: 50 },
    updatesPerBatch: { min: 1, max: 1000 },
    batchIntervalMs: { min: 50, max: 2000 },
};

export interface SimulationConfigError {
    field: SimulationConfigField;
    message: string;
}

// Перевіряє всі поля і повертає список помилок. Порожній список означає, що налаштування коректні.
// Повертає всі помилки одразу, щоб користувач бачив усі проблеми, а не лише першу.
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
