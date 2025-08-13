import { describe, it, expect } from 'vitest';
import { placeholder } from './index';

describe('frontend smoke', () => {
	it('placeholder readiness string', () => {
		expect(placeholder).toBe('frontend-ready');
	});
});
