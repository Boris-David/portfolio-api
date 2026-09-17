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
