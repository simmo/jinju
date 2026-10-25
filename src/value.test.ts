import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { describe, expect, test } from 'vitest';

import {
	parseBoolean,
	parseCount,
	parseDate,
	parseDirectory,
	parseEmail,
	parseFile,
	parseJson,
	parseEntry,
	parseNumber,
	parseString,
	parseUrl,
	toBoolean,
} from './value';

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

describe('number choices', () => {
	test('restricts to choices, after the other checks', () => {
		expect(parseNumber('2', { choices: [1, 2, 4] })).toBe(2);
		expect(parseNumber('2.0', { choices: [1, 2, 4] })).toBe(2);
		expect(() => parseNumber('3', { choices: [1, 2, 4] })).toThrow('must be one of 1, 2, 4');
		expect(() => parseNumber('x', { choices: [1] })).toThrow('must be a number');
	});
});

describe('date', () => {
	test.each([
		['2026-10-25', '2026-10-25T00:00:00.000Z'],
		['2024-02-29', '2024-02-29T00:00:00.000Z'],
		['0000-02-29', '0000-02-29T00:00:00.000Z'],
		['0096-02-29', '0096-02-29T00:00:00.000Z'],
		['2026-10-25T14:30Z', '2026-10-25T14:30:00.000Z'],
		['2026-10-25T14:30:15.5Z', '2026-10-25T14:30:15.500Z'],
		['2026-10-25T14:30+01:00', '2026-10-25T13:30:00.000Z'],
	])('parses %j', (input, iso) => {
		expect(parseDate(input, {})).toEqual(new Date(iso));
	});

	test('reads a time without an offset as local time', () => {
		expect(parseDate('2026-10-25T14:30', {})).toEqual(new Date(2026, 9, 25, 14, 30));
	});

	test.each([
		'',
		'today',
		'25/10/2026',
		'2026-10-25 14:30',
		'2026-13-01',
		'2026-02-30',
		'2025-02-29',
		'0099-02-29',
		'2026-10-25T25:00',
	])('rejects %j', (input) => {
		expect(() => parseDate(input, {})).toThrow('must be an ISO 8601 date');
	});
});

describe('json', () => {
	test.each([
		['{"a":[1,true,null]}', { a: [1, true, null] }],
		['"text"', 'text'],
		['3', 3],
		['null', null],
	])('parses %j', (input, value) => {
		expect(parseJson(input, {})).toEqual(value);
	});

	test.each(['', '{a:1}', "'text'", 'text'])('rejects %j', (input) => {
		expect(() => parseJson(input, {})).toThrow('must be valid JSON');
	});
});

describe('entry', () => {
	test('splits at the first =', () => {
		expect(parseEntry('mode=fast', {})).toEqual(['mode', 'fast']);
		expect(parseEntry('query=a=b', {})).toEqual(['query', 'a=b']);
		expect(parseEntry('empty=', {})).toEqual(['empty', '']);
	});

	test.each(['', 'mode', '=fast'])('rejects %j', (input) => {
		expect(() => parseEntry(input, {})).toThrow('must be key=value');
	});
});

describe('boolean', () => {
	test.each(['true', '1', 'yes', 'on', ' TRUE ', 'Yes'])('%j is true', (input) => {
		expect(parseBoolean(input, {})).toBe(true);
	});

	test.each(['false', '0', 'no', 'off', 'OFF'])('%j is false', (input) => {
		expect(parseBoolean(input, {})).toBe(false);
	});

	test.each(['', 'maybe', '2'])('rejects %j', (input) => {
		expect(() => parseBoolean(input, {})).toThrow('must be true or false');
	});
});

test('toBoolean', () => {
	expect(['true', '1', 'YES', ' on '].map(toBoolean)).toEqual([true, true, true, true]);
	expect(['false', '0', 'No', 'OFF'].map(toBoolean)).toEqual([false, false, false, false]);
	expect(['', 'maybe', '2'].map(toBoolean)).toEqual([undefined, undefined, undefined]);
});

describe('count', () => {
	test('parses whole numbers', () => {
		expect(parseCount('0', {})).toBe(0);
		expect(parseCount(' 3 ', {})).toBe(3);
	});

	test.each(['', '-1', '1.5', 'two'])('rejects %j', (input) => {
		expect(() => parseCount(input, {})).toThrow('must be a whole number');
	});
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
		await expect(parseFile('', {})).rejects.toThrow('valid file path');
	});

	test('rejects paths containing a NUL byte', async () => {
		await expect(parseDirectory('some\0dir', {})).rejects.toThrow('must be a valid directory path');
		await expect(parseFile('a\0.txt', {})).rejects.toThrow('must be a valid file path');
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
