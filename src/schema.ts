import type { Parse } from './value';

/**
 * The Standard Schema interface (https://standardschema.dev), as far as jinju uses it.
 * Structurally compatible with `@standard-schema/spec`, so schemas from any compliant
 * library (zod, valibot, arktype, …) can be used without jinju depending on them.
 */
export interface StandardSchemaV1<Input = unknown, Output = Input> {
	readonly '~standard': {
		readonly version: 1;
		readonly vendor: string;
		readonly validate: (
			value: unknown,
		) => StandardSchemaResult<Output> | Promise<StandardSchemaResult<Output>>;
		readonly types?: { readonly input: Input; readonly output: Output } | undefined;
	};
}

/** What a Standard Schema's `validate` returns. */
export type StandardSchemaResult<Output> =
	| { readonly value: Output; readonly issues?: undefined }
	| { readonly issues: readonly StandardSchemaIssue[] };

/** A validation problem reported by a Standard Schema. */
export interface StandardSchemaIssue {
	readonly message: string;
	readonly path?: readonly (PropertyKey | { readonly key: PropertyKey })[] | undefined;
}

/** A schema's declared input type, or `unknown` when it doesn't declare `types`. */
export type SchemaInput<S extends StandardSchemaV1> = [
	NonNullable<S['~standard']['types']>,
] extends [never]
	? unknown
	: NonNullable<S['~standard']['types']>['input'];

/** What a schema validates to. */
export type SchemaOutput<S extends StandardSchemaV1> =
	S extends StandardSchemaV1<unknown, infer Output> ? Output : never;

/**
 * Resolves to `unknown` when the schema can receive a string (its input includes a string
 * type, or is `unknown`/`any` as with coercing schemas), else to an unsatisfiable shape.
 * Command-line values are always strings, so schemas like `z.number()` would always fail.
 */
export type CheckSchemaInput<S extends StandardSchemaV1> = [
	Extract<SchemaInput<S>, string>,
] extends [never]
	? string extends SchemaInput<S>
		? unknown
		: {
				'~error': 'Schema input must accept a string (command-line values are strings); use a coercing schema';
			}
	: unknown;

/**
 * Turns a Standard Schema into a parser for command-line values. The input is always a
 * string, so schemas for other types should coerce. Each
 * issue's message becomes part of the error.
 */
export const schemaParser =
	<V>(schema: StandardSchemaV1<unknown, V>): Parse<V> =>
	async (input) => {
		const result = await schema['~standard'].validate(input);
		if (result.issues) throw new Error(result.issues.map((issue) => issue.message).join('; '));
		return result.value;
	};
