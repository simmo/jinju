import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { describe, expect, test } from 'vitest';

import { parsers } from './value';

describe('string', () => {
	test('passes through', () => {
		expect(parsers.string('abc', {})).toBe('abc');
	});

	test('restricts to choices', () => {
		expect(parsers.string('a', { choices: ['a', 'b'] })).toBe('a');
		expect(() => parsers.string('c', { choices: ['a', 'b'] })).toThrow('must be one of a, b');
	});
});

describe('number', () => {
	test('parses numbers', () => {
		expect(parsers.number('42', {})).toBe(42);
		expect(parsers.number('-1.5', {})).toBe(-1.5);
	});

	test.each(['', ' ', 'abc', 'NaN'])('rejects %j', (input) => {
		expect(() => parsers.number(input, {})).toThrow('must be a number');
	});

	test('applies constraints', () => {
		expect(() => parsers.number('1.5', { integer: true })).toThrow('must be an integer');
		expect(() => parsers.number('0', { min: 1 })).toThrow('at least 1');
		expect(() => parsers.number('11', { max: 10 })).toThrow('at most 10');
		expect(parsers.number('5', { min: 1, max: 10, integer: true })).toBe(5);
	});
});

test('url', () => {
	expect(parsers.url('https://example.com/a', {})).toEqual(new URL('https://example.com/a'));
	expect(() => parsers.url('nope', {})).toThrow('must be a valid URL');
});

test('email', () => {
	expect(parsers.email('me@example.com', {})).toBe('me@example.com');
	expect(() => parsers.email('me@example', {})).toThrow('valid email');
});

describe('paths', async () => {
	const dir = await mkdtemp(join(tmpdir(), 'jinju-'));
	const file = join(dir, 'file.txt');
	await writeFile(file, '');

	test('resolves to absolute', async () => {
		expect(await parsers.directory('some/dir', {})).toBe(resolve('some/dir'));
		expect(await parsers.file('a.txt', {})).toBe(resolve('a.txt'));
	});

	test('rejects empty input', async () => {
		await expect(parsers.directory('', {})).rejects.toThrow('valid directory path');
	});

	test('checks existence and kind', async () => {
		expect(await parsers.directory(dir, { exists: true })).toBe(dir);
		expect(await parsers.file(file, { exists: true })).toBe(file);
		await expect(parsers.directory(file, { exists: true })).rejects.toThrow('must be a directory');
		await expect(parsers.file(dir, { exists: true })).rejects.toThrow('must be a file');
		await expect(parsers.file(join(dir, 'missing'), { exists: true })).rejects.toThrow(
			'file does not exist',
		);
	});
});
