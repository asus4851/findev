import { describe, expect, it } from 'vitest';
import { SIMULATION_LIMITS, SimulationConfig, validateSimulationConfig } from './simulation-config';

const configWith = (overrides: Partial<SimulationConfig>) =>
    Object.assign(new SimulationConfig(), overrides);

const invalidFields = (config: SimulationConfig) =>
    validateSimulationConfig(config).map((error) => error.field);

describe('SimulationConfig', () => {
    it('має значення за замовчуванням з ТЗ, і вони коректні', () => {
        const config = new SimulationConfig();

        expect(config).toMatchObject({ instrumentCount: 5, updatesPerBatch: 100, batchIntervalMs: 500 });
        expect(validateSimulationConfig(config)).toEqual([]);
    });
});

describe('validateSimulationConfig', () => {
    it('приймає мінімальні і максимальні значення з ТЗ', () => {
        const min = configWith({ instrumentCount: 1, updatesPerBatch: 1, batchIntervalMs: 50 });
        const max = configWith({ instrumentCount: 50, updatesPerBatch: 1000, batchIntervalMs: 2000 });

        expect(validateSimulationConfig(min)).toEqual([]);
        expect(validateSimulationConfig(max)).toEqual([]);
    });

    it.each(Object.keys(SIMULATION_LIMITS) as (keyof SimulationConfig)[])(
        'відхиляє %s нижче мінімуму і вище максимуму',
        (field) => {
            const { min, max } = SIMULATION_LIMITS[field];

            expect(invalidFields(configWith({ [field]: min - 1 }))).toEqual([field]);
            expect(invalidFields(configWith({ [field]: max + 1 }))).toEqual([field]);
        },
    );

    it('відхиляє нецілі значення', () => {
        const errors = validateSimulationConfig(configWith({ updatesPerBatch: 2.5 }));

        expect(errors).toEqual([
            { field: 'updatesPerBatch', message: 'updatesPerBatch must be an integer, got 2.5' },
        ]);
    });

    it('відхиляє NaN і нескінченність', () => {
        expect(invalidFields(configWith({ instrumentCount: Number.NaN }))).toEqual(['instrumentCount']);
        expect(invalidFields(configWith({ batchIntervalMs: Number.POSITIVE_INFINITY }))).toEqual(['batchIntervalMs']);
    });

    it('повертає всі помилки одразу', () => {
        const config = configWith({ instrumentCount: 0, updatesPerBatch: 1001, batchIntervalMs: 49 });

        expect(invalidFields(config)).toEqual(['instrumentCount', 'updatesPerBatch', 'batchIntervalMs']);
        expect(validateSimulationConfig(config)[0].message).toBe('instrumentCount must be between 1 and 50, got 0');
    });
});
