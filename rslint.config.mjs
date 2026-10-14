import { defineConfig, globalIgnores, globals, js, ts } from '@rslint/core';

export default defineConfig([
  globalIgnores([
    'coverage/',
    '.pnpm-store/',
    '**/.midscene/',
    '**/midscene_run/',
  ]),
  js.configs.recommended,
  ts.configs.recommended,
  {
    files: ['**/*.{js,mjs,ts}'],
    languageOptions: { globals: globals.nodeBuiltin },
  },
]);
