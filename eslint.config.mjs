// @ts-check

import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import PrettierRecommended from 'eslint-plugin-prettier/recommended';

export default [
  ...tseslint.config(eslint.configs.recommended, tseslint.configs.recommended),
  PrettierRecommended,
  {
    ignores: ['dist/'],
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
];
