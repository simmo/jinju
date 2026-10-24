import { describe, expect, test } from 'vitest';

import { arg } from './arg';
import { flag } from './flag';
import { toParam } from './param';

const d = { description: 'd' };
const resolve = (param: unknown, inputs: string[]) => toParam(param).resolve(inputs, '--x');

describe('modifiers', () => {
	test('return new instances', () => {
		const base = flag.string(d);
		const required = base.required();
		expect(required).not.toBe(base);
		expect(toParam(base).state.required).toBe(false);
		expect(toParam(required).state.required).toBe(true);
	});

	test('required and default are last-wins', () => {
		const a = toParam(flag.string(d).default('x').required());
		expect(a.state).toMatchObject({ required: true, hasDefault: false });
		const b = toParam(flag.string(d).required().default('x'));
		expect(b.state).toMatchObject({ required: false, hasDefault: true });
	});

	test('multiple takes a separator, which only that call sets', () => {
		const tags = flag.string(d).multiple({ separator: ',' });
		const split = toParam(tags);
		expect(split.state).toEqual({
			required: false,
			multiple: true,
			hasDefault: false,
			separator: ',',
		});
		expect(toParam(flag.string(d).multiple({})).state.separator).toBeUndefined();
		expect(toParam(tags.multiple()).state).not.toHaveProperty('separator');
		expect(toParam(tags.multiple(false)).state).not.toHaveProperty('separator');
		expect(() => flag.string(d).multiple({ separator: '' })).toThrow(
			'A separator must not be empty',
		);
	});

	test('multiple converts an existing default', () => {
		const many = toParam(flag.string(d).default('a').multiple());
		expect(many.defaultValue).toEqual(['a']);
		const one = toParam(flag.string(d).multiple().default(['a', 'b']).multiple(false));
		expect(one.defaultValue).toBe('a');
	});
});

describe('resolve', () => {
	test('absent → undefined, default, or missing error', async () => {
		expect(await resolve(flag.string(d), [])).toEqual({ ok: true, value: undefined });
		expect(await resolve(flag.string(d).default('a'), [])).toEqual({ ok: true, value: 'a' });
		const missing = await resolve(flag.string(d).required(), []);
		expect(missing.ok || missing.errors[0]!.message).toBe('Missing required --x');
	});

	test('multiple collects values', async () => {
		expect(await resolve(flag.number(d).multiple(), ['1', '2'])).toEqual({
			ok: true,
			value: [1, 2],
		});
	});

	test('a separator splits, trims and drops empty values', async () => {
		const tags = flag.string(d).multiple({ separator: ',' });
		expect(await resolve(tags, ['a,b', ' c , ,d ', 'e'])).toEqual({
			ok: true,
			value: ['a', 'b', 'c', 'd', 'e'],
		});
		expect(await resolve(tags.default(['x']), [','])).toEqual({ ok: true, value: ['x'] });
		const invalid = await resolve(flag.number(d).multiple({ separator: ',' }), ['1,x']);
		expect(invalid.ok || invalid.errors[0]!.message).toBe(
			"Invalid value 'x' for --x: must be a number",
		);
	});

	test('default arrays are copied', async () => {
		const param = flag.string(d).multiple().default(['a']);
		const first = await resolve(param, []);
		if (first.ok) (first.value as string[]).push('mutated');
		expect(await resolve(param, [])).toEqual({ ok: true, value: ['a'] });
	});

	test('singular flags reject repeats', async () => {
		const result = await resolve(flag.string(d), ['a', 'b']);
		expect(result.ok || result.errors[0]!.message).toBe('--x can only be provided once');
	});

	test('parsers may throw non-Error values', async () => {
		const shouty = flag.custom((input: string): string => {
			// oxlint-disable-next-line no-throw-literal
			throw `${input} is not loud enough`;
		});
		const result = await resolve(shouty(d), ['hi']);
		expect(result.ok || result.errors[0]!.message).toBe(
			"Invalid value 'hi' for --x: hi is not loud enough",
		);
	});

	test('collects every invalid value', async () => {
		const result = await resolve(flag.number(d).multiple(), ['a', '1', 'b']);
		expect(result.ok || result.errors.map((error) => error.message)).toEqual([
			"Invalid value 'a' for --x: must be a number",
			"Invalid value 'b' for --x: must be a number",
		]);
	});

	test('supports async custom parsers', async () => {
		const slow = flag.custom(async (input: string) => input.toUpperCase());
		expect(await resolve(slow(d), ['a'])).toEqual({ ok: true, value: 'A' });
	});

	test('args share the same machinery', async () => {
		expect(await resolve(arg.number(d).required(), ['3'])).toEqual({ ok: true, value: 3 });
	});
});

describe('toParam', () => {
	test('accepts flags, switches and args', () => {
		for (const param of [flag.string(d), flag.boolean(d), arg.number(d)]) {
			expect(toParam(param)).toBe(param);
		}
	});

	test('rejects anything else', () => {
		for (const value of [{}, null, 'flag', { kind: 'flag', options: d }]) {
			expect(() => toParam(value)).toThrow(new TypeError('Expected a flag or arg'));
		}
	});
});
