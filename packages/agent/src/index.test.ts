import { describe, it, expect } from 'vitest';
import { helloAgent } from './index';

describe('agent smoke', () => {
	it('helloAgent returns readiness string', () => {
		expect(helloAgent()).toBe('agent-ready');
	});
});
