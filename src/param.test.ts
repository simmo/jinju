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

describe('switches', () => {
	test('boolean uses the last occurrence', () => {
		const param = toParam(flag.boolean(d));
		expect(param.resolveSwitch([])).toBe(false);
		expect(param.resolveSwitch([true])).toBe(true);
		expect(param.resolveSwitch([true, false])).toBe(false);
		expect(toParam(flag.boolean(d).default(true)).resolveSwitch([])).toBe(true);
	});

	test('count counts, negation resets', () => {
		const param = toParam(flag.count(d));
		expect(param.resolveSwitch([])).toBe(0);
		expect(param.resolveSwitch([true, true, true])).toBe(3);
		expect(param.resolveSwitch([true, false, true])).toBe(1);
	});
});
