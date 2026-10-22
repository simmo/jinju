import {
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
}

/**
 * Whether resolved type `T` collects `V` values into an array. Parsers can't return
 * `undefined`, so this is unambiguous even when `V` is itself an array.
 */
export type IsMultiple<T, V> = [Exclude<T, undefined>] extends [V[]] ? true : false;

/** Defaults for `multiple` params must be non-empty, so `.multiple(false)` can take the first. */
export type DefaultValue<T, V> = IsMultiple<T, V> extends true ? readonly [V, ...V[]] : V;

/** A parsed value: anything but `undefined`, which means "not provided". */
export type Defined = {} | null;

export type Result<T> = { ok: true; value: T } | { ok: false; errors: JinjuError[] };

export type ParamKind = 'arg' | 'flag' | 'switch';

export interface ParamOptions {
	description: string;
	alias?: string;
	hidden?: boolean;
	name?: string;
	choices?: readonly string[];
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
	defaultValue?: unknown;
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
	readonly defaultValue: unknown;

	constructor({ defaultValue, options, state, value }: ParamInit<V>) {
		this.value = value;
		this.options = options;
		this.state = state;
		this.defaultValue = defaultValue;
	}

	/** Parses raw input strings into the param's final value, applying modifiers. */
	async resolve(inputs: readonly string[], label: string): Promise<Result<unknown>> {
		const { hasDefault, multiple, required } = this.state;

		if (inputs.length === 0) {
			if (hasDefault) {
				const value = this.defaultValue;
				return { ok: true, value: Array.isArray(value) ? [...value] : value };
			}
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
		return this.with({ ...this.state, required, hasDefault: false }, undefined);
	}

	/** Collects values into an array, converting an existing default between `v` and `[v]`. */
	protected setMultiple(allow: boolean): this {
		let defaultValue = this.defaultValue;
		if (this.state.hasDefault && allow !== this.state.multiple) {
			defaultValue = allow ? [defaultValue] : (defaultValue as unknown[])[0];
		}
		return this.with({ ...this.state, multiple: allow }, defaultValue);
	}

	/** Uses `value` when absent. Clears `required`. */
	protected setDefault(value: unknown): this {
		return this.with({ ...this.state, required: false, hasDefault: true }, value);
	}

	/** A copy (same class) with new state. Array defaults are frozen copies. */
	private with(state: ParamState, defaultValue: unknown): this {
		const frozen = Array.isArray(defaultValue) ? Object.freeze([...defaultValue]) : defaultValue;
		const copy = Object.create(Object.getPrototypeOf(this)) as this;
		return Object.assign(copy, this, { state, defaultValue: frozen });
	}
}

/** Narrows an unknown value to a param, e.g. when validating user-supplied definitions. */
export const toParam = (param: unknown): Param => {
	if (!(param instanceof Param)) throw new TypeError('Expected a flag or arg');
	return param;
};
