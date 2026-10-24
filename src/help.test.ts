import { describe, expect, test } from 'vitest';

import { arg } from './arg';
import { command, scope } from './command';
import { flag } from './flag';
import {
	formatPath,
	type HelpData,
	type HelpEntry,
	type HelpFlag,
	HelpTemplate,
	type HelpContext,
	helpData,
	renderHelp,
} from './help';

const d = { description: 'd' };
const part = (name: string, dynamic = false) => ({ name, dynamic });
const program = { name: 'app' };
const entry = (name: string, description: string, extra: Partial<HelpEntry> = {}): HelpEntry => ({
	name,
	description,
	aliases: [],
	hidden: false,
	dynamic: false,
	path: [part(name, extra.dynamic)],
	runnable: true,
	group: false,
	...extra,
});
const help = (context: Partial<HelpContext>, template?: HelpTemplate) =>
	renderHelp({ program, path: [], subcommands: [], ...context }, template);

describe('usage', () => {
	test('marks required, optional and multiple args', () => {
		const cmd = command({
			description: 'x',
			args: [
				arg
					.string({ ...d, name: 'src' })
					.multiple()
					.required(),
				arg.string({ ...d, name: 'dest' }),
				arg.number(d).required(),
			],
			run: () => {},
		});
		expect(help({ command: cmd })).toContain('Usage:\n  app <src>... [<dest>] <number>\n');
	});

	test('leaves out args bound to dynamic segments', () => {
		const cmd = command({
			description: 'x',
			args: [arg.string({ ...d, name: 'project' }).required(), arg.string({ ...d, name: 'env' })],
			run: () => {},
		});
		const output = help({
			command: cmd,
			segments: 1,
			path: [part('project', true), part('deploy')],
		});
		expect(output).toContain('Usage:\n  app <project> deploy [<env>]\n');
		expect(output).toContain('Arguments:\n  <project>  d (required)\n  <env>      d\n');
	});

	test('includes [flags] only when there are visible or built-in flags', () => {
		const bare = command({ description: 'x', run: () => {} });
		expect(help({ command: bare })).toContain('Usage:\n  app\n');
		expect(help({ command: bare, builtins: { help: flag.boolean(d) } })).toContain('app [flags]');
	});

	test('a group lists its visible commands, segments in angle brackets', () => {
		const output = help({
			description: 'Group',
			subcommands: [
				entry('a', 'First'),
				entry('longer', 'Second', { aliases: ['l'] }),
				entry('secret', 'Hidden', { hidden: true }),
				entry('project', 'A project', { dynamic: true }),
			],
		});
		expect(output).toBe(
			'Group\n\nUsage:\n  app <command>\n\nCommands:\n  a          First\n  longer     Second\n  <project>  A project\n',
		);
	});
});

describe('flags', () => {
	const flags = help({
		builtins: { help: flag.boolean({ alias: 'h', description: 'Show help' }) },
		command: command({
			description: 'x',
			flags: {
				zeta: flag.string({ description: 'Last' }),
				dryRun: flag.boolean({ alias: 'n', description: 'Dry run' }),
				color: flag.boolean({ alias: 'c', description: 'Colour' }).default(true),
				level: flag.count({ description: 'Level' }),
				tag: flag.string({ alias: 't', description: 'Tags' }).multiple().default(['a', 'b']),
				out: flag.directory({ alias: 'output', description: 'Out' }).required(),
				mode: flag.string({ description: 'Mode', choices: ['fast', 'slow'] }),
				site: flag.url({ description: 'Site' }).default(new URL('https://a.b/')),
				secret: flag.string({ description: 'Secret', hidden: true }),
			},
			run: () => {},
		}),
	});

	test('one table, sorted by long name, hidden flags omitted', () => {
		expect(flags.slice(flags.indexOf('Flags:'))).toMatchInlineSnapshot(`
			"Flags:
			  -c, --[no-]color             Colour
			  -n, --dry-run                Dry run
			  -h, --help                   Show help
			  --level                      Level
			  --mode <string>              Mode (choices: fast, slow)
			  --output, --out <directory>  Out (required)
			  --site <url>                 Site (default: https://a.b/)
			  -t, --tag <string>           Tags (multiple; default: a, b)
			  --zeta <string>              Last
			"
		`);
	});
});

test('arguments show their tags', () => {
	const cmd = command({
		description: 'x',
		args: [arg.number({ name: 'n', description: 'Count' }).default(3)],
		run: () => {},
	});
	expect(help({ command: cmd })).toContain('Arguments:\n  <n>  Count (default: 3)\n');
});

