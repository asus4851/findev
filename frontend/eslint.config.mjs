// @ts-check
import tseslint from 'typescript-eslint';

// Границы доменов. Каждый домен открывает наружу только свой публичный API (index.ts),
// а внутренние файлы домена импортируются только изнутри него самого.

// ── Бэкенд-домен ─────────────────────────────────────────────────────

// backend/market доступен фронтенду только через алиас @backend/market (backend/market/index.ts).
const backendMessage = "Импортируй бэкенд-домен «рынок» только через его публичный API: '@backend/market' (backend/market/index.ts).";
const backendPatterns = [
  // Глубокий путь через алиас: '@backend/market/contracts/protocol'.
  { regex: '^@backend/market/', message: backendMessage },
  // Относительный путь в папку домена: '../../backend/market/...' или '../../backend/market'.
  { regex: '(^|/)backend/market(/|$)', message: backendMessage },
];

// ── Домены фронтенда ─────────────────────────────────────────────────

// Папки в src/app/domains. Новый домен достаточно дописать сюда.
const DOMAINS = ['market'];

// Импорт чего угодно глубже папки домена: 'domains/market/services/...'.
// Сам 'domains/market' (его index.ts) разрешён.
const domainPattern = (domain) => ({
  regex: `(^|/)domains/${domain}/.+`,
  message: `Импортируй домен «${domain}» только через его публичный API: 'domains/${domain}' (domains/${domain}/index.ts).`,
});

const restrictImports = (patterns) => ({
  'no-restricted-imports': ['error', { patterns }],
});

export default tseslint.config(
  {
    ignores: ['dist/', '.angular/', 'public/'],
  },
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: tseslint.parser,
    },
  },
  // Код вне доменов (app.config, app.routes, testing): все домены только через index.ts.
  {
    files: ['src/**/*.ts'],
    ignores: DOMAINS.map((domain) => `src/app/domains/${domain}/**`),
    rules: restrictImports([...backendPatterns, ...DOMAINS.map(domainPattern)]),
  },
  // Код внутри домена: свои файлы напрямую, другие домены только через их index.ts.
  ...DOMAINS.map((domain) => ({
    files: [`src/app/domains/${domain}/**/*.ts`],
    rules: restrictImports([
      ...backendPatterns,
      ...DOMAINS.filter((other) => other !== domain).map(domainPattern),
    ]),
  })),
);
