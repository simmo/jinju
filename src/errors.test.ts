import { describe, expect, test } from 'vitest';

import {
	ConfigError,
	DuplicateFlagError,
	InvalidValueError,
	JinjuError,
	MissingRequiredError,
	MissingValueError,
	UnexpectedArgError,
	UnknownCommandError,
	UnknownFlagError,
} from './errors';

describe.each([
	[new ConfigError('Bad config'), 'ConfigError', 'Bad config', {}],
	[
		new UnknownCommandError('nope'),
		'UnknownCommandError',
		"Unknown command 'nope'",
		{ command: 'nope' },
	],
	[new UnknownFlagError('--x'), 'UnknownFlagError', "Unknown flag '--x'", { flag: '--x' }],
	[new UnexpectedArgError('a'), 'UnexpectedArgError', "Unexpected argument 'a'", { arg: 'a' }],
	[
		new MissingRequiredError('--x'),
		'MissingRequiredError',
		'Missing required --x',
		{ label: '--x' },
	],
	[new MissingValueError('--x'), 'MissingValueError', '--x requires a value', { label: '--x' }],
	[
		new DuplicateFlagError('--x'),
		'DuplicateFlagError',
		'--x can only be provided once',
		{ label: '--x' },
	],
	[
		new InvalidValueError('--n', 'a', 'must be a number'),
		'InvalidValueError',
		"Invalid value 'a' for --n: must be a number",
		{ label: '--n', input: 'a', reason: 'must be a number' },
	],
])('%o', (error, name, message, fields) => {
	test('is a JinjuError and an Error', () => {
		expect(error).toBeInstanceOf(JinjuError);
		expect(error).toBeInstanceOf(Error);
	});

	test('has a name, message and details', () => {
		expect(error.name).toBe(name);
		expect(error.message).toBe(message);
		expect(error).toMatchObject(fields);
	});
});

test('JinjuError can be thrown directly', () => {
	const error = new JinjuError('custom');
	expect(error.name).toBe('JinjuError');
	expect(() => {
		throw error;
	}).toThrow('custom');
});
