import type { AnyArg, ArgList } from './arg';
import type { AnyFlag, FlagRecord } from './flag';
import type { ELEMENT, IsMultiple, VALUE } from './param';

/** The value a flag resolves to, e.g. `flag.url().multiple()` → `URL[] | undefined`. */
export type InferFlagType<F extends AnyFlag> = F[typeof VALUE];

/** The value an arg resolves to. */
export type InferArgType<A extends AnyArg> = A[typeof VALUE];

// `& {}` makes editors show the resolved object rather than the alias name.
export type InferFlags<F extends FlagRecord> = { [K in keyof F]: InferFlagType<F[K]> } & {};

/** `A` with `B`'s keys added or replaced: how scope and command flags combine. */
export type MergeFlags<A, B> = {
	[K in keyof (Omit<A, keyof B> & B)]: (Omit<A, keyof B> & B)[K];
} & {};

export type InferArgs<A extends ArgList> = { -readonly [K in keyof A]: InferArgType<A[K]> };

/** Resolves to an unsatisfiable shape when more than one arg is `.multiple()`. */
export type CheckArgs<A extends ArgList, Seen extends boolean = false> = A extends readonly [
	infer Head extends AnyArg,
	...infer Rest extends ArgList,
]
	? IsMultiple<Head[typeof VALUE], Head[typeof ELEMENT]> extends true
		? Seen extends true
			? { '~error': 'Only one arg can be .multiple()' }
			: CheckArgs<Rest, true>
		: CheckArgs<Rest, Seen>
	: unknown;
