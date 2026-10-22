import { afterEach, describe, expect, test, vi } from 'vitest';

import { arg } from './arg';
import { command, scope } from './command';
import { type ErrorData, ErrorTemplate } from './error-template';
import { ConfigError, JinjuError, UnknownCommandError } from './errors';
import { flag } from './flag';
import { type HelpData, HelpTemplate } from './help';
import { jinju, type ProgramConfig } from './program';

const d = { description: 'd' };

const setup = (config: Omit<ProgramConfig, 'stdout' | 'stderr' | 'exit'>) => {
	const output = { stdout: '', stderr: '', code: -1 };
	const program = jinju({
		name: 'app',
		...config,
		stdout: (text) => (output.stdout += text),
		stderr: (text) => (output.stderr += text),
		exit: (code) => (output.code = code),
	});
	return { output, program };
};

const verbose = flag.boolean({ alias: 'v', description: 'Verbose output' });
const app = scope({ flags: { verbose } });

describe('routing', () => {
	const calls: unknown[] = [];
	const record = (name: string) =>
		app.command({
			description: `${name} command`,
			args: [arg.string(d).multiple()],
			run: ({ args, flags }) => void calls.push({ name, args: args[0], verbose: flags.verbose }),
		});
	const { output, program } = setup({
		commands: {
			$: record('root'),
			sync: { $: record('sync'), files: record('sync files') },
			repeatSync: record('repeat-sync'),
			renamed: app.command({ name: 'other', aliases: ['o'], description: 'x', run: () => 3 }),
		},
	});

	test.each([
		[[], { name: 'root', args: undefined, verbose: false }],
		[['a'], { name: 'root', args: ['a'], verbose: false }],
		[['sync'], { name: 'sync', args: undefined, verbose: false }],
		[['sync', 'x'], { name: 'sync', args: ['x'], verbose: false }],
		[['sync', 'files', 'x'], { name: 'sync files', args: ['x'], verbose: false }],
		[['-v', 'sync', 'files'], { name: 'sync files', args: undefined, verbose: true }],
		[['sync', '--verbose', 'files', 'x'], { name: 'sync files', args: ['x'], verbose: true }],
		[['repeat-sync'], { name: 'repeat-sync', args: undefined, verbose: false }],
		[['--', 'sync'], { name: 'root', args: ['sync'], verbose: false }],
	])('%j', async (argv, expected) => {
		calls.length = 0;
		expect(await program.run(argv)).toBe(0);
		expect(calls).toEqual([expected]);
		expect(output.code).toBe(0);
	});

	test('shared flags are only valid for commands that inherit them', async () => {
		const { output: out, program: scoped } = setup({
			commands: {
				sync: app.command({ description: 'x', run: () => {} }),
				plain: command({ description: 'x', run: () => {} }),
			},
		});
		expect(await scoped.run(['-v', 'sync'])).toBe(0);
		expect(await scoped.run(['-v', 'plain'])).toBe(1);
		expect(out.stderr).toContain("Unknown flag '-v'");
	});

	test('scoped flags route within their subtree', async () => {
		const seen: unknown[] = [];
		const admin = app.scope({ flags: { token: flag.string({ alias: 't', ...d }).required() } });
		const { program: scoped } = setup({
			commands: {
				admin: {
					users: admin.command({ description: 'x', run: ({ flags }) => void seen.push(flags) }),
				},
			},
		});
		expect(await scoped.run(['-t', 'secret', 'admin', '-v', 'users'])).toBe(0);
		expect(seen).toEqual([{ verbose: true, token: 'secret' }]);
	});

	test('flags that disagree on taking a value must follow the command name', async () => {
		const seen: unknown[] = [];
		const a = scope({ flags: { level: flag.number(d) } });
		const b = scope({ flags: { level: flag.boolean(d) } });
		const { output: out, program: scoped } = setup({
			commands: {
				num: a.command({ description: 'x', run: ({ flags }) => void seen.push(flags.level) }),
				bool: b.command({ description: 'x', run: ({ flags }) => void seen.push(flags.level) }),
			},
		});
		expect(await scoped.run(['num', '--level', '2'])).toBe(0);
		expect(await scoped.run(['--level', 'bool'])).toBe(1);
		expect(out.stderr).toContain("Unknown flag '--level'");
		expect(seen).toEqual([2]);
	});

	test('a required scope flag is enforced for every command in the scope', async () => {
		const seen: unknown[] = [];
		const authed = scope({ flags: { token: flag.string({ alias: 't', ...d }).required() } });
		const { output: out, program: scoped } = setup({
			commands: {
				deploy: authed.command({
					description: 'x',
					run: ({ flags }) => void seen.push(flags.token),
				}),
				logs: authed.command({ description: 'x', run: ({ flags }) => void seen.push(flags.token) }),
			},
		});
		expect(await scoped.run(['deploy'])).toBe(1);
		expect(await scoped.run(['logs'])).toBe(1);
		expect(out.stderr).toContain('Missing required --token');
		expect(await scoped.run(['-t', 'a', 'deploy'])).toBe(0);
		expect(await scoped.run(['logs', '--token', 'b'])).toBe(0);
		expect(seen).toEqual(['a', 'b']);
	});

	test('scope args come after the command path', async () => {
		const seen: unknown[] = [];
		const project = scope({ args: [arg.string({ name: 'project', ...d }).required()] });
		const { program: scoped } = setup({
			commands: {
				deploy: project.command({
					description: 'x',
					args: [arg.string({ name: 'env', ...d })],
					run: ({ args }) => void seen.push(args),
				}),
			},
		});
		expect(await scoped.run(['deploy', 'site', 'staging'])).toBe(0);
		expect(seen).toEqual([['site', 'staging']]);
	});

	test('name override, aliases and exit codes', async () => {
		expect(await program.run(['other'])).toBe(3);
		expect(await program.run(['o'])).toBe(3);
		expect(output.code).toBe(3);
	});

	test('a flag not shared below ends the command path', async () => {
		calls.length = 0;
		await program.run(['sync', '--unknown', 'files']);
		expect(calls).toEqual([]);
		expect(output.stderr).toContain("Unknown flag '--unknown'");
	});
});

