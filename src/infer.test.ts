import { describe, expect, expectTypeOf, test } from 'vitest';

import { arg } from './arg';
import { flag } from './flag';
import type { InferArgType, InferFlagType } from './infer';
import type { MultipleOptions } from './param';
import type { JsonValue } from './value';

const d = { description: 'd' };
const url = new URL('https://example.com');

describe('InferFlagType', () => {
	test('url', () => {
		expectTypeOf<InferFlagType<ReturnType<typeof flag.url>>>().toEqualTypeOf<URL | undefined>();
		const base = flag.url(d);
		expectTypeOf<InferFlagType<typeof base>>().toEqualTypeOf<URL | undefined>();
		const multiple = base.multiple();
		expectTypeOf<InferFlagType<typeof multiple>>().toEqualTypeOf<URL[] | undefined>();
		const withDefault = base.default(url);
		expectTypeOf<InferFlagType<typeof withDefault>>().toEqualTypeOf<URL>();
		const multipleDefault = base.multiple().default(url);
		expectTypeOf<InferFlagType<typeof multipleDefault>>().toEqualTypeOf<URL[]>();
		const required = base.required();
		expectTypeOf<InferFlagType<typeof required>>().toEqualTypeOf<URL>();
		const requiredMultiple = base.required().multiple();
		expectTypeOf<InferFlagType<typeof requiredMultiple>>().toEqualTypeOf<URL[]>();
	});

	test('string', () => {
		const base = flag.string(d);
		expectTypeOf<InferFlagType<typeof base>>().toEqualTypeOf<string | undefined>();
		const multiple = base.multiple();
		expectTypeOf<InferFlagType<typeof multiple>>().toEqualTypeOf<string[] | undefined>();
		const withDefault = base.default('default');
		expectTypeOf<InferFlagType<typeof withDefault>>().toEqualTypeOf<string>();
		const multipleDefault = base.multiple().default('default');
		expectTypeOf<InferFlagType<typeof multipleDefault>>().toEqualTypeOf<string[]>();
		const required = base.required();
		expectTypeOf<InferFlagType<typeof required>>().toEqualTypeOf<string>();
		const requiredMultiple = base.required().multiple();
		expectTypeOf<InferFlagType<typeof requiredMultiple>>().toEqualTypeOf<string[]>();
	});

	test('string choices', () => {
		const base = flag.string({ ...d, choices: ['a', 'b'] });
		expectTypeOf<InferFlagType<typeof base>>().toEqualTypeOf<'a' | 'b' | undefined>();
		const multiple = base.multiple();
		expectTypeOf<InferFlagType<typeof multiple>>().toEqualTypeOf<('a' | 'b')[] | undefined>();
		const withDefault = base.default('a');
		expectTypeOf<InferFlagType<typeof withDefault>>().toEqualTypeOf<'a' | 'b'>();
		const multipleDefault = base.multiple().default('a');
		expectTypeOf<InferFlagType<typeof multipleDefault>>().toEqualTypeOf<('a' | 'b')[]>();
		const required = base.required();
		expectTypeOf<InferFlagType<typeof required>>().toEqualTypeOf<'a' | 'b'>();
		const requiredMultiple = base.required().multiple();
		expectTypeOf<InferFlagType<typeof requiredMultiple>>().toEqualTypeOf<('a' | 'b')[]>();

		// @ts-expect-error not a choice
		base.default('c');
	});

	test('number choices', () => {
		const base = flag.number({ ...d, choices: [1, 2, 4] });
		expectTypeOf<InferFlagType<typeof base>>().toEqualTypeOf<1 | 2 | 4 | undefined>();
		const withDefault = base.default(2);
		expectTypeOf<InferFlagType<typeof withDefault>>().toEqualTypeOf<1 | 2 | 4>();
		const plain = flag.number({ ...d, min: 1 });
		expectTypeOf<InferFlagType<typeof plain>>().toEqualTypeOf<number | undefined>();

		// @ts-expect-error not a choice
		base.default(3);
	});

	test('date, json and entry', () => {
		const date = flag.date(d);
		expectTypeOf<InferFlagType<typeof date>>().toEqualTypeOf<Date | undefined>();
		const json = flag.json(d).required();
		expectTypeOf<InferFlagType<typeof json>>().toEqualTypeOf<JsonValue>();
		const jsonMany = flag.json(d).multiple();
		expectTypeOf<InferFlagType<typeof jsonMany>>().toEqualTypeOf<JsonValue[] | undefined>();
		const defines = flag.entry(d).multiple();
		expectTypeOf<InferFlagType<typeof defines>>().toEqualTypeOf<
			[key: string, value: string][] | undefined
		>();
		const one = flag.entry(d).default(['a', 'b']);
		expectTypeOf<InferFlagType<typeof one>>().toEqualTypeOf<[key: string, value: string]>();
	});

	test('a separator keeps the multiple type, and only flags take one', () => {
		const tags = flag.string(d).multiple({ separator: ',' });
		expectTypeOf<InferFlagType<typeof tags>>().toEqualTypeOf<string[] | undefined>();

		expect(() =>
			// @ts-expect-error args take no separator
			arg.string(d).multiple({ separator: ',' }),
		).toThrow("Args don't take a separator");
	});

	test('modifier toggles', () => {
		const back = flag.url(d).multiple().multiple(false);
		expectTypeOf<InferFlagType<typeof back>>().toEqualTypeOf<URL | undefined>();
		const converted = flag.url(d).default(url).multiple();
		expectTypeOf<InferFlagType<typeof converted>>().toEqualTypeOf<URL[]>();
		const optional = flag.url(d).required().required(false);
		expectTypeOf<InferFlagType<typeof optional>>().toEqualTypeOf<URL | undefined>();
		const lastWins = flag.url(d).default(url).required();
		expectTypeOf<InferFlagType<typeof lastWins>>().toEqualTypeOf<URL>();
	});

	test('a non-literal boolean or options value gives a single value or an array', () => {
		const on = Math.random() > 0.5;
		const options: boolean | MultipleOptions = on ? { separator: ',' } : false;
		const flags = flag.url(d).multiple(on);
		expectTypeOf<InferFlagType<typeof flags>>().toEqualTypeOf<URL | URL[] | undefined>();
		const split = flag.string(d).multiple(options);
		expectTypeOf<InferFlagType<typeof split>>().toEqualTypeOf<string | string[] | undefined>();
		const required = flag.url(d).required().multiple(on);
		expectTypeOf<InferFlagType<typeof required>>().toEqualTypeOf<URL | URL[]>();
		const args = arg.url(d).multiple(on);
		expectTypeOf<InferArgType<typeof args>>().toEqualTypeOf<URL | URL[] | undefined>();

		// Later modifiers keep both shapes.
		const thenRequired = flag.url(d).multiple(on).required();
		expectTypeOf<InferFlagType<typeof thenRequired>>().toEqualTypeOf<URL | URL[]>();
		const thenOptional = flag.url(d).multiple(on).required(false);
		expectTypeOf<InferFlagType<typeof thenOptional>>().toEqualTypeOf<URL | URL[] | undefined>();
		// Defaults work in any order: they're kept as a list, and a single param uses the first.
		const thenDefault = flag.url(d).multiple(on).default(url, url);
		expectTypeOf<InferFlagType<typeof thenDefault>>().toEqualTypeOf<URL | URL[]>();
		const defaultFirst = flag.url(d).default(url).multiple(on);
		expectTypeOf<InferFlagType<typeof defaultFirst>>().toEqualTypeOf<URL | URL[]>();
		// `JsonValue | JsonValue[]` is just `JsonValue`, so this looks single: one default.
		flag.json(d).multiple(on).default({ a: 1 });
		// @ts-expect-error one value, since the type can't tell it may be multiple
		flag.json(d).multiple(on).default({ a: 1 }, { b: 2 });
		const json = flag.json(d).default([1, 2]);
		expectTypeOf<InferFlagType<typeof json>>().toEqualTypeOf<JsonValue>();
		const argRequired = arg.url(d).multiple(on).required();
		expectTypeOf<InferArgType<typeof argRequired>>().toEqualTypeOf<URL | URL[]>();
		const argDefault = arg.url(d).multiple(on).default(url);
		expectTypeOf<InferArgType<typeof argDefault>>().toEqualTypeOf<URL | URL[]>();
	});

	test('default values', () => {
		const many = flag.url(d).multiple().default(url, url);
		expectTypeOf<InferFlagType<typeof many>>().toEqualTypeOf<URL[]>();
		// One argument per value, so an array is one value of an array type.
		const pairs = flag.entry(d).multiple().default(['a', '1'], ['b', '2']);
		expectTypeOf<InferFlagType<typeof pairs>>().toEqualTypeOf<[key: string, value: string][]>();
		expect(() =>
			// @ts-expect-error no values
			flag.url(d).multiple().default(),
		).toThrow('.default() needs at least one value');
		// @ts-expect-error an array of values is not a value
		flag.url(d).multiple().default([url]);
		// @ts-expect-error a single flag has one default
		flag.url(d).default(url, url);
		// @ts-expect-error wrong value type
		flag.number(d).default('1');
	});

	test('switches', () => {
		const verbose = flag.boolean(d);
		expectTypeOf<InferFlagType<typeof verbose>>().toEqualTypeOf<boolean>();
		const count = flag.count(d);
		expectTypeOf<InferFlagType<typeof count>>().toEqualTypeOf<number>();
		// @ts-expect-error switches cannot be multiple
		expect(() => verbose.multiple()).toThrow(TypeError);
		// @ts-expect-error switches cannot be required
		expect(() => verbose.required()).toThrow(TypeError);
	});

	test('custom', () => {
		const date = flag.custom((input: string, options: { utc?: boolean }) => {
			void options;
			return new Date(input);
		});
		const when = date({ ...d, utc: true }).required();
		expectTypeOf<InferFlagType<typeof when>>().toEqualTypeOf<Date>();
		const list = flag.custom((input) => input.split(','))(d);
		expectTypeOf<InferFlagType<typeof list>>().toEqualTypeOf<string[] | undefined>();
		const lists = list.multiple().required();
		expectTypeOf<InferFlagType<typeof lists>>().toEqualTypeOf<string[][]>();
		const single = lists.multiple(false);
		expectTypeOf<InferFlagType<typeof single>>().toEqualTypeOf<string[]>();
		// @ts-expect-error parsers can't return undefined (it means "not provided")
		flag.custom((input) => (input ? input : undefined));
		const asyncFlag = flag.custom(async (input) => input.length)(d);
		expectTypeOf<InferFlagType<typeof asyncFlag>>().toEqualTypeOf<number | undefined>();
	});
});

describe('InferArgType', () => {
	test('optional by default', () => {
		const file = arg.file(d);
		expectTypeOf<InferArgType<typeof file>>().toEqualTypeOf<string | undefined>();
		const files = arg.file(d).multiple().required();
		expectTypeOf<InferArgType<typeof files>>().toEqualTypeOf<string[]>();
	});
});
