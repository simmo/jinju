import {
	ConfigError,
	DuplicateFlagError,
	InvalidValueError,
	type JinjuError,
	MissingRequiredError,
} from './errors';
import type { ValueType } from './value';

/** Phantom key carrying a param's resolved type, e.g. `string[] | undefined`. Never present at runtime. */
export declare const VALUE: unique symbol;

/** Phantom key carrying the type a single input parses to. Never present at runtime. */
export declare const ELEMENT: unique symbol;

/** Runtime modifier state. At the type level it's derived from a param's `T` and `V`. */
export interface ParamState {
	readonly required: boolean;
	readonly multiple: boolean;
	readonly hasDefault: boolean;
	/** Splits each input into several values, e.g. `','` for `--tag a,b`. Only when `multiple`. */
	readonly separator?: string;
}

/** Options for `.multiple()`. */
export interface MultipleOptions {
	/**
	 * Also split each value on this string: with `','`, `--tag a,b` is two values. Values
	 * are trimmed, and empty ones dropped. Applies to environment variables too.
	 */
	separator?: string;
}

/**
 * Whether resolved type `T` collects `V` values into an array. Parsers can't return
 * `undefined`, so this is unambiguous even when `V` is itself an array.
 */
export type IsMultiple<T, V> = [Exclude<T, undefined>] extends [V[]] ? true : false;

/**
 * What `.default(...values)` takes: one value for a single param, one or more for a
 * `multiple` param, or for one that may be multiple (after `.multiple(on)` with a `boolean`
 * variable), where a single param uses the first. For `json`, may-be-multiple looks single
 * (`JsonValue | JsonValue[]` is just `JsonValue`), so it takes one value.
 */
export type DefaultValues<T, V> = [Exclude<T, undefined>] extends [V[]]
	? [value: V, ...values: V[]]
	: [Exclude<T, undefined>] extends [V]
		? [value: V]
		: [value: V, ...values: V[]];

/** A parsed value: anything but `undefined`, which means "not provided". */
export type Defined = {} | null;

export type Result<T> = { ok: true; value: T } | { ok: false; errors: JinjuError[] };

export type ParamKind = 'arg' | 'flag' | 'switch';

export interface ParamOptions {
	description: string;
	alias?: string;
	hidden?: boolean;
	name?: string;
	choices?: readonly (string | number)[];
	env?: string;
}

/**
 * Reduces switch occurrences (`--x` → true, `--no-x` → false) to a value. Only called when
 * the switch was given at least once; otherwise its default is used.
 */
export type Toggle<V> = (occurrences: readonly [boolean, ...boolean[]]) => V;

export interface ParamInit<V> {
	value: ValueType<V>;
	options: ParamOptions;
	state: ParamState;
	/** The default values, in order. Empty, or left out, when there's no default. */
	defaults?: readonly unknown[];
}

/**
 * Base for every flag, switch and arg: immutable state, parsing and resolution. Subclasses
 * expose the modifiers that apply to them, with their own return types, via the protected
 * `set*` helpers. `T` is the
 * resolved type (e.g. `string[] | undefined`); `V` is what one input parses to.
 */
export abstract class Param<T = unknown, V = unknown> {
	declare readonly [VALUE]: T;
	declare readonly [ELEMENT]: V;
	abstract readonly kind: ParamKind;
	readonly value: ValueType<V>;
	readonly options: ParamOptions;
	readonly state: ParamState;
	/**
	 * The default values, in order, whether or not the param is `multiple`: `.multiple()`
	 * only changes how they're returned. Empty when there's no default.
	 */
	readonly defaults: readonly unknown[];

	constructor({ defaults = [], options, state, value }: ParamInit<V>) {
		this.value = value;
		this.options = options;
		this.state = state;
		this.defaults = Object.freeze([...defaults]);
	}

	/**
	 * The default as `run` receives it: all the values for a `multiple` param, otherwise the
	 * first. `undefined` when there's no default.
	 */
	get defaultValue(): unknown {
		if (!this.state.hasDefault) return undefined;
		// One map for all the values, so a reference shared between them stays shared.
		const seen = new Map<object, unknown>();
		return this.state.multiple
			? this.defaults.map((value) => copy(value, seen))
			: copy(this.defaults[0], seen);
	}