describe('helpData', () => {
	const project = scope({
		flags: { verbose: flag.count({ alias: 'v', description: 'Verbose' }) },
		args: [arg.string({ name: 'project', description: 'Project' }).required()],
	});
	const cmd = project.command({
		description: 'Deploy',
		aliases: ['d'],
		args: [arg.string({ name: 'env', description: 'Env', choices: ['a', 'b'] }).default('a')],
		flags: {
			dryRun: flag.boolean({ alias: 'n', description: 'Dry run' }),
			color: flag.boolean({ description: 'Colour' }).default(true),
			tag: flag.string({ description: 'Tags' }).multiple(),
			retries: flag.number({ description: 'Retries', min: 0, max: 5, integer: true }),
			secret: flag.string({ description: 'Secret', hidden: true }),
		},
		run: () => {},
	});
	const data = helpData({
		program: { name: 'app', version: '1.0.0', description: 'An app' },
		path: [part('project', true), part('deploy')],
		description: 'Deploy',
		command: cmd,
		subcommands: [entry('status', 'Status', { aliases: ['s'], hidden: true, group: true })],
		builtins: { help: flag.boolean({ alias: 'h', description: 'Help' }) },
		segments: 1,
	});

	test('describes the page and program', () => {
		expect(data).toMatchObject({
			program: { name: 'app', version: '1.0.0', description: 'An app' },
			path: [part('project', true), part('deploy')],
			description: 'Deploy',
			aliases: ['d'],
			runnable: true,
			usage: ['app <project> deploy [flags] [<env>]', 'app <project> deploy <command>'],
		});
	});

	test('subcommands include their path, label and shape', () => {
		expect(data.commands).toEqual([
			{
				name: 'status',
				label: 'status',
				description: 'Status',
				aliases: ['s'],
				hidden: true,
				dynamic: false,
				path: [part('status')],
				runnable: true,
				group: true,
			},
		]);
	});

	test('args include raw details, usage, source and segment binding', () => {
		expect(data.args).toEqual([
			{
				name: 'project',
				label: '<project>',
				usage: '<project>',
				source: 'scope',
				type: 'string',
				description: 'Project',
				required: true,
				multiple: false,
				hasDefault: false,
				default: undefined,
				options: { name: 'project', description: 'Project' },
				segment: true,
			},
			{
				name: 'env',
				label: '<env>',
				usage: '[<env>]',
				source: 'command',
				type: 'string',
				description: 'Env',
				required: false,
				multiple: false,
				hasDefault: true,
				default: 'a',
				choices: ['a', 'b'],
				options: { name: 'env', description: 'Env', choices: ['a', 'b'] },
				segment: false,
			},
		]);
	});

	test('flags keep definition order, hidden ones included, with source and labels', () => {
		expect(data.flags.map((flag) => [flag.key, flag.source])).toEqual([
			['verbose', 'scope'],
			['dryRun', 'command'],
			['color', 'command'],
			['tag', 'command'],
			['retries', 'command'],
			['secret', 'command'],
			['help', 'builtin'],
		]);
		expect(data.flags[1]).toEqual({
			key: 'dryRun',
			name: 'dry-run',
			alias: 'n',
			kind: 'switch',
			source: 'command',
			type: 'boolean',
			hidden: false,
			label: '-n, --dry-run',
			description: 'Dry run',
			required: false,
			multiple: false,
			hasDefault: true,
			default: false,
			options: { alias: 'n', description: 'Dry run' },
		});
		expect(data.flags[2]).toMatchObject({ kind: 'switch', default: true, label: '--[no-]color' });
		expect(data.flags[3]).toMatchObject({
			kind: 'flag',
			type: 'string',
			multiple: true,
			label: '--tag <string>',
		});
		expect(data.flags[4]!.options).toMatchObject({ min: 0, max: 5, integer: true });
		expect(data.flags[5]).toMatchObject({ key: 'secret', hidden: true });
	});

	test('flags include their env variable', () => {
		const withEnv = helpData({
			program,
			path: [],
			subcommands: [],
			command: command({
				description: 'x',
				flags: { token: flag.string({ description: 'Token', env: 'API_TOKEN' }) },
				run: () => {},
			}),
		});
		expect(withEnv.flags[0]).toMatchObject({ key: 'token', env: 'API_TOKEN' });
		expect(data.flags[0]).not.toHaveProperty('env');
	});

	test('shared flags at a group level are from a scope', () => {
		const group = helpData({
			program,
			path: [],
			subcommands: [],
			shared: { verbose: flag.boolean(d) },
		});
		expect(group.flags[0]).toMatchObject({ key: 'verbose', source: 'scope' });
		expect(group.aliases).toEqual([]);
	});

	test('a level with only subcommands is not runnable', () => {
		const group = helpData({ program, path: [], subcommands: [entry('a', 'A')] });
		expect(group.runnable).toBe(false);
		expect(group.usage).toEqual(['app <command>']);
		expect(group.commands[0]!.label).toBe('a');
	});

	test('dynamic commands are labelled as segments', () => {
		const group = helpData({
			program,
			path: [],
			subcommands: [entry('project', 'P', { dynamic: true })],
		});
		expect(group.commands[0]!.label).toBe('<project>');
	});
});

