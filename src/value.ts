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

export interface NumberOptions {
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

const parseString: Parse<string, StringOptions> = (input, { choices }) => {
	if (choices && !choices.includes(input)) {
		throw new Error(`must be one of ${choices.join(', ')}`);
	}
	return input;
};

const parseNumber: Parse<number, NumberOptions> = (input, { integer, max, min }) => {
	const value = input.trim() === '' ? Number.NaN : Number(input);
	if (Number.isNaN(value)) throw new Error('must be a number');
	if (integer && !Number.isInteger(value)) throw new Error('must be an integer');
	if (min !== undefined && value < min) throw new Error(`must be at least ${min}`);
	if (max !== undefined && value > max) throw new Error(`must be at most ${max}`);
	return value;
};

const parseUrl: Parse<URL> = (input) => {
	if (!URL.canParse(input)) throw new Error('must be a valid URL');
	return new URL(input);
};

const parseEmail: Parse<string> = (input) => {
	if (!EMAIL.test(input)) throw new Error('must be a valid email address');
	return input;
};

const pathParser =
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

/** Built-in parsers shared by `flag.*` and `arg.*` creators. */
export const parsers = {
	directory: pathParser('directory'),
	email: parseEmail,
	file: pathParser('file'),
	number: parseNumber,
	string: parseString,
	url: parseUrl,
};
