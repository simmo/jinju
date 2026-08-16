type ParseMethod<
	TOutput,
	TMultiple extends boolean,
	TOptional extends boolean,
> = TMultiple extends true
	? (
			first?: string | undefined,
			...rest: string[]
		) => TOptional extends true ? TOutput[] | undefined : TOutput[]
	: (value?: string | undefined) => TOptional extends true ? TOutput | undefined : TOutput;

type DefaultValue<TOutput, TMultiple extends boolean> = TMultiple extends true
	? TOutput[]
	: TOutput;

interface FlagState<TOutput> {
	parseSingle: (value: string) => TOutput;
	allowMultiple: boolean;
	required: boolean;
	defaultValue: unknown;
	alias?: string;
	description?: string;
}

export class Flag<TOutput, TMultiple extends boolean, TOptional extends boolean> {
	readonly #state: FlagState<TOutput>;

	// conditional return type can't be expressed on a method, so parse is a typed arrow-function field
	readonly parse: ParseMethod<TOutput, TMultiple, TOptional> = (
		first?: string | undefined,
		...rest: string[]
	): any => {
		if (first === undefined) {
			if (this.#state.required) throw new Error('Value is required');
			return this.#state.defaultValue;
		}
		if (this.#state.allowMultiple) {
			return [first, ...rest].map((v) => this.#state.parseSingle(v));
		}
		return this.#state.parseSingle(first);
	};

	constructor(state: FlagState<TOutput>) {
		this.#state = state;
	}

	default<T extends DefaultValue<TOutput, TMultiple> | undefined>(
		value: T,
	): Flag<TOutput, TMultiple, T extends undefined ? true : false> {
		return new Flag({ ...this.#state, required: false, defaultValue: value }) as any;
	}

	required(): Flag<TOutput, TMultiple, false> {
		return new Flag({ ...this.#state, required: true, defaultValue: undefined });
	}

	get allowMultiple(): boolean {
		return this.#state.allowMultiple;
	}

	get alias(): string | undefined {
		return this.#state.alias;
	}
}
