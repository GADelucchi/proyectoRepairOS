// @ts-check
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: {
      globals: globals.node,
      parserOptions: { ecmaVersion: 2022, sourceType: 'module' }
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-console': 'off',
      eqeqeq: ['error', 'smart'],
      'prefer-const': 'error'
    }
  },
  // Las migraciones, los seeders, la config de sequelize-cli y los scripts de
  // mantenimiento de la base son CommonJS.
  {
    files: [
      'src/database/migrations/**/*.js',
      'src/database/seeders/**/*.js',
      'src/database/config/*.js',
      'src/database/demo/*.js',
      'src/database/*.js'
    ],
    languageOptions: {
      globals: globals.node,
      parserOptions: { ecmaVersion: 2022, sourceType: 'commonjs' }
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-unused-vars': 'off'
    }
  },
  prettier
);