describe('errors', () => {
	test('validation errors are reported with usage', async () => {
		const run = vi.fn();
		const { output, program } = setup({
			commands: {
				sync: command({ description: 'x', flags: { n: flag.number(d).required() }, run }),
			},
		});
		expect(await program.run(['sync'])).toBe(1);
		expect(run).not.toHaveBeenCalled();
		expect(output.stderr).toBe("error: Missing required --n\n\nRun 'app sync --help' for usage.\n");
	});

	test('an error template instance renders failures', async () => {
		const seen: ErrorData[] = [];
		class Short extends ErrorTemplate {
			override render(data: ErrorData) {
				seen.push(data);
				return `${data.errors.length} error(s) in ${this.formatCommand(data)}\n`;
			}
		}
		const { output, program } = setup({
			error: new Short(),
			commands: {
				sync: command({ description: 'x', flags: { n: flag.number(d).required() }, run: () => {} }),
			},
		});
		expect(await program.run(['sync', '--nope'])).toBe(1);
		expect(output.stderr).toBe('2 error(s) in app sync\n');
		expect(seen[0]).toMatchObject({
			program: { name: 'app' },
			path: [{ name: 'sync', dynamic: false }],
			words: ['sync'],
			help: { usage: ['app sync [flags]'] },
		});
	});

	test('unknown commands', async () => {
		const { output, program } = setup({
			commands: { sync: command({ description: 'x', run: () => {} }) },
		});
		expect(await program.run(['nope'])).toBe(1);
		expect(output.stderr).toContain("error: Unknown command 'nope'");
	});

	test('JinjuErrors thrown from run are reported, others rethrown', async () => {
		const { output, program } = setup({
			commands: {
				soft: command({
					description: 'x',
					run: () => {
						throw new JinjuError('nope');
					},
				}),
				hard: command({
					description: 'x',
					run: () => {
						throw new Error('boom');
					},
				}),
			},
		});
		expect(await program.run(['soft'])).toBe(1);
		expect(output.stderr).toContain('error: nope');
		await expect(program.run(['hard'])).rejects.toThrow('boom');
	});
});

