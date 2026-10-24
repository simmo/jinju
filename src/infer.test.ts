import { describe, expect, expectTypeOf, test } from 'vitest';

import { arg } from './arg';
import { flag } from './flag';
import type { InferArgType, InferFlagType } from './infer';
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
		const multipleDefault = base.multiple().default([url]);
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
		const multipleDefault = base.multiple().default(['default']);
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
		const multipleDefault = base.multiple().default(['a']);
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

	test('a separator keeps the multiple type', () => {
		const tags = flag.string(d).multiple({ separator: ',' });
		expectTypeOf<InferFlagType<typeof tags>>().toEqualTypeOf<string[] | undefined>();
		const required = arg.number(d).required().multiple({ separator: ',' });
		expectTypeOf<InferArgType<typeof required>>().toEqualTypeOf<number[]>();
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

	test('default shape', () => {
		// @ts-expect-error singular default on a multiple flag
		flag.url(d).multiple().default(url);
		// @ts-expect-error empty default on a multiple flag
		flag.url(d).multiple().default([]);
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
