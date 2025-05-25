// eslint.config.mjs
// @ts-check
import eslint from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/** @type {import('typescript-eslint').ConfigArray}*/
export const conduitConfig = tseslint.config(
  eslint.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  {
    rules: {
      // '@typescript-eslint/no-explicit-any': 'off',
      // '@typescript-eslint/no-floating-promises': 'off',
      // '@typescript-eslint/no-misused-promises': 'off',

      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/no-unnecessary-condition': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      'no-unsafe-optional-chaining': 'error',
      '@typescript-eslint/strict-boolean-expressions': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      '@typescript-eslint/no-unsafe-argument': 'error',
    },
  },
  {
    languageOptions: {
      parser: tseslint.parser,
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: process.cwd(),
      },
    },
  },
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
    },
  },
  eslintConfigPrettier,
  eslintPluginPrettierRecommended,
);

export default conduitConfig;
