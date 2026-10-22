import { describe, expect, expectTypeOf, test } from 'vitest';

import { arg } from './arg';
import { allocate, command, scope, switchState } from './command';
import { ConfigError } from './errors';
import { flag } from './flag';
import { toParam } from './param';

const d = { description: 'd' };
const noop = () => {};
const params = (...args: unknown[]) => args.map(toParam);
const opt = arg.string(d);
const req = arg.string(d).required();
const many = arg.string(d).multiple();

describe('allocate', () => {
	test('fills optional args left to right', () => {
		expect(allocate(params(opt, opt), ['a']).inputs).toEqual([['a'], []]);
		expect(allocate(params(opt, opt), ['a', 'b', 'c'])).toEqual({
			inputs: [['a'], ['b']],
			extra: ['c'],
		});
	});

	test('serves required args before optional ones', () => {
		expect(allocate(params(opt, req), ['a']).inputs).toEqual([[], ['a']]);
		expect(allocate(params(opt, req), ['a', 'b']).inputs).toEqual([['a'], ['b']]);
	});

	test('multiple arg takes the middle', () => {
		const cp = params(many.required(), req);
		expect(allocate(cp, ['a', 'b', 'c']).inputs).toEqual([['a', 'b'], ['c']]);
		const middle = params(req, many, req);
		expect(allocate(middle, ['a', 'b', 'c', 'd']).inputs).toEqual([['a'], ['b', 'c'], ['d']]);
		expect(allocate(middle, ['a', 'b']).inputs).toEqual([['a'], [], ['b']]);
	});

	test('a required multiple arg reserves a value', () => {
		const list = params(many.required(), opt);
		expect(allocate(list, ['a']).inputs).toEqual([['a'], []]);
		expect(allocate(list, ['a', 'b']).inputs).toEqual([['a'], ['b']]);
	});

	test('too few values leaves trailing required args empty', () => {
		expect(allocate(params(req, req), ['a']).inputs).toEqual([['a'], []]);
	});
});

describe('parse', () => {
	const sync = command({
		description: 'Sync',
		args: [arg.string({ description: 'Source', name: 'src' }).required(), arg.number(d)],
		flags: {
			dryRun: flag.boolean({ alias: 'd', description: 'Dry run' }),
			tag: flag.string({ alias: 't', description: 'Tag' }).multiple(),
			verbose: flag.count({ alias: 'v', description: 'Verbose' }),
		},
		run: noop,
	});

	test('parses flags and args', async () => {
		const result = await sync.parse(['a', '--dry-run', '-t', 'x', '--tag=y', '-vv', '2']);
		expect(result).toEqual({
			ok: true,
			value: {
				args: ['a', 2],
				argv: ['a', '--dry-run', '-t', 'x', '--tag=y', '-vv', '2'],
				flags: { dryRun: true, tag: ['x', 'y'], verbose: 2 },
			},
		});
	});

	test('switch inline values', async () => {
		const off = await sync.parse(['a', '--dry-run=false']);
		expect(off.ok && off.value.flags.dryRun).toBe(false);
		const on = await sync.parse(['a', '--dry-run=true']);
		expect(on.ok && on.value.flags.dryRun).toBe(true);
		for (const value of ['yes', '1', 'on', 'TRUE']) {
			const result = await sync.parse(['a', `--dry-run=${value}`]);
			expect(result.ok && result.value.flags.dryRun).toBe(true);
		}
		for (const value of ['no', '0', 'off']) {
			const result = await sync.parse(['a', `--dry-run=${value}`]);
			expect(result.ok && result.value.flags.dryRun).toBe(false);
		}
		const negated = await sync.parse(['a', '--no-dry-run=true']);
		expect(negated.ok && negated.value.flags.dryRun).toBe(false);
		const invalid = await sync.parse(['a', '--dry-run=maybe']);
		expect(invalid.ok || invalid.errors[0]!.message).toBe(
			"Invalid value 'maybe' for --dry-run: must be true or false",
		);
	});

	test('collects all errors', async () => {
		const result = await sync.parse(['x', 'nope', 'extra', '--what', '--tag']);
		expect(result.ok || result.errors.map((error) => error.message).sort()).toEqual([
			'--tag requires a value',
			"Invalid value 'nope' for argument <number>: must be a number",
			"Unexpected argument 'extra'",
			"Unknown flag '--what'",
		]);
	});

	test('missing required arg', async () => {
		const result = await sync.parse([]);
		expect(result.ok || result.errors[0]!.message).toBe('Missing required argument <src>');
	});

	test('leading values come before parsed positionals', async () => {
		const result = await sync.parse(['3'], { leading: ['captured'] });
		expect(result.ok && result.value.args).toEqual(['captured', 3]);
		expect(result.ok && result.value.argv).toEqual(['3']);
	});

	test('non-strict ignores unknown flags', async () => {
		const result = await sync.parse(['a', '--what'], { strict: false });
		expect(result.ok).toBe(true);
	});

	test('globals are parsed but only declared flags are returned', async () => {
		const result = await sync.parse(['a', '--quiet'], { globals: { quiet: flag.boolean(d) } });
		expect(result.ok && result.value.flags).toEqual({ dryRun: false, tag: undefined, verbose: 0 });
	});
});

