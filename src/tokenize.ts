export interface FlagSpec {
	key: string;
	/** `false` for switches (boolean/count), which never consume the next argument. */
	takesValue: boolean;
}

export interface FlagLookup {
	long(name: string): FlagSpec | undefined;
	short(char: string): FlagSpec | undefined;
}

export type Token =
	| { type: 'flag'; key: string; raw: string; value?: string; negated?: boolean; missing?: boolean }
	| { type: 'unknown'; raw: string }
	| { type: 'arg'; value: string };

const isNegativeNumber = (arg: string) => /^-\d/.test(arg);

/** Whether `arg` can be consumed as the value of a preceding flag (`--name value`). */
const isValue = (arg: string | undefined): arg is string =>
	arg !== undefined && (!arg.startsWith('-') || arg === '-' || isNegativeNumber(arg));

/**
 * Reads the flag at `argv[index]`, returning its tokens and how many argv entries it used
 * (2 when the value is the following entry).
 */
export const readFlag = (
	argv: readonly string[],
	index: number,
	lookup: FlagLookup,
): { tokens: Token[]; size: 1 | 2 } => {
	const raw = argv[index]!;
	const next = argv[index + 1];

	if (raw.startsWith('--')) {
		const eq = raw.indexOf('=');
		const name = eq === -1 ? raw.slice(2) : raw.slice(2, eq);
		const inline = eq === -1 ? undefined : raw.slice(eq + 1);
		let spec = lookup.long(name);
		let negated = false;

		if (!spec && name.startsWith('no-')) {
			const positive = lookup.long(name.slice(3));
			if (positive && !positive.takesValue) {
				spec = positive;
				negated = true;
			}
		}

		if (!spec) return { tokens: [{ type: 'unknown', raw }], size: 1 };

		const { key, takesValue } = spec;
		if (!takesValue || inline !== undefined) {
			return { tokens: [{ type: 'flag', key, raw, value: inline, negated }], size: 1 };
		}
		if (isValue(next)) return { tokens: [{ type: 'flag', key, raw, value: next }], size: 2 };
		return { tokens: [{ type: 'flag', key, raw, missing: true }], size: 1 };
	}

	// Short flags, possibly bundled: `-abc`, `-n5`, `-n=5`, `-n 5`.
	const tokens: Token[] = [];
	for (let i = 1; i < raw.length; i++) {
		const char = raw[i]!;
		const spec = lookup.short(char);
		const flagRaw = `-${char}`;

		if (!spec) {
			tokens.push({ type: 'unknown', raw: flagRaw });
			continue;
		}
		if (!spec.takesValue) {
			tokens.push({ type: 'flag', key: spec.key, raw: flagRaw });
			continue;
		}

		const rest = raw.slice(i + 1).replace(/^=/, '');
		if (rest !== '') {
			tokens.push({ type: 'flag', key: spec.key, raw: flagRaw, value: rest });
			return { tokens, size: 1 };
		}
		if (isValue(next)) {
			tokens.push({ type: 'flag', key: spec.key, raw: flagRaw, value: next });
			return { tokens, size: 2 };
		}
		tokens.push({ type: 'flag', key: spec.key, raw: flagRaw, missing: true });
		return { tokens, size: 1 };
	}
	return { tokens, size: 1 };
};

/** Whether `arg` should be read as a flag rather than a positional value. */
export const isFlag = (arg: string, lookup: FlagLookup): boolean =>
	arg.startsWith('-') && arg !== '-' && !(isNegativeNumber(arg) && !lookup.short(arg[1]!));

/** Splits argv into flag and positional tokens using the given flag definitions. */
export const tokenize = (argv: readonly string[], lookup: FlagLookup): Token[] => {
	const tokens: Token[] = [];
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i]!;
		if (arg === '--') {
			for (const value of argv.slice(i + 1)) tokens.push({ type: 'arg', value });
			break;
		}
		if (!isFlag(arg, lookup)) {
			tokens.push({ type: 'arg', value: arg });
			continue;
		}
		const { size, tokens: flagTokens } = readFlag(argv, i, lookup);
		tokens.push(...flagTokens);
		i += size - 1;
	}
	return tokens;
};
