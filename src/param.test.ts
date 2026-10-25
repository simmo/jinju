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
		for (const allow of [null, 'yes', 1, [',']]) {
			expect(() => flag.string(d).multiple(allow as never)).toThrow(
				'.multiple() takes a boolean or { separator }',
			);
		}
		for (const separator of ['', null, 1]) {
			expect(() => flag.string(d).multiple({ separator } as never)).toThrow(
				'A separator must be a non-empty string',
			);
		}
		expect(() => arg.string(d).multiple({ separator: ',' } as never)).toThrow(
			"Args don't take a separator",
		);
		expect(() => arg.string(d).multiple(null as never)).toThrow(
			'.multiple() takes a boolean or { separator }',
		);
	});

	test('defaults are a list, used whole when multiple and first otherwise', async () => {
		const on = (value: boolean) => value;
		const tags = flag.string(d).default('a').multiple(on(true));
		expect(toParam(tags).defaults).toEqual(['a']);
		expect(await resolve(tags, [])).toEqual({ ok: true, value: ['a'] });
		const after = flag.string(d).multiple(on(false)).default('a', 'b');
		expect(await resolve(after, [])).toEqual({ ok: true, value: 'a' });
		expect(await resolve(after.multiple(), [])).toEqual({ ok: true, value: ['a', 'b'] });
		// Each value is one entry, even though entries are arrays.
		const entry = flag.entry(d).default(['mode', 'fast']);
		expect(await resolve(entry.multiple(), [])).toEqual({ ok: true, value: [['mode', 'fast']] });
		expect(await resolve(entry, [])).toEqual({ ok: true, value: ['mode', 'fast'] });
		const pairs = flag.entry(d).multiple().default(['a', '1'], ['b', '2']);
		expect(toParam(pairs.multiple(false)).defaultValue).toEqual(['a', '1']);
	});

	test('default needs a value, and required clears it', () => {
		expect(() => flag.string(d).default(...([] as never as ['x']))).toThrow(
			'.default() needs at least one value',
		);
		const cleared = toParam(flag.string(d).default('a').required());
		expect(cleared.defaults).toEqual([]);
		expect(cleared.defaultValue).toBeUndefined();
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
		const empty = await resolve(tags.default('x'), [',', ' ']);
		expect(empty.ok || empty.errors[0]!.message).toBe(
			"Invalid value ',' for --x: must list at least one value, separated by ','",
		);
		const invalid = await resolve(flag.number(d).multiple({ separator: ',' }), ['1,x']);
		expect(invalid.ok || invalid.errors[0]!.message).toBe(
			"Invalid value 'x' for --x: must be a number",
		);
	});

	test('defaults are copied all the way down, except class instances', async () => {
		const config = flag.json(d).default({ nested: [1], when: null });
		const resolved = await resolve(config, []);
		if (resolved.ok) (resolved.value as { nested: number[] }).nested.push(2);
		expect(await resolve(config, [])).toEqual({ ok: true, value: { nested: [1], when: null } });

		const when = new Date('2026-10-25');
		const date = toParam(flag.date(d).default(when)).defaultValue as Date;
		expect(date).toEqual(when);
		expect(date).not.toBe(when);
		const url = new URL('https://a.b/');
		const copied = toParam(flag.url(d).default(url)).defaultValue as URL;
		expect(copied).toEqual(url);
		expect(copied).not.toBe(url);
		const bare = Object.create(null) as Record<string, number>;
		bare.a = 1;
		expect(toParam(flag.json(d).default(bare as never)).defaultValue).not.toBe(bare);

		class Point {
			constructor(readonly x: number) {}
		}
		const point = new Point(1);
		const parsePoint = flag.custom((input) => new Point(Number(input)));
		expect(toParam(parsePoint(d).default(point)).defaultValue).toBe(point);
	});

	test('default arrays are copied', async () => {
		const pairs = flag.entry(d).multiple().default(['k', 'v']);
		const resolved = await resolve(pairs, []);
		if (resolved.ok) (resolved.value as string[][])[0]!.push('mutated');
		expect(await resolve(pairs, [])).toEqual({ ok: true, value: [['k', 'v']] });
		const pair = flag.entry(d).default(['k', 'v']);
		const value = await resolve(pair, []);
		if (value.ok) (value.value as string[]).push('mutated');
		expect(await resolve(pair, [])).toEqual({ ok: true, value: ['k', 'v'] });
		const param = flag.string(d).multiple().default('a');
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
