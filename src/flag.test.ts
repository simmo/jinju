import { describe, expect, expectTypeOf, test } from 'vitest';
import { z } from 'zod';

import { Flag, flag, Switch } from './flag';
import { toParam } from './param';

const d = { description: 'd' };
const parse = (value: unknown, input: string) => toParam(value).resolve([input], '--x');

describe('value flags', () => {
	test.each([
		['string', flag.string(d)],
		['number', flag.number(d)],
		['url', flag.url(d)],
		['email', flag.email(d)],
		['directory', flag.directory(d)],
		['file', flag.file(d)],
		['date', flag.date(d)],
		['json', flag.json(d)],
		['key=value', flag.entry(d)],
	])('%s takes a value and starts optional', (name, created) => {
		expect(created).toBeInstanceOf(Flag);
		expect(
			created
				.required()
				.multiple()
				.default('x' as never),
		).toBeInstanceOf(Flag);
		const param = toParam(created);
		expect(param.kind).toBe('flag');
		expect(param.value.name).toBe(name);
		expect(param.state).toEqual({ required: false, multiple: false, hasDefault: false });
	});

	test('keeps options for help and lookup', () => {
		const options = { description: 'Mode', alias: 'm', hidden: true, choices: ['a', 'b'] };
		expect(toParam(flag.string(options)).options).toBe(options);
	});

	test('passes creator options to the parser', async () => {
		expect(await parse(flag.number({ ...d, max: 5 }), '6')).toMatchObject({ ok: false });
		expect(await parse(flag.string({ ...d, choices: ['a'] }), 'b')).toMatchObject({ ok: false });
		expect(await parse(flag.url(d), 'https://a.b')).toEqual({
			ok: true,
			value: new URL('https://a.b'),
		});
	});
});

describe('switches', () => {
	test('boolean uses the last occurrence, defaulting to false', () => {
		const verbose = flag.boolean(d);
		expect(verbose.kind).toBe('switch');
		expect(verbose.resolveSwitch([])).toBe(false);
		expect(verbose.resolveSwitch([true])).toBe(true);
		expect(verbose.resolveSwitch([true, false])).toBe(false);
	});

	test('count counts, negation resets, defaulting to 0', () => {
		const level = flag.count(d);
		expect(level.resolveSwitch([])).toBe(0);
		expect(level.resolveSwitch([true, true, true])).toBe(3);
		expect(level.resolveSwitch([true, false, true])).toBe(1);
	});

	test('default returns a new switch that still toggles', () => {
		const base = flag.boolean(d);
		const color = base.default(true);
		expect(color).not.toBe(base);
		expect(color).toBeInstanceOf(Switch);
		expect(color.resolveSwitch([])).toBe(true);
		expect(color.resolveSwitch([false])).toBe(false);
		expect(base.resolveSwitch([])).toBe(false);
	});

	test('parse text values (used for `env`)', async () => {
		expect(await parse(flag.boolean(d), 'yes')).toEqual({ ok: true, value: true });
		expect(await parse(flag.count(d), '2')).toEqual({ ok: true, value: 2 });
		expect(await parse(flag.boolean(d), 'maybe')).toMatchObject({
			ok: false,
			errors: [{ reason: 'must be true or false' }],
		});
	});

	test('keep the env option', () => {
		expect(toParam(flag.boolean({ ...d, env: 'DEBUG' })).options.env).toBe('DEBUG');
	});
});

describe('custom', () => {
	test('creates value flags from a parser and display name', async () => {
		const date = flag.custom((input: string, options: { year?: number }) => {
			const value = new Date(input);
			if (options.year !== undefined && value.getUTCFullYear() !== options.year) {
				throw new Error(`must be in ${options.year}`);
			}
			return value;
		}, 'date');
		const param = toParam(date({ ...d, year: 2026 }));
		expect(param.value.name).toBe('date');
		expect(await param.resolve(['2026-01-01'], '--x')).toEqual({
			ok: true,
			value: new Date('2026-01-01'),
		});
		expect(await param.resolve(['2025-01-01'], '--x')).toMatchObject({
			ok: false,
			errors: [{ reason: 'must be in 2026' }],
		});
	});

	test('defaults the display name to value', () => {
		expect(toParam(flag.custom((input) => input)(d)).value.name).toBe('value');
	});
});

describe('schema', () => {
	const port = flag.schema(z.coerce.number().int().min(1), 'port');

	test('creates value flags validated by the schema', async () => {
		const param = toParam(port(d).multiple());
		expect(param.value.name).toBe('port');
		expect(await param.resolve(['80', '443'], '--port')).toEqual({ ok: true, value: [80, 443] });
		expect(await param.resolve(['0'], '--port')).toMatchObject({
			ok: false,
			errors: [{ message: expect.stringMatching(/^Invalid value '0' for --port: Too small/) }],
		});
	});

	test('types come from the schema output', () => {
		expectTypeOf(port(d)).toEqualTypeOf<Flag<number | undefined, number>>();
		const level = flag
			.schema(z.enum(['low', 'high']))(d)
			.default('low');
		expectTypeOf(level).toEqualTypeOf<Flag<'low' | 'high', 'low' | 'high'>>();
		// @ts-expect-error undefined means "not provided", so schemas can't output it
		flag.schema(z.string().optional());
	});

	test('schemas must be able to receive a string', () => {
		const declared = z.coerce.number().int();
		expectTypeOf(flag.schema(declared)(d)).toEqualTypeOf<Flag<number | undefined, number>>();
		expectTypeOf(flag.schema(z.enum(['a', 'b']))(d)).toEqualTypeOf<
			Flag<'a' | 'b' | undefined, 'a' | 'b'>
		>();
		// @ts-expect-error command-line values are strings; use z.coerce.number()
		flag.schema(z.number());
		// @ts-expect-error use z.stringbool() or flag.boolean()
		flag.schema(z.boolean());
	});

	test('defaults the display name to value', () => {
		expect(toParam(flag.schema(z.string())(d)).value.name).toBe('value');
	});
});
