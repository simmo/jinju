import {
	type Defined,
	type DefaultValue,
	type IsMultiple,
	Param,
	type ParamInit,
	type Toggle,
} from './param';
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

export interface FlagOptions {
	/** Shown in help. */
	description: string;
	/** Alternative name, without dashes: `'v'` → `-v`, `'dir'` → `--dir`. */
	alias?: string;
	/** Hide from help. */
	hidden?: boolean;
}

/** A flag that takes a value: `--name value`, `--name=value`, `-n value`. */
export class Flag<T, V extends Defined> extends Param<T, V> {
	readonly kind = 'flag';
	declare readonly options: FlagOptions;

	/** Must be provided. Clears any default. */
	required<R extends boolean = true>(
		required: R = true as R,
	): Flag<(IsMultiple<T, V> extends true ? V[] : V) | (R extends true ? never : undefined), V> {
		// Same runtime class; only the type parameters change.
		return this.setRequired(required) as never;
	}

	/** Accept repeated values, collected into an array. Converts any default. */
	multiple<M extends boolean = true>(
		allow: M = true as M,
	): Flag<(M extends true ? V[] : V) | (undefined extends T ? undefined : never), V> {
		return this.setMultiple(allow) as never;
	}

	/** Value used when absent. Clears `required`. */
	default(value: DefaultValue<T, V>): Flag<IsMultiple<T, V> extends true ? V[] : V, V> {
		return this.setDefault(value) as never;
	}
}

/** A value-less flag (`--verbose`, `--no-verbose`, `-vvv`), always resolving to a value. */
export class Switch<T> extends Param<T, T> {
	readonly kind = 'switch';
	declare readonly options: FlagOptions;
	protected readonly toggle: Toggle<T>;

	constructor(init: ParamInit<T> & { toggle: Toggle<T> }) {
		super(init);
		this.toggle = init.toggle;
	}

	/** Value used when the switch is absent. */
	default(value: T): Switch<T> {
		return this.setDefault(value);
	}

	/** Resolves from occurrences: `--x` → `true`, `--no-x` → `false`. */
	resolveSwitch(occurrences: readonly boolean[]): T {
		const [first, ...rest] = occurrences;
		return first === undefined ? (this.defaultValue as T) : this.toggle([first, ...rest]);
	}
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
		return new Flag<V | undefined, V>({ value, options, state });
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
		return new Switch<V>({ value, options, state, defaultValue: initial, toggle: reduce });
	};
};

export const flag = {
	/** `--name` → `true`, `--no-name` → `false`. Defaults to `false`. */
	boolean: toggle('boolean', false, (occurrences) => occurrences.reduce((_, on) => on)),
	/** Counts occurrences: `-vvv` → `3`; `--no-name` resets to `0`. Defaults to `0`. */
	count: toggle('count', 0, (occurrences) =>
		occurrences.reduce((count, on) => (on ? count + 1 : 0), 0),
	),
	custom,
	/** Path to a directory, resolved to an absolute path. */
	directory: custom(parseDirectory, 'directory'),
	email: custom(parseEmail, 'email'),
	/** Path to a file, resolved to an absolute path. */
	file: custom(parseFile, 'file'),
	number: custom<number, NumberOptions>(parseNumber, 'number'),
	string: custom(parseString, 'string') as <const C extends string = string>(
		options: FlagOptions & StringOptions<C>,
	) => Flag<NoInfer<C> | undefined, NoInfer<C>>,
	url: custom(parseUrl, 'url'),
};
