import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        // Тести воркера і спільного контракту налаштувань у backend/market/contracts.
        dir: '..',
        include: ['worker/src/**/*.spec.ts', 'contracts/**/*.spec.ts'],
    },
});
