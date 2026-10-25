// @ts-check
import tseslint from 'typescript-eslint';

// Межі доменів. Кожен домен відкриває назовні лише свій публічний API (index.ts),
// а внутрішні файли домену імпортуються лише зсередини нього самого.

// ── Бекенд-домен ─────────────────────────────────────────────────────

// backend/market доступний фронтенду лише через аліас @backend/market (backend/market/index.ts).
const backendMessage = "Імпортуй бекенд-домен «ринок» лише через його публічний API: '@backend/market' (backend/market/index.ts).";
const backendPatterns = [
  // Глибокий шлях через аліас: '@backend/market/contracts/protocol'.
  { regex: '^@backend/market/', message: backendMessage },
  // Відносний шлях у папку домену: '../../backend/market/...' або '../../backend/market'.
  { regex: '(^|/)backend/market(/|$)', message: backendMessage },
];

// ── Домени фронтенду ─────────────────────────────────────────────────

// Папки в src/app/domains. Новий домен достатньо дописати сюди.
const DOMAINS = ['market'];

// Імпорт будь-чого глибше за папку домену: 'domains/market/services/...'.
// Сам 'domains/market' (його index.ts) дозволено.
const domainPattern = (domain) => ({
  regex: `(^|/)domains/${domain}/.+`,
  message: `Імпортуй домен «${domain}» лише через його публічний API: 'domains/${domain}' (domains/${domain}/index.ts).`,
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
  // Код поза доменами (app.config, app.routes, shared, testing): усі домени лише через index.ts.
  {
    files: ['src/**/*.ts'],
    ignores: DOMAINS.map((domain) => `src/app/domains/${domain}/**`),
    rules: restrictImports([...backendPatterns, ...DOMAINS.map(domainPattern)]),
  },
  // Код усередині домену: свої файли напряму, інші домени лише через їхній index.ts.
  ...DOMAINS.map((domain) => ({
    files: [`src/app/domains/${domain}/**/*.ts`],
    rules: restrictImports([
      ...backendPatterns,
      ...DOMAINS.filter((other) => other !== domain).map(domainPattern),
    ]),
  })),
);
