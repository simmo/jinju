import { expect, test } from 'vitest';

import { type FlagLookup, type FlagSpec, tokenize } from './tokenize';

const specs: Record<string, FlagSpec> = {
	name: { key: 'name', takesValue: true },
	verbose: { key: 'verbose', takesValue: false },
	all: { key: 'all', takesValue: false },
};
const lookup: FlagLookup = {
	long: (name) => specs[name],
	short: (char) => ({ n: specs.name, v: specs.verbose, a: specs.all })[char],
};
const run = (...argv: string[]) => tokenize(argv, lookup);

test('long flags', () => {
	expect(run('--name=x', '--name', 'y', '--verbose')).toEqual([
		{ type: 'flag', key: 'name', raw: '--name=x', value: 'x', negated: false },
		{ type: 'flag', key: 'name', raw: '--name', value: 'y' },
		{ type: 'flag', key: 'verbose', raw: '--verbose', value: undefined, negated: false },
	]);
});

test('negation only applies to switches', () => {
	expect(run('--no-verbose')).toEqual([
		{ type: 'flag', key: 'verbose', raw: '--no-verbose', value: undefined, negated: true },
	]);
	expect(run('--no-name')).toEqual([{ type: 'unknown', raw: '--no-name' }]);
});

test('short flags and bundles', () => {
	expect(run('-va', '-n5', '-n=6', '-n', '7', '-vn', '8')).toEqual([
		{ type: 'flag', key: 'verbose', raw: '-v' },
		{ type: 'flag', key: 'all', raw: '-a' },
		{ type: 'flag', key: 'name', raw: '-n', value: '5' },
		{ type: 'flag', key: 'name', raw: '-n', value: '6' },
		{ type: 'flag', key: 'name', raw: '-n', value: '7' },
		{ type: 'flag', key: 'verbose', raw: '-v' },
		{ type: 'flag', key: 'name', raw: '-n', value: '8' },
	]);
});

test('missing values do not swallow other flags', () => {
	expect(run('--name', '--verbose')).toEqual([
		{ type: 'flag', key: 'name', raw: '--name', missing: true },
		{ type: 'flag', key: 'verbose', raw: '--verbose', value: undefined, negated: false },
	]);
	expect(run('-n')).toEqual([{ type: 'flag', key: 'name', raw: '-n', missing: true }]);
});

test('negative numbers and dash are values', () => {
	expect(run('--name', '-5', '-3', '-')).toEqual([
		{ type: 'flag', key: 'name', raw: '--name', value: '-5' },
		{ type: 'arg', value: '-3' },
		{ type: 'arg', value: '-' },
	]);
});

test('-- ends flag parsing', () => {
	expect(run('a', '--', '--name', '-v')).toEqual([
		{ type: 'arg', value: 'a' },
		{ type: 'arg', value: '--name' },
		{ type: 'arg', value: '-v' },
	]);
});

test('unknown flags', () => {
	expect(run('--nope', '-xv')).toEqual([
		{ type: 'unknown', raw: '--nope' },
		{ type: 'unknown', raw: '-x' },
		{ type: 'flag', key: 'verbose', raw: '-v' },
	]);
});
