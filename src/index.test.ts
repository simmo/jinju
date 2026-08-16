import { describe, expect, it } from 'vitest';

import { flag } from './index.js';

describe('exports', () => {
	it('flag helpers', () => {
		expect(flag.boolean).toBeDefined();
		expect(flag.custom).toBeDefined();
		expect(flag.number).toBeDefined();
		expect(flag.string).toBeDefined();
		expect(flag.url).toBeDefined();
	});
});
