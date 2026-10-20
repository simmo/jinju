import { describe, expect, expectTypeOf, test } from 'vitest';
import { z } from 'zod';

import {
	type CheckSchemaInput,
	type SchemaInput,
	type SchemaOutput,
	type StandardSchemaV1,
	schemaParser,
} from './schema';

/** A minimal hand-written schema from another "vendor", with async validation. */
const evenNumber: StandardSchemaV1<string, number> = {
	'~standard': {
		version: 1,
		vendor: 'test',
		validate: async (value) => {
			const number = Number(value);
			return Number.isInteger(number) && number % 2 === 0
				? { value: number }
				: { issues: [{ message: 'must be even' }, { message: 'must be an integer' }] };
		},
	},
};

describe('schemaParser', () => {
	test('returns the validated output', async () => {
		expect(await schemaParser(z.coerce.number().int())('42', {})).toBe(42);
		expect(await schemaParser(z.email())('me@example.com', {})).toBe('me@example.com');
		expect(await schemaParser(evenNumber)('4', {})).toBe(4);
	});

	test('throws with the issue messages', async () => {
		await expect(schemaParser(z.email())('nope', {})).rejects.toThrow('Invalid email address');
		await expect(schemaParser(evenNumber)('3', {})).rejects.toThrow(
			'must be even; must be an integer',
		);
	});

	test('infers the output type', () => {
		expectTypeOf(schemaParser(z.coerce.number())).returns.toEqualTypeOf<number | Promise<number>>();
		expectTypeOf(schemaParser(evenNumber)).returns.toEqualTypeOf<number | Promise<number>>();
	});
});

test('zod schemas satisfy the interface', () => {
	expectTypeOf(z.string()).toExtend<StandardSchemaV1<string, string>>();
	expectTypeOf(z.coerce.number()).toExtend<StandardSchemaV1<unknown, number>>();
});

const ab = z.enum(['a', 'b']);

describe('SchemaInput and SchemaOutput', () => {
	test('read the declared types', () => {
		expectTypeOf<SchemaInput<typeof evenNumber>>().toEqualTypeOf<string>();
		expectTypeOf<SchemaOutput<typeof evenNumber>>().toEqualTypeOf<number>();
		expectTypeOf<SchemaInput<typeof ab>>().toEqualTypeOf<'a' | 'b'>();
	});

	test('an undeclared input is unknown', () => {
		expectTypeOf<SchemaInput<StandardSchemaV1>>().toBeUnknown();
	});
});

describe('CheckSchemaInput', () => {
	const port = z.coerce.number();

	test('accepts schemas that can receive a string', () => {
		expectTypeOf<CheckSchemaInput<ReturnType<typeof z.string>>>().toBeUnknown();
		expectTypeOf<CheckSchemaInput<typeof ab>>().toBeUnknown();
		expectTypeOf<CheckSchemaInput<typeof port>>().toBeUnknown();
		expectTypeOf<CheckSchemaInput<StandardSchemaV1>>().toBeUnknown();
	});

	test('rejects schemas that never can', () => {
		for (const schema of [z.number(), z.boolean(), z.date()]) {
			expectTypeOf<CheckSchemaInput<typeof schema>>().toHaveProperty('~error');
		}
	});
});
