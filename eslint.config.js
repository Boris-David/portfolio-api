import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default defineConfig(
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'coverage/**',
      // Build output from `wrangler dev`. Already ignored by git and by
      // Prettier; it was missing here, so a leftover `dev-*` directory from an
      // interrupted run turned `npm run lint` red for reasons nobody could see.
      '.wrangler/**',
    ],
  },
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: { allowDefaultProject: ['eslint.config.js'] },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // The content and the contract are typed end to end: an `any` crossing
      // a boundary voids the guarantee this whole repo sells.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // A configuration literal scattered through the code is a magic value:
      // constants live in a named module.
      'no-magic-numbers': 'off',
      '@typescript-eslint/no-magic-numbers': [
        'error',
        {
          ignore: [0, 1, 2],
          ignoreArrayIndexes: true,
          ignoreEnums: true,
          ignoreReadonlyClassProperties: true,
          enforceConst: true,
          detectObjects: false,
        },
      ],
    },
  },
  {
    // ── The Worker boundary, held by the linter ──
    //
    // A Worker has no file system. `node:crypto` is the only exception:
    // workerd implements it and returns the same byte as Node, which is what
    // makes it possible to compare a digest computed at build time with one
    // computed inside the isolate.
    //
    // The exemption list is explicit on purpose: adding a file to it is a
    // decision — "this module will never run on Workers" — not a side effect.
    // Careful, the rule only sees DIRECT imports; the transitive ones are
    // covered by `npm run smoke`, which exercises the Worker on workerd.
    files: ['src/**/*.ts'],
    ignores: [
      'src/node/**',
      'src/cv/build.ts',
      'src/cv/renderer.ts',
      'src/cv/tokens.ts',
      'src/cv/fonts.ts',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['node:*', '!node:crypto'],
              message:
                'This module runs on Cloudflare Workers, which has no file system. ' +
                'Code that needs the disk lives in src/node/ or in the résumé build modules.',
            },
            {
              group: ['playwright', 'playwright-core'],
              message:
                'Chromium does not run on Workers: résumé rendering is triggered by the build.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['tests/**/*.ts', 'scripts/**/*.ts', '*.config.ts', 'src/config.ts'],
    rules: {
      // A test reads better with its expected values in plain sight; a tooling
      // script is not consumed by a client; and `src/config.ts` is precisely
      // the module whose job is to NAME values — a literal there is bound to a
      // name on the very line it is written.
      '@typescript-eslint/no-magic-numbers': 'off',
    },
  },
  prettier,
);
