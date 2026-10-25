# Realtime Market Dashboard

Angular-приложение с двумя страницами: живой дашборд рыночных метрик и настройки генератора. Рыночные данные генерирует библиотека на AssemblyScript, скомпилированная в WebAssembly и запущенная в Web Worker.

- Репозиторий: https://github.com/hresvadym/findev
- Демо: https://hresvadym.github.io/findev/

## Ключевые решения

**1. Сначала TypeScript, потом Wasm.** Генератор я сначала спроектировал и покрыл тестами на TypeScript (`backend/market/market-gen-ts`): модель котировки, ордера, движения цены и стакана. Затем перенёс его на AssemblyScript (`backend/market/market-gen-as`). Тесты Wasm проверяют паритет: с тем же seed Wasm выдаёт ровно те же обновления, что и эталон на TypeScript.

**2. Основа DDD на фронтенде и бэкенде.** И бэкенд, и фронтенд оформлены как домен «рынок» (`backend/market`, `frontend/src/app/domains/market`). Каждый домен открывает наружу только свой публичный API — файл `index.ts`. Внутри домена файлы импортируют друг друга напрямую. Границы проверяет ESLint: импорт в обход `index.ts` даёт ошибку.

**3. Бэкенд отделён, потому что имитирует настоящий бэкенд.** Его обязанность — имитировать операции на рынке и выполнять первичную агрегацию:
- Wasm играет роль биржи и генерирует сырые сделки и стакан;
- воркер играет роль сервера рыночных данных: учитывает каждую сделку в объёме и VWAP и отдаёт готовые метрики;
- `postMessage` играет роль сети.

Фронтенд выступает в роли рендера данных, а не агрегатора: он только показывает готовые строки и отправляет команды.

**4. Частота обновления таблицы.** На дашборде есть переключатель **Table refresh** (0,5 с, 1 с, 5 с). Он ограничивает частоту обновления и даёт пользователю выбор. Воркер при этом по-прежнему учитывает каждую сделку, а Angular получает сводный снимок не чаще выбранного интервала. В реальной жизни пользователь не воспринимает очень частые обновления, поэтому режим **No limit** (снимок после каждого батча) оставлен только для демонстрации производительности.

## Как работает

```
npm start / npm run build
  └─ AssemblyScript → market_gen.wasm → frontend/public/wasm/
  └─ Angular собирает приложение и отдельный бандл воркера

Браузер: Angular → Web Worker → Wasm (nextBatch по таймеру)
                   └─ метрики → снимок не чаще Table refresh → Angular → таблица
```

Каждый запуск (Apply) получает номер `runId`. Angular отбрасывает сообщения старого запуска. Pause останавливает генерацию, Resume продолжает без догенерации времени паузы.

## Структура

```
backend/market/                  бэкенд-домен «рынок», публичный API — index.ts
├── contracts/                   протокол сообщений, настройки и их границы, частоты снимков
├── market-gen-ts/               эталонный генератор на TypeScript и песочница с графиком
├── market-gen-as/               генератор на AssemblyScript → build/market_gen.wasm
└── worker/src/                  Web Worker
    ├── market.worker.ts         точка входа
    ├── market-simulation.ts     команды, таймер генерации, частота снимков (rxjs)
    ├── wasm/                    граница с Wasm: загрузка, формат буфера, ошибки init
    ├── metrics/                 расчёт пяти метрик
    └── utils/                   имена инструментов

frontend/src/app/
├── shared/components/           data-table: универсальная таблица
└── domains/market/              фронтенд-домен «рынок», публичный API — index.ts
    ├── pages/                   dashboard, settings
    ├── services/                market-session: связь с воркером и состояние запуска
    ├── tokens/                  токен создания воркера
    ├── utils/                   пайпы формата цены и дисбаланса
    └── market.model.ts          модель: метрики и настройки
```

## Запуск

Нужен Node.js 22 или новее.

```bash
cd backend/market/market-gen-as && npm install
cd ../worker && npm install
cd ../../../frontend && npm install
npm start
```

`npm start` сначала собирает Wasm, затем запускает `ng serve` на http://localhost:4200. Сборка для публикации: `npm run build` в `frontend`.

## Проверки

```bash
cd frontend && npm run lint                          # границы доменов
cd backend/market/market-gen-as && npm test          # Wasm: паритет с эталоном, инварианты
cd backend/market/market-gen-ts && npm install && npm test   # эталонный генератор
cd backend/market/worker && npm test                 # метрики, пауза/Resume, runId, ошибки, частота снимков
cd frontend && npm test                              # сервис, страницы, форматирование
```

Тесты не ждут реального времени: случайность задаётся seed, таймеры и воркер подменяются.

## Деплой

Каждый push в `main` запускает [GitHub Actions](.github/workflows/deploy.yml): линт, все тесты, сборка с `--base-href /<имя-репозитория>/` и публикация на GitHub Pages. Если линт или тест падает, деплой не происходит. В настройках репозитория (**Settings → Pages**) источником выбран **GitHub Actions**.
