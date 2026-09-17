import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default defineConfig(
  { ignores: ['dist/**', 'node_modules/**', 'coverage/**'] },
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
      // Le contenu et le contrat sont typés de bout en bout : un `any` qui
      // traverse une frontière annule la garantie que tout ce dépôt vend.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // Un littéral de configuration dispersé dans le code est une valeur
      // magique : les constantes vivent dans un module nommé.
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
    // ── La frontière Worker, tenue par le linter ──
    //
    // Un Worker n'a pas de système de fichiers. `node:crypto` est la seule
    // exception : workerd l'implémente et rend le même octet que Node, ce qui
    // est ce qui permet de comparer une empreinte calculée au build à une
    // empreinte calculée dans l'isolat.
    //
    // La liste d'exemptions est explicite à dessein : y ajouter un fichier est
    // une décision — « ce module ne tournera jamais sur Workers » — pas un
    // effet de bord. Attention, la règle ne voit que les importations
    // DIRECTES ; le transitif est couvert par `npm run smoke`, qui exerce le
    // Worker sur workerd.
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
                "Ce module tourne sur Cloudflare Workers, qui n'a pas de système de fichiers. " +
                'Le code qui a besoin du disque vit dans src/node/ ou dans les modules de build du CV.',
            },
            {
              group: ['playwright', 'playwright-core'],
              message:
                'Chromium ne tourne pas sur Workers : le rendu du CV est déclenché par le build.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['tests/**/*.ts', 'scripts/**/*.ts', '*.config.ts', 'src/config.ts'],
    rules: {
      // Un test se lit mieux avec ses valeurs attendues sous les yeux ; un
      // script d'outillage n'est pas consommé par un client ; et `src/config.ts`
      // est précisément le module dont le rôle est de NOMMER les valeurs — un
      // littéral y est lié à un nom sur la ligne même où il est écrit.
      '@typescript-eslint/no-magic-numbers': 'off',
    },
  },
  prettier,
);