describe('HelpTemplate', () => {
	const cmd = command({
		description: 'Run',
		flags: {
			zeta: flag.string({ description: 'Last' }),
			alpha: flag.boolean({ alias: 'a', description: 'First' }),
			secret: flag.string({ description: 'Secret', hidden: true }),
		},
		run: () => {},
	});
	const context = {
		command: cmd,
		subcommands: [entry('visible', 'Shown'), entry('internal', 'Hidden', { hidden: true })],
	};

	test('is the default', () => {
		expect(help(context, new HelpTemplate())).toBe(help(context));
		expect(help(context)).not.toContain('secret');
		expect(help(context)).not.toContain('internal');
	});

	test('options: showHidden and sortFlags', () => {
		const all = help(context, new HelpTemplate({ showHidden: true, sortFlags: false }));
		expect(all).toContain('internal  Hidden');
		expect(all).toContain(
			'Flags:\n  --zeta <string>    Last\n  -a, --alpha        First\n  --secret <string>  Secret\n',
		);
	});

	test('override a row formatter', () => {
		class Upper extends HelpTemplate {
			override formatFlag(flag: HelpFlag) {
				const [label, description] = super.formatFlag(flag);
				return [label, description.toUpperCase()] as const;
			}
		}
		expect(help(context, new Upper())).toContain('-a, --alpha      FIRST\n');
	});

	test('override sections to add, remove or reorder', () => {
		class Compact extends HelpTemplate {
			override sections(data: HelpData) {
				return [
					`${data.program.name} ${this.formatPath(data.path)}`.trim(),
					this.formatFlags(data),
				];
			}
		}
		const output = help({ ...context, path: [part('project', true), part('run')] }, new Compact());
		expect(output).toBe(
			'app <project> run\n\nFlags:\n  -a, --alpha      First\n  --zeta <string>  Last\n',
		);
	});

	test('override render to replace the layout', () => {
		class Names extends HelpTemplate {
			override render(data: HelpData) {
				return `${this.flags(data)
					.map((flag) => flag.name)
					.join(' ')}\n`;
			}
		}
		expect(help(context, new Names())).toBe('alpha zeta\n');
	});

	test('tags show separators and number choices', () => {
		const tags = flag.string({ description: 'Tags' }).multiple({ separator: ',' });
		const level = flag.number({ description: 'Level', choices: [1, 2, 3] });
		const cmd = command({ description: 'x', flags: { tags, level }, run: () => {} });
		const page = help({ command: cmd });
		expect(page).toContain("--tags <string>   Tags (multiple, separated by ',')");
		expect(page).toContain('--level <number>  Level (choices: 1, 2, 3)');
		const data = helpData({ program, path: [], subcommands: [], command: cmd });
		expect(data.flags.find((entry) => entry.name === 'tags')).toMatchObject({ separator: ',' });
	});

	test('tags include env, after the default', () => {
		const port = flag.number({ description: 'Port', env: 'PORT' }).default(80);
		const debug = flag.boolean({ description: 'Debug', env: 'DEBUG' });
		const page = help({
			command: command({ description: 'x', flags: { port, debug }, run: () => {} }),
		});
		expect(page).toContain('--port <number>  Port (default: 80; env: PORT)');
		expect(page).toContain('--debug          Debug (env: DEBUG)');
	});

	test('methods can be used on their own', () => {
		const template = new HelpTemplate();
		expect(
			template.formatTable([
				['a', 'First'],
				['longer', 'Second'],
			]),
		).toEqual(['a       First', 'longer  Second']);
		expect(template.formatSection('Title', ['one', 'two'])).toBe('Title:\n  one\n  two');
		expect(template.formatValue([new URL('https://a.b/'), 2])).toBe('https://a.b/, 2');
		expect(template.formatPath([part('project', true), part('deploy')])).toBe('<project> deploy');
		expect(template.options).toEqual({ sortFlags: true, showHidden: false });
	});

	test('a page with nothing to list', () => {
		expect(help({ description: 'Hi' })).toBe('Hi\n\nUsage:\n\n');
	});
});

test('formatPath', () => {
	expect(formatPath([])).toBe('');
	expect(formatPath([part('project', true), part('deploy')])).toBe('<project> deploy');
});
