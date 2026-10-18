import { type Defined, type DefaultValue, type IsMultiple, Param } from './param';
import {
	type NumberOptions,
	type Parse,
	parseDirectory,
	parseEmail,
	parseFile,
	parseNumber,
	parseString,
	parseUrl,
	type StringOptions,
} from './value';

export interface ArgOptions {
	/** Shown in help. */
	description: string;
	/** Display name in usage, e.g. `'files'` → `<files>`. Defaults to the value type's name. */
	name?: string;
}

/** A positional argument. Optional by default. */
export class Arg<T, V extends Defined> extends Param<T, V> {
	readonly kind = 'arg';
	declare readonly options: ArgOptions;

	/** Must be provided. Clears any default. */
	required<R extends boolean = true>(
		required: R = true as R,
	): Arg<(IsMultiple<T, V> extends true ? V[] : V) | (R extends true ? never : undefined), V> {
		// Same runtime class; only the type parameters change.
		return this.setRequired(required) as never;
	}

	/** Accept repeated values, collected into an array. Converts any default. */
	multiple<M extends boolean = true>(
		allow: M = true as M,
	): Arg<(M extends true ? V[] : V) | (undefined extends T ? undefined : never), V> {
		return this.setMultiple(allow) as never;
	}

	/** Value used when absent. Clears `required`. */
	default(value: DefaultValue<T, V>): Arg<IsMultiple<T, V> extends true ? V[] : V, V> {
		return this.setDefault(value) as never;
	}
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
		return new Arg<V | undefined, V>({ value, options, state });
	};

export const arg = {
	custom,
	/** Path to a directory, resolved to an absolute path. */
	directory: custom(parseDirectory, 'directory'),
	email: custom(parseEmail, 'email'),
	/** Path to a file, resolved to an absolute path. */
	file: custom(parseFile, 'file'),
	number: custom<number, NumberOptions>(parseNumber, 'number'),
	string: custom(parseString, 'string') as <const C extends string = string>(
		options: ArgOptions & StringOptions<C>,
	) => Arg<NoInfer<C> | undefined, NoInfer<C>>,
	url: custom(parseUrl, 'url'),
};
