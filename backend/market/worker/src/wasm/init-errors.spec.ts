import { describe, expect, it } from 'vitest';
import {
    INVALID_BATCH_INTERVAL_MS,
    INVALID_INSTRUMENT_COUNT,
    INVALID_UPDATES_PER_BATCH,
    describeInitErrors,
} from './init-errors';

describe('describeInitErrors', () => {
    it('называет поле по каждому биту', () => {
        expect(describeInitErrors(INVALID_INSTRUMENT_COUNT))
            .toBe('Market generator rejected the settings: instrumentCount out of range');
        expect(describeInitErrors(INVALID_UPDATES_PER_BATCH))
            .toBe('Market generator rejected the settings: updatesPerBatch out of range');
        expect(describeInitErrors(INVALID_BATCH_INTERVAL_MS))
            .toBe('Market generator rejected the settings: batchIntervalMs out of range');
    });

    it('перечисляет все некорректные поля сразу, в порядке настроек', () => {
        expect(describeInitErrors(INVALID_BATCH_INTERVAL_MS | INVALID_INSTRUMENT_COUNT))
            .toBe('Market generator rejected the settings: instrumentCount, batchIntervalMs out of range');
    });

    it('биты независимы: каждый занимает отдельный разряд', () => {
        expect([INVALID_INSTRUMENT_COUNT, INVALID_UPDATES_PER_BATCH, INVALID_BATCH_INTERVAL_MS]).toEqual([1, 2, 4]);
    });
});
