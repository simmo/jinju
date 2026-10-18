import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { describe, expect, test } from 'vitest';

import { parseDirectory, parseEmail, parseFile, parseNumber, parseString, parseUrl } from './value';

describe('string', () => {
	test('passes through', () => {
		expect(parseString('abc', {})).toBe('abc');
	});

	test('restricts to choices', () => {
		expect(parseString('a', { choices: ['a', 'b'] })).toBe('a');
		expect(() => parseString('c', { choices: ['a', 'b'] })).toThrow('must be one of a, b');
	});
});

describe('number', () => {
	test('parses numbers', () => {
		expect(parseNumber('42', {})).toBe(42);
		expect(parseNumber('-1.5', {})).toBe(-1.5);
	});

	test.each(['', ' ', 'abc', 'NaN'])('rejects %j', (input) => {
		expect(() => parseNumber(input, {})).toThrow('must be a number');
	});

	test('applies constraints', () => {
		expect(() => parseNumber('1.5', { integer: true })).toThrow('must be an integer');
		expect(() => parseNumber('0', { min: 1 })).toThrow('at least 1');
		expect(() => parseNumber('11', { max: 10 })).toThrow('at most 10');
		expect(parseNumber('5', { min: 1, max: 10, integer: true })).toBe(5);
	});
});

test('url', () => {
	expect(parseUrl('https://example.com/a', {})).toEqual(new URL('https://example.com/a'));
	expect(() => parseUrl('nope', {})).toThrow('must be a valid URL');
});

test('email', () => {
	expect(parseEmail('me@example.com', {})).toBe('me@example.com');
	expect(() => parseEmail('me@example', {})).toThrow('valid email');
});

describe('paths', async () => {
	const dir = await mkdtemp(join(tmpdir(), 'jinju-'));
	const file = join(dir, 'file.txt');

	await writeFile(file, '');

	test('resolves to absolute', async () => {
		expect(await parseDirectory('some/dir', {})).toBe(resolve('some/dir'));
		expect(await parseFile('a.txt', {})).toBe(resolve('a.txt'));
	});

	test('rejects empty input', async () => {
		await expect(parseDirectory('', {})).rejects.toThrow('valid directory path');
	});

	test('checks existence and kind', async () => {
		expect(await parseDirectory(dir, { exists: true })).toBe(dir);
		expect(await parseFile(file, { exists: true })).toBe(file);

		await expect(parseDirectory(file, { exists: true })).rejects.toThrow('must be a directory');
		await expect(parseFile(dir, { exists: true })).rejects.toThrow('must be a file');
		await expect(parseFile(join(dir, 'missing'), { exists: true })).rejects.toThrow(
			'file does not exist',
		);
	});
});
