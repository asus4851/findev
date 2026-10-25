# Realtime Market Dashboard

Angular-застосунок із двома сторінками: живий дашборд ринкових метрик і налаштування генератора. Ринкові дані генерує бібліотека на AssemblyScript, скомпільована у WebAssembly, яка працює у Web Worker.

- Репозиторій: https://github.com/asus4851/findev
- Демо: https://asus4851.github.io/findev/ (з'являється після першого деплою, див. «Деплой»)

## Як це працює

```
Wasm (імітує біржу)  →  Web Worker (агрегує метрики)  →  Angular (показує)
   сирі угоди              postMessage (знімки)             дашборд, налаштування
```

1. Angular надсилає воркеру команду `start` з налаштуваннями, випадковим seed і номером запуску `runId`.
2. Воркер викликає `init` у Wasm і за таймером просить батч угод. Кожну угоду він додає в накопичені метрики інструмента: обсяг, суму `ціна × кількість` для VWAP і останній знімок стакана. Історія угод не зберігається.
3. Після кожного батча воркер надсилає Angular знімок метрик. Angular приймає лише знімки поточного `runId`, тому результати попереднього запуску не перезаписують новий.
4. Pause зупиняє таймер Wasm, значення лишаються. Resume продовжує без догенерації часу паузи. Apply на сторінці налаштувань починає новий запуск і стирає попередні значення.

Усі ціни передаються і рахуються в цілих центах, у валюту їх перетворює лише відображення.

## Структура

```
backend/market/                   бекенд-домен «ринок»: усе, що працює поза Angular
├── index.ts                      публічний API домену: типи, межі налаштувань, протокол, частоти знімків
├── contracts/                    спільний контракт: налаштування з межами ТЗ і формат повідомлень
├── market-gen-as/                генератор на AssemblyScript → build/market_gen.wasm
├── market-gen-ts/                еталонна TypeScript-версія генератора і пісочниця з графіком
└── worker/                       Web Worker
    └── src/
        ├── market.worker.ts      точка входу: створює MarketSimulation і завантажує Wasm
        ├── market-simulation.ts  керування: команди, таймер генерації, частота знімків (rxjs)
        ├── wasm/                 межа з Wasm: інтерфейс і завантаження, формат буфера, біти помилок init
        ├── metrics/              розрахунок п'яти метрик: MarketData (батч), InstrumentStats (один інструмент)
        └── utils/                назви інструментів

frontend/src/app/             Angular 22
├── app.component.*           оболонка з навігацією
├── shared/
│   └── components/           data-table: універсальна таблиця (колонки передаються ззовні)
└── domains/
    └── market/               домен «ринок»
        ├── index.ts          публічний API домену: маршрути, сесія, токен воркера, типи
        ├── market.routes.ts  ліниві маршрути сторінок домену
        ├── pages/            dashboard, settings
        ├── services/         market-session: стан запуску
        ├── tokens/           market-worker: токен для створення воркера
        ├── utils/            пайпи формату ціни і дисбалансу
        └── market.model.ts   модель: метрики і налаштування (типи, межі, значення за замовчуванням)
```

## Запуск

Потрібен Node.js 22 або новіший.

```bash
cd backend/market/market-gen-as && npm install
cd ../worker && npm install
cd ../../../frontend && npm install
npm start
```

`npm start` спершу збирає Wasm, копіює його у `frontend/public/wasm/`, потім запускає `ng serve` на http://localhost:4200.

Збірка для публікації:

```bash
cd frontend && npm run build
```

Результат лежить у `frontend/dist/frontend/browser`.

## Межі доменів

Кожен домен відкриває назовні лише свій публічний API — файл `index.ts`. Усередині домену файли імпортують один одного напряму.

| Домен | Публічний API | Як імпортувати ззовні |
|---|---|---|
| Бекенд «ринок» | `backend/market/index.ts` | `@backend/market` (аліас у `frontend/tsconfig.json`) |
| Фронтенд «ринок» | `frontend/src/app/domains/market/index.ts` | `./domains/market` (папка домену, без глибших шляхів) |

Фронтенд-домен експортує `MARKET_ROUTES` (сторінки завантажуються ліниво), `MarketSession`, токен воркера і типи. Сторінки й компоненти назовні не експортуються.

Порушення меж ловить ESLint (`frontend/eslint.config.mjs`): імпорт на кшталт `@backend/market/contracts/protocol` чи `./domains/market/services/...` поза доменом дає помилку. Новий фронтенд-домен достатньо дописати в список `DOMAINS` у цьому файлі.

