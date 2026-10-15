import type { AnyArg, ArgList } from './arg';
import type { AnyFlag, FlagRecord } from './flag';
import type { ELEMENT, IsMultiple, VALUE } from './param';

export type Simplify<T> = { [K in keyof T]: T[K] } & {};

/** The value a flag resolves to, e.g. `flag.url().multiple()` → `URL[] | undefined`. */
export type InferFlagType<F extends AnyFlag> = F[typeof VALUE];

/** The value an arg resolves to. */
export type InferArgType<A extends AnyArg> = A[typeof VALUE];

export type InferFlags<F extends FlagRecord> = Simplify<{ [K in keyof F]: InferFlagType<F[K]> }>;

export type InferArgs<A extends ArgList> = { -readonly [K in keyof A]: InferArgType<A[K]> };

type CountMultiple<A extends ArgList, Count extends unknown[] = []> = A extends readonly [
	infer Head extends AnyArg,
	...infer Rest extends ArgList,
]
	? CountMultiple<
			Rest,
			IsMultiple<Head[typeof VALUE], Head[typeof ELEMENT]> extends true ? [...Count, Head] : Count
		>
	: Count['length'];

/** Resolves to an unsatisfiable shape when more than one arg is `.multiple()`. */
export type CheckArgs<A extends ArgList> =
	CountMultiple<A> extends 0 | 1 ? unknown : { '~error': 'Only one arg can be .multiple()' };
