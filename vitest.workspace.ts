import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
	{ test: { include: ['packages/backend/**/*.{test,spec}.ts'] } },
	{ test: { include: ['packages/agent/**/*.{test,spec}.ts'] } },
	{ test: { include: ['packages/shared/**/*.{test,spec}.ts'] } },
	{ test: { include: ['packages/frontend/**/*.{test,spec}.ts'] } }
]);


