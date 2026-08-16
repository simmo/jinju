import { describe, expect, it } from 'vitest';

import { number } from './number.js';

describe('number()', () => {
	it('parses a valid numeric value', () => {
		expect(number({ min: 10, max: 100 }).parse('50')).toBe(50);
	});

	it('returns undefined when optional and missing', () => {
		expect(number({ min: 10 }).parse(undefined)).toBeUndefined();
	});

	it('throws when outside min/max constraints', () => {
		expect(() => number({ min: 10, max: 100 }).parse('5')).toThrow("Value '5' must be at least 10");
		expect(() => number({ min: 10, max: 100 }).parse('150')).toThrow(
			"Value '150' must be at most 100",
		);
	});

	it('parses repeated values when allowMultiple is enabled', () => {
		expect(number({ allowMultiple: true, min: 10 }).parse('20', '30')).toEqual([20, 30]);
	});

	it('throws when any multiple value is invalid', () => {
		expect(() => number({ allowMultiple: true, min: 10 }).parse('5', '15')).toThrow(
			"Value '5' must be at least 10",
		);
	});

	it('returns undefined for missing multiple values', () => {
		expect(number({ allowMultiple: true }).parse(undefined)).toBeUndefined();
	});
});
