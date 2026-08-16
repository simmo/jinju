import { describe, expect, it } from 'vitest';

import { string } from './string.js';

describe('string()', () => {
	it('returns input as-is', () => {
		expect(string().parse('hello')).toBe('hello');
	});
});
