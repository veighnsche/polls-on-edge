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
			'@typescript-eslint/no-explicit-any': 'off',
			'@typescript-eslint/no-floating-promises': 'off',
			'@typescript-eslint/no-misused-promises': 'off',

			'@typescript-eslint/require-await': 'off',
			'@typescript-eslint/no-unnecessary-condition': 'off',
			'@typescript-eslint/no-unsafe-call': 'off',
			'no-unsafe-optional-chaining': 'off',
			'@typescript-eslint/strict-boolean-expressions': 'off',
			'@typescript-eslint/no-unsafe-assignment': 'off',
			'@typescript-eslint/no-unsafe-member-access': 'off',
			'@typescript-eslint/no-unsafe-return': 'off',
			'@typescript-eslint/no-unsafe-argument': 'off',
			'@typescript-eslint/no-unsafe-enum-comparison': 'off',
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