test('switchState', () => {
	expect(switchState({})).toBe(true);
	expect(switchState({ negated: true })).toBe(false);
	expect(switchState({ value: 'yes' })).toBe(true);
	expect(switchState({ value: 'off' })).toBe(false);
	expect(switchState({ value: 'true', negated: true })).toBe(false);
	expect(switchState({ value: 'false', negated: true })).toBe(true);
	expect(switchState({ value: 'maybe' })).toBeUndefined();
});

describe('env', () => {
	const deploy = command({
		description: 'Deploy',
		flags: {
			token: flag.string({ description: 'Token', env: 'API_TOKEN' }).required(),
			port: flag.number({ description: 'Port', env: 'PORT' }).default(80),
			tags: flag.string({ description: 'Tags', env: 'TAGS' }).multiple(),
			debug: flag.boolean({ description: 'Debug', env: 'DEBUG' }),
			verbose: flag.count({ alias: 'v', description: 'Verbose', env: 'VERBOSE' }),
		},
		run: noop,
	});
	const parse = (argv: string[], env: Record<string, string | undefined>) =>
		deploy.parse(argv, { env });

	test('is used when a flag is not given', async () => {
		const result = await parse([], {
			API_TOKEN: 'abc',
			PORT: '8080',
			TAGS: 'a',
			DEBUG: 'yes',
			VERBOSE: '2',
		});
		expect(result.ok && result.value.flags).toEqual({
			token: 'abc',
			port: 8080,
			tags: ['a'],
			debug: true,
			verbose: 2,
		});
	});

	test('argv takes priority, and the default applies when unset', async () => {
		const result = await parse(['--token', 'cli', '--debug=false', '-v'], {
			API_TOKEN: 'env',
			DEBUG: '1',
			VERBOSE: '5',
		});
		expect(result.ok && result.value.flags).toMatchObject({
			token: 'cli',
			port: 80,
			debug: false,
			verbose: 1,
		});
	});

	test('empty values count as unset', async () => {
		const result = await parse([], { API_TOKEN: '', PORT: '' });
		expect(result.ok || result.errors.map((error) => error.message)).toEqual([
			'Missing required --token',
		]);
	});

	test('a flag given on the command line never falls back to env, even if invalid', async () => {
		const missing = await parse(['--token', 't', '--port'], { PORT: 'abc' });
		expect(missing.ok || missing.errors.map((error) => error.message)).toEqual([
			'--port requires a value',
		]);
		const invalid = await parse(['--token', 't', '--debug=maybe'], { DEBUG: '1' });
		expect(invalid.ok || invalid.errors.map((error) => error.message)).toEqual([
			"Invalid value 'maybe' for --debug: must be true or false",
		]);
	});

	test('invalid values name the variable', async () => {
		const result = await parse([], { API_TOKEN: 'x', PORT: 'eighty', DEBUG: 'maybe' });
		expect(result.ok || result.errors.map((error) => error.message).sort()).toEqual([
			"Invalid value 'eighty' for --port (from $PORT): must be a number",
			"Invalid value 'maybe' for --debug (from $DEBUG): must be true or false",
		]);
	});

	test('defaults to process.env', async () => {
		process.env.JINJU_TEST_TOKEN = 'from-process';
		try {
			const cmd = command({
				description: 'x',
				flags: { token: flag.string({ description: 'Token', env: 'JINJU_TEST_TOKEN' }) },
				run: noop,
			});
			const result = await cmd.parse([]);
			expect(result.ok && result.value.flags.token).toBe('from-process');
		} finally {
			delete process.env.JINJU_TEST_TOKEN;
		}
	});
});

describe('configuration errors', () => {
	test('flag name and alias collisions', () => {
		expect(() =>
			command({
				description: 'x',
				flags: { a: flag.boolean({ alias: 'x', ...d }), b: flag.boolean({ alias: 'x', ...d }) },
				run: noop,
			}),
		).toThrow(ConfigError);
		expect(() =>
			command({
				description: 'x',
				flags: { dryRun: flag.boolean(d), 'dry-run': flag.boolean(d) },
				run: noop,
			}),
		).toThrow("Flag '--dry-run' is used by both 'dryRun' and 'dry-run'");
	});

	test('more than one multiple arg', () => {
		const files = arg.file(d).multiple();
		// @ts-expect-error also rejected at type level
		expect(() => command({ description: 'x', args: [files, files], run: noop })).toThrow(
			'Only one arg can be .multiple()',
		);
	});

	test('flags and args must be created with flag.* / arg.*', () => {
		const fake = { kind: 'flag', options: d };
		// @ts-expect-error not a flag
		expect(() => command({ description: 'x', flags: { fake }, run: noop })).toThrow(
			'Expected a flag or arg',
		);
		// @ts-expect-error not an arg
		expect(() => command({ description: 'x', args: [fake], run: noop })).toThrow(TypeError);
	});

	test('invalid names', () => {
		expect(() => command({ name: 'two words', description: 'x', run: noop })).toThrow(ConfigError);
	});
});

