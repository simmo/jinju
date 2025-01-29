import eslint from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import * as importPlugin from 'eslint-plugin-import';
import eslintPluginUnicorn from 'eslint-plugin-unicorn';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
	{
		files: ['**/*.{js,mjs,cjs,ts}'],
	},
	{
		languageOptions: {
			globals: globals.node,
		},
	},
	eslint.configs.recommended,
	tseslint.configs.strict,
	tseslint.configs.stylistic,
	eslintConfigPrettier,
	{
		plugins: {
			import: importPlugin,
			unicorn: eslintPluginUnicorn,
		},
		rules: {
			'unicorn/prefer-node-protocol': 'error',
			'import/order': [
				'error',
				{
					groups: [
						'builtin',
						'index',
						'external',
						'internal',
						'parent',
						'sibling',
					],
					pathGroupsExcludedImportTypes: ['builtin'],
					'newlines-between': 'always',
					alphabetize: {
						order: 'asc',
						caseInsensitive: true,
					},
				},
			],
		},
	}
);
