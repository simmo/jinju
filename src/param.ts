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
}

/** Reduces switch occurrences (`--x` → true, `--no-x` → false) to a value. */
export type Toggle<V> = (occurrences: readonly boolean[]) => V;

/**
 * Runtime implementation behind the public `Flag`, `Switch` and `Arg` interfaces. Immutable:
 * every modifier returns a new instance.
 */
export class Param<V = unknown> {
	constructor(
		readonly kind: ParamKind,
		readonly value: ValueType<V>,
		readonly options: ParamOptions,
		readonly state: ParamState,
		readonly defaultValue?: unknown,
		readonly toggle?: Toggle<V>,
	) {}

	required(required = true): Param<V> {
		return this.#with({ ...this.state, required, hasDefault: false }, undefined);
	}

	multiple(allow = true): Param<V> {
		const { hasDefault } = this.state;
		let defaultValue = this.defaultValue;
		if (hasDefault && allow !== this.state.multiple) {
			defaultValue = allow ? [defaultValue] : (defaultValue as unknown[])[0];
		}
		return this.#with({ ...this.state, multiple: allow }, defaultValue);
	}

	default(value: unknown): Param<V> {
		const frozen = Array.isArray(value) ? Object.freeze([...value]) : value;
		return this.#with({ ...this.state, required: false, hasDefault: true }, frozen);
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

	/** Resolves a switch (boolean/count flag) from its occurrences. */
	resolveSwitch(occurrences: readonly boolean[]): unknown {
		if (occurrences.length === 0 && this.state.hasDefault) return this.defaultValue;
		return this.toggle!(occurrences);
	}

	#with(state: ParamState, defaultValue: unknown): Param<V> {
		return new Param(this.kind, this.value, this.options, state, defaultValue, this.toggle);
	}
}

/** Narrows a public param interface to its runtime implementation. */
export const toParam = (param: unknown): Param => {
	if (!(param instanceof Param)) throw new TypeError('Expected a flag or arg');
	return param;
};
