/** @type {import('eslint').Linter.Config} */
module.exports = {
	root: true,
	ignorePatterns: ['**/dist/**', '**/build/**', '**/node_modules/**'],
	env: { es2022: true, node: true, browser: false },
	parser: '@typescript-eslint/parser',
	parserOptions: {
		ecmaVersion: 'latest',
		sourceType: 'module',
	},
	plugins: ['@typescript-eslint'],
	extends: ['plugin:@typescript-eslint/recommended', 'prettier'],
	rules: {
		'@typescript-eslint/consistent-type-imports': 'warn',
		'@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
	},
	overrides: [
		{
			files: ['**/*.ts', '**/*.tsx'],
		},
	],
};
