import { defineConfig } from 'vite';

export default defineConfig({
    server: {
        // Песочница загружает .wasm из соседней папки ../market-gen-as и настройки из ../contracts,
        // а Vite по умолчанию отдаёт только файлы из этой папки.
        fs: { allow: ['.', '../market-gen-as/build', '../contracts'] },
    },
});
