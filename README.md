# Realtime Market Dashboard

Angular-застосунок із двома сторінками: живий дашборд ринкових метрик і налаштування генератора. Ринкові дані генерує бібліотека на AssemblyScript, скомпільована у WebAssembly, яка працює у Web Worker.

## Структура

```
backend/                  імітація бекенду: усе, що працює поза Angular
├── contracts/            спільний контракт: налаштування з межами ТЗ і формат повідомлень
├── market-gen-as/        генератор на AssemblyScript → build/market_gen.wasm
├── market-gen-ts/        еталонна TypeScript-версія генератора і пісочниця з графіком
└── worker/               Web Worker: завантажує Wasm, керує запуском, рахує метрики
frontend/                 Angular 22: дашборд і налаштування
```

Як рухаються дані:

1. `frontend` надсилає воркеру команду `start` з налаштуваннями і номером запуску `runId`.
2. Воркер за таймером просить у Wasm батч угод, додає кожну угоду в накопичені метрики і надсилає знімок метрик.
3. `frontend` приймає лише знімки поточного `runId` і показує їх у таблиці.

## Запуск

Потрібен Node.js 22 або новіший.

```bash
cd backend/market-gen-as && npm install
cd ../../frontend && npm install
npm start
```

`npm start` спершу збирає Wasm, копіює його у `frontend/public/wasm/`, потім запускає `ng serve` на http://localhost:4200.

Збірка для публікації:

```bash
cd frontend && npm run build
```

## Тести

| Що перевіряється | Де | Команда |
|---|---|---|
| Метрики, Pause/Resume, новий запуск, межі налаштувань | `backend/worker`, `backend/contracts` | `cd backend/worker && npm install && npm test` |
| Генератор у скомпільованому Wasm, паритет з еталоном | `backend/market-gen-as` | `cd backend/market-gen-as && npm test` |
| Еталонний генератор | `backend/market-gen-ts` | `cd backend/market-gen-ts && npm install && npm test` |
| Сервіс зв'язку з воркером, сторінки, форматування | `frontend` | `cd frontend && npm test` |

Відповідність розділу 4 ТЗ:

- **Метрики:** приклад з ТЗ ($102, $0.04, 40, $101.50, 0.20), нульові знаменники, ізоляція інструментів: `backend/worker/src/metrics.spec.ts`.
- **Налаштування і скидання при Apply:** `backend/contracts/simulation-config.spec.ts`, `frontend/src/app/features/settings/settings.spec.ts`, `frontend/src/app/core/market/market-producer.spec.ts`.
- **Pause/Resume і відкидання результатів попереднього запуску:** `backend/worker/src/simulation-runtime.spec.ts`, `frontend/src/app/core/market/market-producer.spec.ts`.
- **Генератор:** `backend/market-gen-as/tests/generator.spec.ts` запускає скомпільований `.wasm`.

Тести не чекають реального часу: випадковість задається seed, таймери підробні.
