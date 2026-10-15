import { describe, expectTypeOf, test } from 'vitest';

import { arg } from './arg';
import { flag } from './flag';
import type { InferArgType, InferFlagType } from './infer';

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
		verbose.multiple();
		// @ts-expect-error switches cannot be required
		verbose.required();
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
