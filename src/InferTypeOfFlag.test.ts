import { describe, expect, expectTypeOf, it } from 'vitest';

import { Flag } from './Flag.js';
import type { InferTypeOfFlag } from './InferTypeOfFlag.js';
import { number } from './number.js';

describe('InferTypeOfFlag', () => {
	it('infers optional single number', () => {
		const example = number({ min: 10, max: 100 });

		expect(example).toBeDefined();
		expectTypeOf<InferTypeOfFlag<typeof example>>().toEqualTypeOf<number | undefined>();
	});

	it('infers number for default and required flags', () => {
		const withDefault = number({ min: 10 }).default(50);
		const required = number({ min: 10 }).required();

		expectTypeOf<InferTypeOfFlag<typeof withDefault>>().toEqualTypeOf<number>();
		expectTypeOf<InferTypeOfFlag<typeof required>>().toEqualTypeOf<number>();
	});

	it('infers multiple values correctly', () => {
		const optionalMultiple = number({ allowMultiple: true, min: 10 });
		const requiredMultiple = number({ allowMultiple: true, min: 10 }).required();

		expectTypeOf<InferTypeOfFlag<typeof optionalMultiple>>().toEqualTypeOf<number[] | undefined>();
		expectTypeOf<InferTypeOfFlag<typeof requiredMultiple>>().toEqualTypeOf<number[]>();
	});

	it('works with Flag type directly', () => {
		expectTypeOf<InferTypeOfFlag<Flag<number, false, true>>>().toEqualTypeOf<number | undefined>();
		expectTypeOf<InferTypeOfFlag<Flag<number, false, false>>>().toEqualTypeOf<number>();
		expectTypeOf<InferTypeOfFlag<Flag<number, true, true>>>().toEqualTypeOf<number[] | undefined>();
		expectTypeOf<InferTypeOfFlag<Flag<number, true, false>>>().toEqualTypeOf<number[]>();
	});
});
