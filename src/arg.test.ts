import { describe, expect, expectTypeOf, test } from 'vitest';
import { z } from 'zod';

import { Arg, arg } from './arg';
import { toParam } from './param';

const d = { description: 'd' };

describe('creators', () => {
	test.each([
		['string', arg.string(d)],
		['number', arg.number(d)],
		['url', arg.url(d)],
		['email', arg.email(d)],
		['directory', arg.directory(d)],
		['file', arg.file(d)],
	])('%s is an optional arg', (name, created) => {
		const param = toParam(created);
		expect(param.kind).toBe('arg');
		expect(param.value.name).toBe(name);
		expect(param.state).toEqual({ required: false, multiple: false, hasDefault: false });
	});

	test('keeps the display name', () => {
		expect(toParam(arg.file({ ...d, name: 'source' })).options.name).toBe('source');
	});

	test('passes creator options to the parser', async () => {
		const param = toParam(arg.string({ ...d, choices: ['a', 'b'] }));
		expect(await param.resolve(['a'], '<x>')).toEqual({ ok: true, value: 'a' });
		expect(await param.resolve(['c'], '<x>')).toMatchObject({ ok: false });
	});
});

describe('modifiers', () => {
	test('return args', () => {
		const base = arg.number(d);
		for (const modified of [base.required(), base.multiple(), base.default(1)]) {
			expect(modified).toBeInstanceOf(Arg);
			expect(modified).not.toBe(base);
		}
	});

	test('multiple resolves to arrays', async () => {
		const param = toParam(arg.number(d).multiple().required());
		expect(await param.resolve(['1', '2'], '<x>')).toEqual({ ok: true, value: [1, 2] });
	});
});

test('custom', async () => {
	const upper = arg.custom((input) => input.toUpperCase(), 'word');
	const param = toParam(upper(d));
	expect(param.value.name).toBe('word');
	expect(await param.resolve(['a'], '<x>')).toEqual({ ok: true, value: 'A' });
});

test('literal names are kept in the type', () => {
	const named = arg.string({ name: 'project', description: 'd' }).required().multiple();
	expectTypeOf(named).toEqualTypeOf<Arg<string[], string, 'project'>>();
	expectTypeOf(arg.number(d)).toEqualTypeOf<Arg<number | undefined, number, undefined>>();
	const choice = arg.string({ name: 'env', description: 'd', choices: ['a', 'b'] });
	expectTypeOf(choice).toEqualTypeOf<Arg<'a' | 'b' | undefined, 'a' | 'b', 'env'>>();
	const custom = arg.custom((input) => input.length)({ name: 'size', description: 'd' });
	expectTypeOf(custom).toEqualTypeOf<Arg<number | undefined, number, 'size'>>();
});

test('schema', async () => {
	const target = arg.schema(z.url(), 'url')({ name: 'target', description: 'd' }).required();
	expectTypeOf(target).toEqualTypeOf<Arg<string, string, 'target'>>();
	const param = toParam(target);
	expect(await param.resolve(['https://a.b'], '<target>')).toEqual({
		ok: true,
		value: 'https://a.b',
	});
	expect(await param.resolve(['nope'], '<target>')).toMatchObject({ ok: false });
	// @ts-expect-error command-line values are strings; use z.coerce.date()
	arg.schema(z.date());
});
