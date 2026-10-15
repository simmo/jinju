import {
	type Defined,
	type DefaultValue,
	type ELEMENT,
	type IsMultiple,
	Param,
	type VALUE,
} from './param';
import { type NumberOptions, type Parse, parsers, type StringOptions } from './value';

export interface ArgOptions {
	/** Shown in help. */
	description: string;
	/** Display name in usage, e.g. `'files'` → `<files>`. Defaults to the value type's name. */
	name?: string;
}

/**
 * A positional argument. Optional by default.
 *
 * `T` is the resolved type (e.g. `string[] | undefined`); `V` is what one input parses to.
 */
export interface Arg<T, V extends Defined> {
	readonly kind: 'arg';
	readonly options: ArgOptions;
	readonly [VALUE]: T;
	readonly [ELEMENT]: V;
	/** Must be provided. Clears any default. */
	required<R extends boolean = true>(
		required?: R,
	): Arg<(IsMultiple<T, V> extends true ? V[] : V) | (R extends true ? never : undefined), V>;
	/** Collect a run of positionals into an array. Only one arg per command may be multiple. */
	multiple<M extends boolean = true>(
		allow?: M,
	): Arg<(M extends true ? V[] : V) | (undefined extends T ? undefined : never), V>;
	/** Value used when the arg is absent. Clears `required`. */
	default(value: DefaultValue<T, V>): Arg<IsMultiple<T, V> extends true ? V[] : V, V>;
}

// oxlint-disable-next-line no-explicit-any
export type AnyArg = Arg<any, any>;

export type ArgList = readonly AnyArg[];

/** Turns a parser into an arg creator. All built-in args are made this way. */
const custom =
	<V extends Defined, O extends object = {}>(parse: Parse<V, O>, valueName = 'value') =>
	(options: ArgOptions & O): Arg<V | undefined, V> => {
		const value = { name: valueName, parse: (input: string) => parse(input, options) };
		const state = { required: false, multiple: false, hasDefault: false };
		return new Param('arg', value, options, state) as unknown as Arg<V | undefined, V>;
	};

export const arg = {
	custom,
	/** Path to a directory, resolved to an absolute path. */
	directory: custom(parsers.directory, 'directory'),
	email: custom(parsers.email, 'email'),
	/** Path to a file, resolved to an absolute path. */
	file: custom(parsers.file, 'file'),
	number: custom<number, NumberOptions>(parsers.number, 'number'),
	string: custom(parsers.string, 'string') as <const C extends string = string>(
		options: ArgOptions & StringOptions<C>,
	) => Arg<NoInfer<C> | undefined, NoInfer<C>>,
	url: custom(parsers.url, 'url'),
};
