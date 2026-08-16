import { describe, expect, it } from 'vitest';

import { boolean } from './boolean.js';

describe('boolean()', () => {
	it('parses true and false', () => {
		expect(boolean().parse('true')).toBe(true);
		expect(boolean().parse('false')).toBe(false);
	});

	it('throws for invalid boolean values', () => {
		expect(() => boolean().parse('yes')).toThrow("Value 'yes' must be 'true' or 'false'");
	});
});
