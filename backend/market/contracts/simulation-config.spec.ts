import { describe, expect, it } from 'vitest';
import { SIMULATION_LIMITS, SimulationConfig, validateSimulationConfig } from './simulation-config';

const configWith = (overrides: Partial<SimulationConfig>) =>
    Object.assign(new SimulationConfig(), overrides);

const invalidFields = (config: SimulationConfig) =>
    validateSimulationConfig(config).map((error) => error.field);

describe('SimulationConfig', () => {
    it('имеет значения по умолчанию из ТЗ, и они корректны', () => {
        const config = new SimulationConfig();

        expect(config).toMatchObject({ instrumentCount: 5, updatesPerBatch: 100, batchIntervalMs: 500 });
        expect(validateSimulationConfig(config)).toEqual([]);
    });
});

describe('validateSimulationConfig', () => {
    it('принимает минимальные и максимальные значения из ТЗ', () => {
        const min = configWith({ instrumentCount: 1, updatesPerBatch: 1, batchIntervalMs: 50 });
        const max = configWith({ instrumentCount: 50, updatesPerBatch: 1000, batchIntervalMs: 2000 });

        expect(validateSimulationConfig(min)).toEqual([]);
        expect(validateSimulationConfig(max)).toEqual([]);
    });

    it.each(Object.keys(SIMULATION_LIMITS) as (keyof SimulationConfig)[])(
        'отклоняет %s ниже минимума и выше максимума',
        (field) => {
            const { min, max } = SIMULATION_LIMITS[field];

            expect(invalidFields(configWith({ [field]: min - 1 }))).toEqual([field]);
            expect(invalidFields(configWith({ [field]: max + 1 }))).toEqual([field]);
        },
    );

    it('отклоняет нецелые значения', () => {
        const errors = validateSimulationConfig(configWith({ updatesPerBatch: 2.5 }));

        expect(errors).toEqual([
            { field: 'updatesPerBatch', message: 'updatesPerBatch must be an integer, got 2.5' },
        ]);
    });

    it('отклоняет NaN и бесконечность', () => {
        expect(invalidFields(configWith({ instrumentCount: Number.NaN }))).toEqual(['instrumentCount']);
        expect(invalidFields(configWith({ batchIntervalMs: Number.POSITIVE_INFINITY }))).toEqual(['batchIntervalMs']);
    });

    it('возвращает все ошибки сразу', () => {
        const config = configWith({ instrumentCount: 0, updatesPerBatch: 1001, batchIntervalMs: 49 });

        expect(invalidFields(config)).toEqual(['instrumentCount', 'updatesPerBatch', 'batchIntervalMs']);
        expect(validateSimulationConfig(config)[0].message).toBe('instrumentCount must be between 1 and 50, got 0');
    });
});