```bash
cd frontend && npm run lint
```

Воркер не імпортується, а підключається за адресою `new Worker(new URL(...))` у `market-worker.token.ts`. Динамічний `import()` правило не перевіряє.

## Тести

| Що перевіряється | Де | Команда |
|---|---|---|
| Метрики, керування воркером, налаштування і їх межі | `backend/market/worker`, `backend/market/contracts` | `cd backend/market/worker && npm install && npm test` |
| Генератор у скомпільованому Wasm, паритет з еталоном | `backend/market/market-gen-as` | `cd backend/market/market-gen-as && npm test` |
| Еталонний генератор | `backend/market/market-gen-ts` | `cd backend/market/market-gen-ts && npm install && npm test` |
| Сервіс зв'язку з воркером, сторінки, форматування | `frontend` | `cd frontend && npm test` |

- **Метрики:** приклад з ТЗ ($102, $0.04, 40, $101.50, 0.20), нульові знаменники, ізоляція інструментів: `backend/market/worker/src/metrics/instrument-stats.spec.ts`, `backend/market/worker/src/metrics/market-data.spec.ts`.
- **Налаштування і скидання при Apply:** `backend/market/contracts/simulation-config.spec.ts`, `frontend/src/app/domains/market/pages/settings/settings.component.spec.ts`, `frontend/src/app/domains/market/services/market-session.service.spec.ts`.
- **Pause/Resume і відкидання результатів попереднього запуску:** `backend/market/worker/src/market-simulation.spec.ts` (пауза зупиняє генерацію, Resume не догенеровує час паузи, новий запуск, команди старого `runId`, помилки, частота знімків), `frontend/src/app/domains/market/services/market-session.service.spec.ts` (команди, `runId`), `frontend/src/app/domains/market/pages/dashboard/dashboard.component.spec.ts` (кнопка і статус).
- **Генератор:** `backend/market/market-gen-as/tests/generator.spec.ts` запускає скомпільований `.wasm`, `backend/market/market-gen-ts/src/*.spec.ts` перевіряє еталон.

Тести не чекають реального часу: випадковість задається seed, воркер у тестах Angular підроблений.

## Деплой на GitHub Pages

Репозиторій уже на GitHub, тож найпростіше публікувати через GitHub Actions. Workflow лежить у [.github/workflows/deploy.yml](.github/workflows/deploy.yml). Він запускається при кожному push у `main`:

1. встановлює залежності в `backend/market/market-gen-as`, `backend/market/market-gen-ts`, `backend/market/worker` і `frontend` (`npm ci`);
2. перевіряє межі доменів (`npm run lint`) і запускає всі чотири набори тестів; якщо щось падає, деплой не відбувається;
3. збирає застосунок: `prebuild` компілює Wasm і копіює його в `public/wasm/`, потім `ng build`;
4. підставляє `--base-href /<назва-репозиторію>/`, бо сайт на Pages живе не в корені домену;
5. копіює `index.html` у `404.html`, щоб прямий перехід на `/settings` або перезавантаження сторінки не давали 404;
6. публікує `frontend/dist/frontend/browser`.

### Одноразове налаштування

1. Відкрий репозиторій на GitHub: **Settings → Pages**.
2. У полі **Build and deployment → Source** обери **GitHub Actions**.
3. Запуш `.github/workflows/deploy.yml` у гілку `main`:

   ```bash
   git add .github README.md && git commit -m "Add GitHub Pages deployment" && git push
   ```

4. Перевір вкладку **Actions**: workflow має пройти обидва кроки (`build`, `deploy`). Адреса сайту з'явиться в **Settings → Pages**, а також у кроці `deploy`.

Далі кожен push у `main` автоматично збирає і публікує нову версію без ручних кроків.

### Якщо щось не працює

- **Порожня сторінка, у консолі 404 на `.js`:** base href не збігається з назвою репозиторію. Workflow бере її автоматично; якщо сайт під власним доменом, у кроці збірки заміни `/${{ github.event.repository.name }}/` на `/`.
- **404 після перезавантаження на `/settings`:** перевір, що крок з `cp index.html 404.html` виконався.
- **Збірка падає на `asc` або не знаходить `rxjs`:** не встановлено залежності в `backend/market/market-gen-as` чи `backend/market/worker` (потрібен `npm ci` у цих папках до збірки фронтенду).
- **Крок `deploy` падає з помилкою доступу:** у **Settings → Pages** джерелом має бути саме **GitHub Actions**, а не гілка.