describe('help and version', () => {
	const { output, program } = setup({
		version: '1.2.3',
		description: 'My app',
		commands: {
			sync: {
				$: app.command({
					description: 'Sync files',
					args: [
						arg.directory({ name: 'dir', description: 'Directory' }).required(),
						arg.file(d).multiple(),
					],
					flags: {
						mode: flag
							.string({ alias: 'm', description: 'Mode', choices: ['fast', 'slow'] })
							.default('fast'),
						dryRun: flag.boolean({ description: 'Dry run' }),
						secret: flag.string({ description: 'Secret', hidden: true }),
					},
					run: () => {},
				}),
				files: app.command({ description: 'Sync only files', run: () => {} }),
			},
			hidden: app.command({ description: 'Hidden', hidden: true, run: () => {} }),
		},
	});

	test('root help', async () => {
		output.stdout = '';
		expect(await program.run(['--help'])).toBe(0);
		expect(output.stdout).toMatchInlineSnapshot(`
			"My app

			Usage:
			  app <command>

			Commands:
			  sync  Sync files

			Flags:
			  -h, --help     Show help
			  -v, --verbose  Verbose output
			  --version      Show version
			"
		`);
	});

	test('command help, even with invalid input', async () => {
		output.stdout = '';
		expect(await program.run(['sync', '-h'])).toBe(0);
		expect(output.stdout).toMatchInlineSnapshot(`
			"Sync files

			Usage:
			  app sync [flags] <dir> [<file>...]
			  app sync <command>

			Commands:
			  files  Sync only files

			Arguments:
			  <dir>   Directory (required)
			  <file>  d (multiple)

			Flags:
			  --dry-run            Dry run
			  -h, --help           Show help
			  -m, --mode <string>  Mode (choices: fast, slow; default: fast)
			  -v, --verbose        Verbose output
			  --version            Show version
			"
		`);
	});

	test('version', async () => {
		output.stdout = '';
		expect(await program.run(['--version'])).toBe(0);
		expect(output.stdout).toBe('1.2.3\n');
	});

	test('built-in switches follow the boolean switch rules', async () => {
		const ran: string[] = [];
		const { output: out, program: builtins } = setup({
			version: '1.2.3',
			commands: { go: command({ description: 'Go', run: () => void ran.push('go') }) },
		});
		for (const argv of [
			['go', '--help=false'],
			['go', '--version=false'],
			['go', '--no-help'],
			['go', '--help', '--help=no'],
		]) {
			expect(await builtins.run(argv)).toBe(0);
		}
		expect(ran).toEqual(['go', 'go', 'go', 'go']);
		expect(out.stdout).toBe('');

		expect(await builtins.run(['go', '--help=yes'])).toBe(0);
		expect(out.stdout).toContain('Usage:');
		out.stdout = '';
		expect(await builtins.run(['go', '--version=1'])).toBe(0);
		expect(out.stdout).toBe('1.2.3\n');

		expect(await builtins.run(['go', '--help=maybe'])).toBe(1);
		expect(out.stderr).toContain("Invalid value 'maybe' for --help: must be true or false");
		expect(ran).toEqual(['go', 'go', 'go', 'go']);
	});

	test('a group without a command shows help', async () => {
		const { output: out, program: groups } = setup({
			commands: { db: { migrate: command({ description: 'Migrate', run: () => {} }) } },
		});
		expect(await groups.run([])).toBe(0);
		expect(await groups.run(['db'])).toBe(1);
		expect(out.stdout).toContain('app db <command>');
	});

	test('strict: false also ignores unknown flags at a group without a command', async () => {
		const migrate = command({ description: 'Migrate', run: () => {} });
		const { output: strict, program: strictGroups } = setup({ commands: { db: { migrate } } });
		expect(await strictGroups.run(['db', '--unknown'])).toBe(1);
		expect(strict.stderr).toContain("Unknown flag '--unknown'");

		const { output: loose, program: looseGroups } = setup({
			strict: false,
			commands: { db: { migrate } },
		});
		expect(await looseGroups.run(['db', '--unknown'])).toBe(1);
		expect(loose.stderr).toBe('');
		expect(loose.stdout).toContain('app db <command>');
	});

	test('a help template instance renders --help and help()', async () => {
		const seen: string[][] = [];
		class Custom extends HelpTemplate {
			override render(data: HelpData) {
				const path = data.path.map((part) => part.name);
				seen.push(path);
				return `${data.program.name}@${data.program.version} ${path.join(' ')}: ${data.commands.map((c) => c.name).join(',')}\n`;
			}
		}
		const { output: out, program: custom } = setup({
			version: '2.0.0',
			help: new Custom(),
			commands: {
				sync: { files: app.command({ description: 'x', aliases: ['f'], run: () => {} }) },
			},
		});
		expect(await custom.run(['sync', '--help'])).toBe(0);
		expect(out.stdout).toBe('app@2.0.0 sync: files\n');
		expect(custom.help(['sync', 'files'])).toBe('app@2.0.0 sync files: \n');
		expect(seen).toEqual([['sync'], ['sync', 'files']]);
	});

	test('help() by path', () => {
		expect(program.help(['sync', 'files'])).toContain('Sync only files');
	});

	test('each command lists only the flags it accepts', () => {
		const { program: mixed } = setup({
			commands: {
				$: app.command({ description: 'Root', run: () => {} }),
				plain: command({ description: 'Plain', run: () => {} }),
			},
		});
		expect(mixed.help()).toContain('--verbose');
		expect(mixed.help(['plain'])).not.toContain('--verbose');
	});
});

