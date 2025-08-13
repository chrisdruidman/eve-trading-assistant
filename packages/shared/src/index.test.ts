import { describe, it, expect } from 'vitest';
import { sharedReady } from './index';

describe('shared smoke', () => {
	it('sharedReady is true', () => {
		expect(sharedReady).toBe(true);
	});
});
