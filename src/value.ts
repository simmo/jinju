import { stat } from 'node:fs/promises';
import { resolve } from 'node:path';

/**
 * Converts a raw command-line string into a typed value. Throw (any `Error`) to reject the
 * input; the message is shown to the user.
 */
export type Parse<V, O = {}> = (input: string, options: O) => V | Promise<V>;

/** A parser bound to its options, plus a display name used in help (`--port <number>`). */
export interface ValueType<V = unknown> {
	readonly name: string;
	readonly parse: (input: string) => V | Promise<V>;
}

export interface StringOptions<C extends string = string> {
	/** Restrict input to these values. The parsed type is the union of them. */
	choices?: readonly C[];
}

export interface NumberOptions<C extends number = number> {
	/** Restrict input to these values. The parsed type is the union of them. */
	choices?: readonly C[];
	min?: number;
	max?: number;
	/** Reject non-integer input. */
	integer?: boolean;
}

export interface PathOptions {
	/** Check the path exists (and is the right kind of entry). */
	exists?: boolean;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const parseString: Parse<string, StringOptions> = (input, { choices }) => {
	if (choices && !choices.includes(input)) {
		throw new Error(`must be one of ${choices.join(', ')}`);
	}

	return input;
};

export const parseNumber: Parse<number, NumberOptions> = (
	input,
	{ choices, integer, max, min },
) => {
	const value = input.trim() === '' ? Number.NaN : Number(input);

	if (Number.isNaN(value)) throw new Error('must be a number');
	if (integer && !Number.isInteger(value)) throw new Error('must be an integer');
	if (min !== undefined && value < min) throw new Error(`must be at least ${min}`);
	if (max !== undefined && value > max) throw new Error(`must be at most ${max}`);
	if (choices && !choices.includes(value)) {
		throw new Error(`must be one of ${choices.join(', ')}`);
	}

	return value;
};

/** `2026-10-25`, `2026-10-25T14:30`, `2026-10-25T14:30:00.000Z`, `2026-10-25T14:30+01:00`. */
const DATE =
	/^(\d{4})-(\d{2})-(\d{2})(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})?)?$/;

/**
 * An ISO 8601 date, or date and time. As with `new Date()`, a date alone is midnight UTC and
 * a time without an offset is local time.
 */
export const parseDate: Parse<Date> = (input) => {
	const match = DATE.exec(input);
	const date = new Date(input);
	// `new Date()` rolls days over (`2026-02-30` → 2 March), so check the day exists.
	const [year, month, day] = (match ?? []).slice(1).map(Number) as [number, number, number];
	const calendar = new Date(Date.UTC(year, month - 1, day));

	if (!match || Number.isNaN(date.getTime()) || calendar.getUTCDate() !== day) {
		throw new Error('must be an ISO 8601 date, e.g. 2026-10-25 or 2026-10-25T14:30');
	}

	return date;
};

/** Any value JSON can represent. */
export type JsonValue =
	| string
	| number
	| boolean
	| null
	| JsonValue[]
	| { [key: string]: JsonValue };

export const parseJson: Parse<JsonValue> = (input) => {
	try {
		return JSON.parse(input) as JsonValue;
	} catch {
		throw new Error('must be valid JSON');
	}
};

/** `key=value` → `['key', 'value']`, split at the first `=`. The value may be empty. */
export const parseEntry: Parse<[key: string, value: string]> = (input) => {
	const at = input.indexOf('=');
	if (at < 1) throw new Error('must be key=value');

	return [input.slice(0, at), input.slice(at + 1)];
};

export const parseUrl: Parse<URL> = (input) => {
	if (!URL.canParse(input)) throw new Error('must be a valid URL');

	return new URL(input);
};

export const parseEmail: Parse<string> = (input) => {
	if (!EMAIL.test(input)) throw new Error('must be a valid email address');

	return input;
};

const createPathParser =
	(kind: 'directory' | 'file'): Parse<string, PathOptions> =>
	async (input, { exists }) => {
		if (input === '' || input.includes('\0')) throw new Error(`must be a valid ${kind} path`);

		const path = resolve(input);

		if (exists) {
			const stats = await stat(path).catch(() => undefined);

			if (!stats) throw new Error(`${kind} does not exist`);
			if (kind === 'directory' ? !stats.isDirectory() : !stats.isFile()) {
				throw new Error(`must be a ${kind}`);
			}
		}

		return path;
	};

export const parseDirectory = createPathParser('directory');

export const parseFile = createPathParser('file');

const TRUE = new Set(['true', '1', 'yes', 'on']);
const FALSE = new Set(['false', '0', 'no', 'off']);

/** `true`/`1`/`yes`/`on` → `true`, `false`/`0`/`no`/`off` → `false` (any case), else `undefined`. */
export const toBoolean = (input: string): boolean | undefined => {
	const value = input.trim().toLowerCase();
	return TRUE.has(value) ? true : FALSE.has(value) ? false : undefined;
};

/** Parses a boolean switch's value from text, e.g. an environment variable. */
export const parseBoolean: Parse<boolean> = (input) => {
	const value = toBoolean(input);
	if (value === undefined) throw new Error('must be true or false');
	return value;
};

/** Parses a count switch's value from text, e.g. `VERBOSE=2`. */
export const parseCount: Parse<number> = (input) => {
	if (!/^\d+$/.test(input.trim())) throw new Error('must be a whole number');
	return Number(input);
};