describe('scope', () => {
	const verbose = flag.boolean(d);
	const src = arg.string(d).required();
	const app = scope({ flags: { verbose }, args: [src] });

	test('commands inherit flags and prefix args', async () => {
		const cmd = app.command({
			description: 'x',
			flags: { force: flag.boolean(d) },
			args: [opt],
			run: noop,
		});
		expect(Object.keys(cmd.flags)).toEqual(['verbose', 'force']);
		expect(cmd.flags.verbose).toBe(verbose);
		expect([...cmd.inherited]).toEqual(['verbose']);
		const result = await cmd.parse(['a', 'b', '--verbose']);
		expect(result.ok && result.value).toMatchObject({ args: ['a', 'b'], flags: { verbose: true } });
	});

	test('own flags override and are no longer inherited', () => {
		const cmd = app.command({ description: 'x', flags: { verbose: flag.count(d) }, run: noop });
		expect(cmd.inherited.size).toBe(0);
	});

	test('nested scopes accumulate', () => {
		const nested = app.scope({ flags: { force: flag.boolean(d) }, args: [opt] });
		const cmd = nested.command({ description: 'x', run: noop });
		expect([...cmd.inherited]).toEqual(['verbose', 'force']);
		expect(cmd.args).toEqual([src, opt]);
	});

	test('rejects a second multiple arg across scope and command', () => {
		const files = scope({ args: [many] });
		// @ts-expect-error also rejected at type level
		expect(() => files.command({ description: 'x', args: [many], run: noop })).toThrow(ConfigError);
		// @ts-expect-error also rejected at type level
		expect(() => files.scope({ args: [many] })).toThrow(ConfigError);
	});

	test('rejects colliding flags', () => {
		const a = flag.boolean({ alias: 'x', ...d });
		const b = flag.boolean({ alias: 'x', ...d });
		expect(() => scope({ flags: { a, b } })).toThrow(ConfigError);
		expect(() =>
			scope({ flags: { a } }).command({ description: 'x', flags: { b }, run: noop }),
		).toThrow(ConfigError);
	});
});

describe('types', () => {
	test('run receives typed flags and args', () => {
		const repeat = flag.boolean({ alias: 'r', description: 'Repeat' });
		command({
			description: 'Sync',
			args: [arg.directory(d).required(), arg.file(d).multiple(), arg.number(d)],
			flags: { repeat, limit: flag.number(d).default(1), tags: flag.string(d).multiple() },
			run: ({ args, flags }) => {
				expectTypeOf(args).toEqualTypeOf<[string, string[] | undefined, number | undefined]>();
				expectTypeOf(flags).toEqualTypeOf<{
					repeat: boolean;
					limit: number;
					tags: string[] | undefined;
				}>();
			},
		});
	});

	test('bare string creators are not widened to any', () => {
		command({
			description: 'x',
			args: [arg.string(d)],
			flags: { mode: flag.string(d) },
			run: ({ args, flags }) => {
				expectTypeOf(args).toEqualTypeOf<[string | undefined]>();
				expectTypeOf(flags).toEqualTypeOf<{ mode: string | undefined }>();
			},
		});
	});

	test('no args or flags', () => {
		command({
			description: 'Noop',
			run: ({ args, flags }) => {
				expectTypeOf(args).toEqualTypeOf<[]>();
				expectTypeOf(flags).toEqualTypeOf<{}>();
			},
		});
	});

	test('scopes add flags and prefix args', () => {
		const app = scope({ flags: { verbose: flag.boolean(d) } });
		const project = app.scope({
			flags: { cwd: flag.directory(d).default('.') },
			args: [arg.string(d).required()],
		});
		project.command({
			description: 'Sync',
			args: [arg.number(d)],
			flags: { repeat: flag.count(d) },
			run: ({ args, flags }) => {
				expectTypeOf(args).toEqualTypeOf<[string, number | undefined]>();
				expectTypeOf(flags).toEqualTypeOf<{ verbose: boolean; cwd: string; repeat: number }>();
			},
		});
	});

	test('own flags override scope flags', () => {
		const app = scope({ flags: { level: flag.number(d) } });
		app.command({
			description: 'x',
			flags: { level: flag.string(d).required() },
			run: ({ flags }) => {
				expectTypeOf(flags).toEqualTypeOf<{ level: string }>();
			},
		});
	});
});