	/** Parses raw input strings into the param's final value, applying modifiers. */
	async resolve(given: readonly string[], label: string): Promise<Result<unknown>> {
		const { hasDefault, multiple, required, separator } = this.state;
		const groups = given.map((input) =>
			separator === undefined
				? [input]
				: input
						.split(separator)
						.map((value) => value.trim())
						.filter((value) => value !== ''),
		);
		// Each occurrence must list a value, even when another one does.
		const empty = given.filter((_, index) => groups[index]!.length === 0);
		if (empty.length > 0) {
			const reason = `must list at least one value, separated by '${separator}'`;
			const errors = empty.map((input) => new InvalidValueError(label, input, reason));
			return { ok: false, errors };
		}
		const inputs = groups.flat();

		if (inputs.length === 0) {
			if (hasDefault) return { ok: true, value: this.defaultValue };
			if (required) return { ok: false, errors: [new MissingRequiredError(label)] };
			return { ok: true, value: undefined };
		}

		if (!multiple && inputs.length > 1) {
			return { ok: false, errors: [new DuplicateFlagError(label)] };
		}

		const errors: JinjuError[] = [];
		const values = await Promise.all(
			inputs.map(async (input) => {
				try {
					return await this.value.parse(input);
				} catch (error) {
					const reason = error instanceof Error ? error.message : String(error);
					errors.push(new InvalidValueError(label, input, reason));
				}
			}),
		);

		if (errors.length > 0) return { ok: false, errors };
		return { ok: true, value: multiple ? values : values[0] };
	}

	/** Must be provided. Clears any default. */
	protected setRequired(required: boolean): this {
		return this.with({ ...this.state, required, hasDefault: false }, []);
	}

	/** Collects values into an array. Defaults need no converting: they're always a list. */
	protected setMultiple(allow: boolean | MultipleOptions): this {
		// Types rule these out, but values from JavaScript aren't checked.
		const isOptions = typeof allow === 'object' && allow !== null && !Array.isArray(allow);
		if (typeof allow !== 'boolean' && !isOptions) {
			throw new ConfigError('.multiple() takes a boolean or { separator }');
		}
		const multiple = allow !== false;
		const separator = typeof allow === 'object' ? allow.separator : undefined;
		if (separator !== undefined && (typeof separator !== 'string' || separator === '')) {
			throw new ConfigError('A separator must be a non-empty string');
		}
		const { separator: _, ...state } = this.state;
		return this.with(
			{ ...state, multiple, ...(separator === undefined ? {} : { separator }) },
			this.defaults,
		);
	}

	/** Uses `values` when absent: all of them for a `multiple` param, else the first. */
	protected setDefault(values: readonly unknown[]): this {
		// Types require one; values from JavaScript aren't checked.
		if (values.length === 0) throw new ConfigError('.default() needs at least one value');
		return this.with({ ...this.state, required: false, hasDefault: true }, values);
	}

	/** A copy (same class) with new state and a frozen copy of `defaults`. */
	private with(state: ParamState, defaults: readonly unknown[]): this {
		const next = Object.create(Object.getPrototypeOf(this)) as this;
		return Object.assign(next, this, { state, defaults: Object.freeze([...defaults]) });
	}
}

/**
 * A copy of a default, so a `run` that changes the value it receives can't change the
 * default for later runs: arrays and plain objects (e.g. JSON) are copied all the way down,
 * with every own property (symbol keys, getters and non-enumerable ones too), and `Date` and
 * `URL` values are copied. Instances of other classes are shared. `seen` maps each object to
 * its copy, so a value that refers to itself, or to one object twice, keeps that shape.
 */
const copy = (value: unknown, seen = new Map<object, unknown>()): unknown => {
	if (typeof value !== 'object' || value === null) return value;
	if (seen.has(value)) return seen.get(value);
	if (value instanceof Date || value instanceof URL) {
		const result = value instanceof Date ? new Date(value) : new URL(value);
		seen.set(value, result);
		return result;
	}
	const prototype: unknown = Object.getPrototypeOf(value);
	const plain = prototype === Object.prototype || prototype === null;
	if (!Array.isArray(value) && !plain) return value;

	// Registered before its contents are copied, so a cycle or a second reference finds it.
	const result: object = Array.isArray(value) ? [] : Object.create(prototype as object | null);
	seen.set(value, result);
	for (const key of Reflect.ownKeys(value)) {
		const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
		if ('value' in descriptor) descriptor.value = copy(descriptor.value, seen);
		Object.defineProperty(result, key, descriptor);
	}
	return result;
};

/** Narrows an unknown value to a param, e.g. when validating user-supplied definitions. */
export const toParam = (param: unknown): Param => {
	if (!(param instanceof Param)) throw new TypeError('Expected a flag or arg');
	return param;
};
