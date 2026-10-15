import {
	type Defined,
	type DefaultValue,
	type ELEMENT,
	type IsMultiple,
	Param,
	type Toggle,
	type VALUE,
} from './param';
import { type NumberOptions, type Parse, parsers, type StringOptions } from './value';

export interface FlagOptions {
	/** Shown in help. */
	description: string;
	/** Alternative name, without dashes: `'v'` → `-v`, `'dir'` → `--dir`. */
	alias?: string;
	/** Hide from help. */
	hidden?: boolean;
}

/**
 * A flag that takes a value: `--name value`, `--name=value`, `-n value`.
 *
 * `T` is the resolved type (e.g. `string[] | undefined`); `V` is what one input parses to.
 * Modifier return types are written out inline so editors show resolved types.
 */
export interface Flag<T, V extends Defined> {
	readonly kind: 'flag';
	readonly options: FlagOptions;
	readonly [VALUE]: T;
	readonly [ELEMENT]: V;
	/** Must be provided. Clears any default. */
	required<R extends boolean = true>(
		required?: R,
	): Flag<(IsMultiple<T, V> extends true ? V[] : V) | (R extends true ? never : undefined), V>;
	/** Accept the flag repeatedly, collecting values into an array. Converts any default. */
	multiple<M extends boolean = true>(
		allow?: M,
	): Flag<(M extends true ? V[] : V) | (undefined extends T ? undefined : never), V>;
	/** Value used when the flag is absent. Clears `required`. */
	default(value: DefaultValue<T, V>): Flag<IsMultiple<T, V> extends true ? V[] : V, V>;
}

/** A value-less flag (`--verbose`, `--no-verbose`, `-vvv`), always resolving to a value. */
export interface Switch<T> {
	readonly kind: 'switch';
	readonly options: FlagOptions;
	readonly [VALUE]: T;
	readonly [ELEMENT]: T;
	default(value: T): Switch<T>;
}

// oxlint-disable-next-line no-explicit-any
export type AnyFlag = Flag<any, any> | Switch<any>;

export type FlagRecord = Record<string, AnyFlag>;

/** Turns a parser into a flag creator. All built-in value flags are made this way. */
const custom =
	<V extends Defined, O extends object = {}>(parse: Parse<V, O>, valueName = 'value') =>
	(options: FlagOptions & O): Flag<V | undefined, V> => {
		const value = { name: valueName, parse: (input: string) => parse(input, options) };
		const state = { required: false, multiple: false, hasDefault: false };
		return new Param('flag', value, options, state) as unknown as Flag<V | undefined, V>;
	};

const toggle = <V>(valueName: string, initial: V, reduce: Toggle<V>) => {
	return (options: FlagOptions): Switch<V> => {
		const value = {
			name: valueName,
			parse: () => {
				throw new Error('switches do not take a value');
			},
		};
		const state = { required: false, multiple: false, hasDefault: true };
		return new Param('switch', value, options, state, initial, reduce) as unknown as Switch<V>;
	};
};

export const flag = {
	/** `--name` → `true`, `--no-name` → `false`. Defaults to `false`. */
	boolean: toggle('boolean', false, (occurrences) => occurrences.at(-1) ?? false),
	/** Counts occurrences: `-vvv` → `3`; `--no-name` resets to `0`. Defaults to `0`. */
	count: toggle('count', 0, (occurrences) =>
		occurrences.reduce((count, on) => (on ? count + 1 : 0), 0),
	),
	custom,
	/** Path to a directory, resolved to an absolute path. */
	directory: custom(parsers.directory, 'directory'),
	email: custom(parsers.email, 'email'),
	/** Path to a file, resolved to an absolute path. */
	file: custom(parsers.file, 'file'),
	number: custom<number, NumberOptions>(parsers.number, 'number'),
	string: custom(parsers.string, 'string') as <const C extends string = string>(
		options: FlagOptions & StringOptions<C>,
	) => Flag<NoInfer<C> | undefined, NoInfer<C>>,
	url: custom(parsers.url, 'url'),
};
