import { describe, expect, it } from 'vitest';

import { url } from './url.js';

describe('url()', () => {
	it('parses a valid URL', () => {
		const parsed = url().parse('https://example.com/path?a=1');

		expect(parsed).toBeInstanceOf(URL);
		expect(parsed?.href).toBe('https://example.com/path?a=1');
	});

	it('throws for invalid URL values', () => {
		expect(() => url().parse('not-a-url')).toThrow("Value 'not-a-url' is not a valid URL");
	});
});