describe('configuration errors', () => {
	test('reserved flags', () => {
		const x = command({ description: 'x', flags: { help: flag.boolean(d) }, run: () => {} });
		expect(() => jinju({ commands: { x } })).toThrow("Command 'x' uses reserved flag 'help'");
	});

	test('alias collisions with built-ins', () => {
		const x = command({
			description: 'x',
			flags: { hint: flag.boolean({ alias: 'h', ...d }) },
			run: () => {},
		});
		expect(() => jinju({ commands: { x } })).toThrow(ConfigError);
	});

	test('duplicate command names', () => {
		const x = command({ description: 'x', run: () => {} });
		expect(() => jinju({ commands: { fooBar: x, 'foo-bar': x } })).toThrow(
			"Duplicate command name 'foo-bar'",
		);
	});
});

describe('dynamic segments', () => {
	const calls: unknown[] = [];
	const project = scope({
		args: [arg.string({ name: 'project', description: 'Project name' }).required()],
	});
	const env = project.scope({
		args: [arg.string({ name: 'env', description: 'Environment' }).required()],
	});
	const record = (name: string) => (context: { args: unknown[] }) =>
		void calls.push({ name, args: context.args });
	const { output, program } = setup({
		commands: {
			list: command({ description: 'List projects', run: record('list') }),
			':project': {
				$: project.command({ description: 'Show a project', run: record('show') }),
				deploy: project.command({
					description: 'Deploy',
					args: [arg.string({ name: 'target', description: 'Target' })],
					run: record('deploy'),
				}),
				':env': { logs: env.command({ description: 'Logs', run: record('logs') }) },
			},
		},
	});

	test.each([
		[['list'], { name: 'list', args: [] }],
		[['site'], { name: 'show', args: ['site'] }],
		[['site', 'deploy'], { name: 'deploy', args: ['site', undefined] }],
		[['site', 'deploy', 'eu'], { name: 'deploy', args: ['site', 'eu'] }],
		[['site', 'prod', 'logs'], { name: 'logs', args: ['site', 'prod'] }],
	])('%j', async (argv, expected) => {
		calls.length = 0;
		expect(await program.run(argv)).toBe(0);
		expect(calls).toEqual([expected]);
	});

	test('-- ends the command path, so segments are not captured after it', async () => {
		output.stderr = '';
		expect(await program.run(['--', 'site'])).toBe(1);
		expect(output.stderr).toContain("error: Unknown command 'site'");
	});

	test('unknown commands below a segment', async () => {
		output.stderr = '';
		expect(await program.run(['site', 'prod', 'nope'])).toBe(1);
		expect(output.stderr).toBe(
			"error: Unknown command 'nope'\n\nRun 'app site prod --help' for usage.\n",
		);
	});

	test('segment values are parsed and validated by their arg', async () => {
		const seen: unknown[] = [];
		const item = scope({ args: [arg.number({ name: 'id', description: 'Item id' }).required()] });
		const { output: out, program: items } = setup({
			commands: {
				':id': {
					show: item.command({ description: 'x', run: ({ args }) => void seen.push(args) }),
				},
			},
		});
		expect(await items.run(['42', 'show'])).toBe(0);
		expect(seen).toEqual([[42]]);
		expect(await items.run(['abc', 'show'])).toBe(1);
		expect(out.stderr).toBe(
			"error: Invalid value 'abc' for argument <id>: must be a number\n\nRun 'app abc show --help' for usage.\n",
		);
	});

	test('help shows segments in the path', () => {
		expect(program.help()).toContain(
			'Commands:\n  list       List projects\n  <project>  Project name\n',
		);
		expect(program.help(['<project>', 'deploy'])).toContain(
			'Usage:\n  app <project> deploy [flags] [<target>]\n',
		);
		expect(program.help(['site', 'prod', 'logs'])).toContain(
			'Usage:\n  app <project> <env> logs [flags]\n',
		);
	});

	test('help data describes subcommands from the tree', () => {
		let captured: HelpData | undefined;
		class Capture extends HelpTemplate {
			override render(data: HelpData) {
				captured = data;
				return '';
			}
		}
		const { program: tree } = setup({
			help: new Capture(),
			commands: {
				list: command({ description: 'List', aliases: ['ls'], run: () => {} }),
				':project': { deploy: project.command({ description: 'Deploy', run: () => {} }) },
			},
		});
		tree.help();
		expect(captured?.commands).toEqual([
			{
				name: 'list',
				label: 'list',
				description: 'List',
				aliases: ['ls'],
				hidden: false,
				dynamic: false,
				path: [{ name: 'list', dynamic: false }],
				runnable: true,
				group: false,
			},
			{
				name: 'project',
				label: '<project>',
				description: 'Project name',
				aliases: [],
				hidden: false,
				dynamic: true,
				path: [{ name: 'project', dynamic: true }],
				runnable: false,
				group: true,
			},
		]);
		expect(captured?.program).toEqual({ name: 'app' });
	});

	test('help for a segment level', async () => {
		output.stdout = '';
		expect(await program.run(['site', '--help'])).toBe(0);
		expect(output.stdout).toContain('Usage:\n  app <project> [flags]\n  app <project> <command>\n');
		expect(output.stdout).toContain('Commands:\n  deploy  Deploy\n  <env>   Environment\n');
	});

	describe('configuration errors', () => {
		const noop = () => {};
		const named = (name: string) => arg.string({ name, description: 'd' });

		test('commands must start with the segment arg', () => {
			const x = command({ description: 'x', run: noop });
			// @ts-expect-error also a compile-time error, with the same message
			expect(() => jinju({ commands: { ':project': { x } } })).toThrow(
				"Command '<project> x' must have an arg named 'project' at position 1 for segment ':project'",
			);
			const wrongOrder = command({
				description: 'x',
				args: [named('env'), named('project')],
				run: noop,
			});
			expect(() => jinju({ commands: { ':project': { x: wrongOrder } } })).toThrow(ConfigError);
		});

		test('segments cannot be multiple args', () => {
			const x = command({ description: 'x', args: [named('files').multiple()], run: noop });
			expect(() => jinju({ commands: { ':files': { x } } })).toThrow("can't be a .multiple() arg");
		});

		test('one dynamic segment per level', () => {
			const x = command({ description: 'x', args: [named('a')], run: noop });
			// @ts-expect-error also a compile-time error, with the same message
			expect(() => jinju({ commands: { ':a': { x }, ':b': { x } } })).toThrow(
				"'root' can only have one dynamic segment",
			);
		});

		test("a level's $ command can't take positional args next to a segment", () => {
			const root = command({ description: 'x', args: [named('file')], run: noop });
			const x = command({ description: 'x', args: [named('a')], run: noop });
			// @ts-expect-error also a compile-time error, with the same message
			expect(() => jinju({ commands: { $: root, ':a': { x } } })).toThrow(
				"'root' has a dynamic segment, so its '$' command can't take positional args",
			);
		});

		test('invalid segment names', () => {
			const x = command({ description: 'x', run: noop });
			expect(() => jinju({ commands: { ':': { x } } })).toThrow("Invalid dynamic segment ':'");
		});

		test('a command can be a segment directly', async () => {
			const seen: unknown[] = [];
			const { program: direct } = setup({
				commands: {
					':name': command({
						description: 'x',
						args: [named('name')],
						run: ({ args }) => void seen.push(args),
					}),
				},
			});
			expect(await direct.run(['ada'])).toBe(0);
			expect(seen).toEqual([['ada']]);
		});
	});
});

