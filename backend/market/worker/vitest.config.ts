import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        // Тесты воркера и общего контракта настроек в backend/market/contracts.
        dir: '..',
        include: ['worker/src/**/*.spec.ts', 'contracts/**/*.spec.ts'],
    },
});
