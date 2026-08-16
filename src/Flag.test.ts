import { describe, expect, it } from 'vitest';

import { Flag } from './Flag.js';

describe('Flag', () => {
	const createNumberFlag = () =>
		new Flag<number, false, true>({
			parseSingle: (value) => Number(value),
			allowMultiple: false,
			required: false,
			defaultValue: undefined,
		});

	it('default returns a new flag and does not mutate original', () => {
		const base = createNumberFlag();
		const withDefault = base.default(50);

		expect(base).not.toBe(withDefault);
		expect(base.parse(undefined)).toBeUndefined();
		expect(withDefault.parse(undefined)).toBe(50);
	});

	it('required returns a new flag and does not mutate original', () => {
		const base = createNumberFlag();
		const required = base.required();

		expect(base).not.toBe(required);
		expect(base.parse(undefined)).toBeUndefined();
		expect(() => required.parse(undefined)).toThrow('Value is required');
	});

	it('default(undefined) clears default and makes flag optional', () => {
		const cleared = createNumberFlag().default(50).default(undefined);
		expect(cleared.parse(undefined)).toBeUndefined();
	});
});