describe('dynamic segment types', () => {
	const noop = () => {};
	const project = arg.string({ name: 'project', description: 'd' }).required();
	const env = arg.string({ name: 'env', description: 'd' }).required();
	const inScope = scope({ args: [project] });

	test('valid trees compile', () => {
		jinju({
			commands: {
				':project': {
					$: inScope.command({ description: 'x', run: noop }),
					deploy: command({ description: 'x', args: [project, env], run: noop }),
					':env': { logs: command({ description: 'x', args: [project, env], run: noop }) },
				},
			},
		});
	});

	test('a missing, unnamed or misnamed arg is a compile-time error', () => {
		const none = command({ description: 'x', run: noop });
		const unnamed = command({ description: 'x', args: [arg.string(d)], run: noop });
		const misnamed = command({ description: 'x', args: [env], run: noop });
		// @ts-expect-error no arg for the segment
		expect(() => jinju({ commands: { ':project': { none } } })).toThrow(ConfigError);
		// @ts-expect-error the arg has no name
		expect(() => jinju({ commands: { ':project': { unnamed } } })).toThrow(ConfigError);
		// @ts-expect-error the arg is named 'env'
		expect(() => jinju({ commands: { ':project': { misnamed } } })).toThrow(ConfigError);
	});

	test('nested segments must match in order', () => {
		const swapped = command({ description: 'x', args: [env, project], run: noop });
		expect(() =>
			// @ts-expect-error args are in the wrong order
			jinju({ commands: { ':project': { ':env': { swapped } } } }),
		).toThrow(ConfigError);
	});

	test('a segment arg cannot be multiple', () => {
		const files = arg.string({ name: 'files', description: 'd' }).multiple();
		const x = command({ description: 'x', args: [files], run: noop });
		// @ts-expect-error multiple arg bound to a segment
		expect(() => jinju({ commands: { ':files': { x } } })).toThrow(ConfigError);
	});

	test('the $ command at a segment level is checked too', () => {
		const root = command({ description: 'x', run: noop });
		// @ts-expect-error $ has no project arg
		expect(() => jinju({ commands: { ':project': { $: root } } })).toThrow(ConfigError);
	});

	test('names that are not literal types are left to the runtime check', () => {
		const name: string = 'project';
		const loose = command({
			description: 'x',
			args: [arg.string({ name, description: 'd' })],
			run: noop,
		});
		expect(() => jinju({ commands: { ':project': { loose } } })).not.toThrow();
	});
});

