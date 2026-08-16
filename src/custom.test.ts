import { describe, expect, it } from 'vitest';

import { custom } from './custom.js';

describe('custom()', () => {
	it('returns a new flag instance each time', () => {
		const create = custom({
			parse: (value, options: { offset: number }) => Number(value) + options.offset,
		});

		expect(create({ offset: 1 })).not.toBe(create({ offset: 1 }));
	});

	it('passes non-config options to parser', () => {
		const prefixed = custom({
			parse: (value, options: { prefix: string }) => `${options.prefix}${value}`,
		});

		expect(prefixed({ prefix: 'x-' }).parse('abc')).toBe('x-abc');
	});

	it('accepts config fields without affecting parser options', () => {
		const prefixed = custom({
			parse: (value, options: { prefix: string }) => `${options.prefix}${value}`,
		});

		expect(prefixed({ prefix: 'x-', alias: 'p', description: 'prefix flag' }).parse('abc')).toBe(
			'x-abc',
		);
	});
});
