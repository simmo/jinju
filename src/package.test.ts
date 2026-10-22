import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

import { describe, expect, test } from 'vitest';

import { ConfigError } from './errors';
import { packageVersion } from './package';

describe('packageVersion', async () => {
	const root = await mkdtemp(join(tmpdir(), 'jinju-pkg-'));
	const nested = join(root, 'dist', 'bin');
	await mkdir(nested, { recursive: true });
	await writeFile(join(root, 'package.json'), JSON.stringify({ name: 'cli', version: '1.2.3' }));
	const script = join(nested, 'cli.js');
	await writeFile(script, '');

	test('finds the nearest package.json from a file URL, file path or directory', () => {
		expect(packageVersion(pathToFileURL(script))).toBe('1.2.3');
		expect(packageVersion(pathToFileURL(script).href)).toBe('1.2.3');
		expect(packageVersion(script)).toBe('1.2.3');
		expect(packageVersion(nested)).toBe('1.2.3');
	});

	test('uses the closest package.json', async () => {
		await writeFile(join(nested, 'package.json'), JSON.stringify({ version: '9.9.9' }));
		expect(packageVersion(script)).toBe('9.9.9');
	});

	test('a package.json without a version is an error', async () => {
		const bare = await mkdtemp(join(tmpdir(), 'jinju-pkg-'));
		await writeFile(join(bare, 'package.json'), '{}');
		expect(() => packageVersion(join(bare, 'cli.js'))).toThrow(ConfigError);
		expect(() => packageVersion(join(bare, 'cli.js'))).toThrow('No version in');
	});

	test('no package.json up to the root is an error', () => {
		expect(() => packageVersion('/')).toThrow('No package.json found above /');
	});

	test('relative paths are resolved against the working directory', async () => {
		expect(packageVersion('package.json')).toBe(packageVersion(import.meta.url));
		const bare = await mkdtemp(join(tmpdir(), 'jinju-pkg-'));
		const outside = relative(process.cwd(), join(bare, 'cli.js'));
		expect(outside.startsWith('..')).toBe(true);
		expect(() => packageVersion(outside)).toThrow('No package.json found above');
		expect(() => packageVersion('.')).not.toThrow();
	});

	test('this package', () => {
		expect(packageVersion(import.meta.url)).toMatch(/^\d+\.\d+\.\d+/);
	});
});
