import { defineConfig } from 'vite';

export default defineConfig({
    server: {
        // Пісочниця завантажує .wasm із сусідньої теки ../market-gen-as і налаштування з ../contracts,
        // а Vite за замовчуванням віддає лише файли з цієї теки.
        fs: { allow: ['.', '../market-gen-as/build', '../contracts'] },
    },
});