describe('defaults', () => {
	const ok = command({ description: 'x', run: () => {} });
	const exitCode = process.exitCode;
	const argv = process.argv;

	afterEach(() => {
		vi.restoreAllMocks();
		process.exitCode = exitCode;
		process.argv = argv;
	});

	test('output goes to process.stdout and process.stderr', async () => {
		const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
		const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
		const program = jinju({ name: 'app', exit: () => {}, commands: { ok } });
		await program.run(['--help']);
		await program.run(['nope']);
		expect(stdout).toHaveBeenCalledWith(expect.stringContaining('Usage:'));
		expect(stderr).toHaveBeenCalledWith(expect.stringContaining("Unknown command 'nope'"));
	});

	test('the exit code is set on process.exitCode', async () => {
		const program = jinju({
			name: 'app',
			stderr: () => {},
			commands: { ok, fail: command({ description: 'x', run: () => 3 }) },
		});
		await program.run(['ok']);
		expect(process.exitCode).toBe(0);
		await program.run(['fail']);
		expect(process.exitCode).toBe(3);
	});

	test('the name comes from the script, falling back to cli', () => {
		process.argv = ['node', '/usr/local/bin/my-tool.js'];
		expect(jinju({ commands: { ok } }).name).toBe('my-tool');
		process.argv = ['node'];
		expect(jinju({ commands: { ok } }).name).toBe('cli');
	});

	test('run() defaults to process.argv after the script', async () => {
		const seen: unknown[] = [];
		process.argv = ['node', 'app.js', 'go', 'now'];
		const go = command({
			description: 'x',
			args: [arg.string(d)],
			run: ({ args }) => void seen.push(args),
		});
		await jinju({ name: 'app', exit: () => {}, commands: { go } }).run();
		expect(seen).toEqual([['now']]);
	});
});

