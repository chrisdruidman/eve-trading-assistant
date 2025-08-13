import { describe, it, expect } from 'vitest';
import { helloBackend } from './index';

describe('backend smoke', () => {
	it('helloBackend returns readiness string', () => {
		expect(helloBackend()).toBe('backend-ready');
	});
});
