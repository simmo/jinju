import { ConfigError } from './errors';
import { type Defined, type DefaultValues, Param } from './param';
import {
	type CheckSchemaInput,
	type SchemaOutput,
	type StandardSchemaV1,
	schemaParser,
} from './schema';
import {
	type NumberOptions,
	type Parse,
	parseDate,
	parseDirectory,
	parseEmail,
	parseFile,
	parseJson,
	parseEntry,
	parseNumber,
	parseString,
	parseUrl,
	type StringOptions,
} from './value';

export interface ArgOptions<N extends string | undefined = string | undefined> {
	/** Shown in help. */
	description: string;
	/**
	 * Display name in usage, e.g. `'files'` → `<files>`. Defaults to the value type's name.
	 * Also binds the arg to a `:name` dynamic segment, which is checked at compile time.
	 */
	name?: N;
}

/** A positional argument. Optional by default. `N` is its `name`, when given as a literal. */
export class Arg<T, V extends Defined, N extends string | undefined = undefined> extends Param<
	T,
	V
> {
	readonly kind = 'arg';
	declare readonly options: ArgOptions<N>;

	/** Must be provided. Clears any default. */
	required<R extends boolean = true>(
		required: R = true as R,
	): Arg<Exclude<T, undefined> | (R extends true ? never : undefined), V, N> {
		// Same runtime class; only the type parameters change.
		return this.setRequired(required) as never;
	}

	/**
	 * Accept several values, one per word, collected into an array.
	 * Unlike flags, args take no separator: the words already separate the values.
	 */
	multiple<M extends boolean = true>(
		allow: M = true as M,
	): Arg<(M extends false ? V : V[]) | (undefined extends T ? undefined : never), V, N> {
		// The type allows only booleans; this stops options passed from JavaScript.
		// `setMultiple` rejects other non-booleans.
		if (typeof allow === 'object' && allow !== null && !Array.isArray(allow)) {
			throw new ConfigError("Args don't take a separator");
		}
		return this.setMultiple(allow) as never;
	}

	/**
	 * Values used when absent: `.default('x')`, or `.default('a', 'b')` for a `multiple` one.
	 * Each argument is one value, even an array (e.g. an `entry` pair). Clears `required`.
	 */
	default(...values: DefaultValues<T, V>): Arg<Exclude<T, undefined>, V, N> {
		return this.setDefault(values) as never;
	}
}

// oxlint-disable-next-line no-explicit-any
export type AnyArg = Arg<any, any, any>;

export type ArgList = readonly AnyArg[];

/** Turns a parser into an arg creator. All built-in args are made this way. */
const custom =
	<V extends Defined, O extends object = {}>(parse: Parse<V, O>, valueName = 'value') =>
	<const N extends string | undefined = undefined>(
		options: ArgOptions<N> & O,
	): Arg<V | undefined, V, NoInfer<N>> => {
		const value = { name: valueName, parse: (input: string) => parse(input, options) };
		const state = { required: false, multiple: false, hasDefault: false };
		return new Arg<V | undefined, V, N>({ value, options, state });
	};

export const arg = {
	custom,
	/**
	 * Uses a Standard Schema (zod, valibot, arktype, …) as the parser:
	 * `arg.schema(emailSchema, 'email')({ description: 'Email' })`. Values arrive as
	 * strings, so the schema must accept a string; non-string schemas should coerce.
	 */
	schema: <S extends StandardSchemaV1<unknown, Defined>>(
		schema: S & CheckSchemaInput<S>,
		valueName = 'value',
	) =>
		// `S` produces `SchemaOutput<S>` by definition; TypeScript can't see that for generic `S`.
		custom(schemaParser(schema as StandardSchemaV1<unknown, SchemaOutput<S>>), valueName),
	/** An ISO 8601 date (`2026-10-25`) or date and time (`2026-10-25T14:30`), as a `Date`. */
	date: custom(parseDate, 'date'),
	/** Path to a directory, resolved to an absolute path. */
	directory: custom(parseDirectory, 'directory'),
	email: custom(parseEmail, 'email'),
	/** Path to a file, resolved to an absolute path. */
	file: custom(parseFile, 'file'),
	/** Any JSON value: `--data '{"a":1}'`. */
	json: custom(parseJson, 'json'),
	/** `key=value`, as a `[key, value]` pair. With `.multiple()`, pass to `Object.fromEntries`. */
	entry: custom(parseEntry, 'key=value'),
	// `N` comes first, as it did before `choices`, so `arg.number<'count'>(…)` keeps working.
	number: custom<number, NumberOptions>(parseNumber, 'number') as <
		const N extends string | undefined = undefined,
		const C extends number = number,
	>(
		options: ArgOptions<N> & NumberOptions<C>,
	) => Arg<NoInfer<C> | undefined, NoInfer<C>, NoInfer<N>>,
	string: custom(parseString, 'string') as <
		const C extends string = string,
		const N extends string | undefined = undefined,
	>(
		options: ArgOptions<N> & StringOptions<C>,
	) => Arg<NoInfer<C> | undefined, NoInfer<C>, NoInfer<N>>,
	url: custom(parseUrl, 'url'),
};