describe('edge cases', () => {
	test('a program with no commands shows help', async () => {
		const { output, program } = setup({ description: 'Empty', commands: {} });
		expect(await program.run([])).toBe(0);
		expect(output.stdout).toBe('Empty\n\nUsage:\n\n\nFlags:\n  -h, --help  Show help\n');
	});

	test('a dynamic segment with nothing below it has no description', () => {
		const { program } = setup({ commands: { ':project': {} } });
		expect(program.help()).toContain('Commands:\n  <project>\n');
	});

	test('help() rejects unknown paths', () => {
		const { program } = setup({
			commands: { sync: { files: command({ description: 'x', run: () => {} }) } },
		});
		expect(() => program.help(['sync', 'nope'])).toThrow(new UnknownCommandError('nope'));
	});

	test('entries must be commands or objects of commands', () => {
		const ok = command({ description: 'x', run: () => {} });
		for (const [commands, at] of [
			[{ sync: 'run' }, 'sync'],
			[{ sync: null }, 'sync'],
			[{ sync: 3 }, 'sync'],
			[{ sync: [ok] }, 'sync'],
			[{ ':project': null }, ':project'],
			[{ db: { migrate: 'up' } }, 'db migrate'],
		] as const) {
			expect(() => jinju({ commands: commands as never })).toThrow(
				new ConfigError(`'${at}' must be a command or an object of commands`),
			);
		}
		for (const commands of [null, 'sync', [ok]]) {
			expect(() => jinju({ commands: commands as never })).toThrow(
				new ConfigError("'commands' must be an object of commands"),
			);
		}
	});

	test('$ must be a command', () => {
		// @ts-expect-error a tree isn't a command (compile-time error with the same message)
		expect(() => jinju({ commands: { $: { nested: {} } } })).toThrow(
			"'$' must be a command (at 'root')",
		);
		// @ts-expect-error not a command
		expect(() => jinju({ commands: { sync: { $: 'run' } } })).toThrow(
			"'$' must be a command (at 'sync')",
		);
	});

	test('shared flags with long aliases are accepted before the command name', async () => {
		const seen: unknown[] = [];
		const inDir = scope({ flags: { cwd: flag.string({ alias: 'dir', ...d }) } });
		const { program } = setup({
			commands: {
				sync: inDir.command({ description: 'x', run: ({ flags }) => void seen.push(flags.cwd) }),
			},
		});
		expect(await program.run(['--dir', 'src', 'sync'])).toBe(0);
		expect(seen).toEqual(['src']);
	});
});

describe('env', () => {
	test('flags read the program env, including scope flags', async () => {
		const seen: unknown[] = [];
		const authed = scope({ flags: { token: flag.string({ ...d, env: 'API_TOKEN' }).required() } });
		const { output, program } = setup({
			env: { API_TOKEN: 'secret' },
			commands: {
				deploy: authed.command({
					description: 'x',
					run: ({ flags }) => void seen.push(flags.token),
				}),
			},
		});
		expect(await program.run(['deploy'])).toBe(0);
		expect(seen).toEqual(['secret']);

		const { output: out, program: empty } = setup({
			env: {},
			commands: { deploy: authed.command({ description: 'x', run: () => {} }) },
		});
		expect(await empty.run(['deploy'])).toBe(1);
		expect(out.stderr).toContain('Missing required --token');
		expect(output.stderr).toBe('');
	});

	test('help shows the variable', () => {
		const { program } = setup({
			commands: {
				x: command({
					description: 'x',
					flags: { port: flag.number({ description: 'Port', env: 'PORT' }) },
					run: () => {},
				}),
			},
		});
		expect(program.help(['x'])).toContain('--port <number>  Port (env: PORT)');
	});
});
