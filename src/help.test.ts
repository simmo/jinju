import { describe, expect, test } from 'vitest';

import { arg } from './arg';
import { command } from './command';
import { flag } from './flag';
import { type HelpContext, renderHelp } from './help';

const d = { description: 'd' };
const help = (context: Partial<HelpContext>) =>
	renderHelp({ usage: 'app', subcommands: [], globals: {}, ...context });

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
		const output = help({ command: cmd, segments: 1, usage: 'app <project> deploy' });
		expect(output).toContain('Usage:\n  app <project> deploy [<env>]\n');
		expect(output).toContain('Arguments:\n  <project>  d (required)\n  <env>      d\n');
	});

	test('includes [flags] only when there are visible or built-in flags', () => {
		const bare = command({ description: 'x', run: () => {} });
		expect(help({ command: bare })).toContain('Usage:\n  app\n');
		expect(help({ command: bare, globals: { help: flag.boolean(d) } })).toContain('app [flags]');
	});

	test('a group lists its commands', () => {
		const output = help({
			description: 'Group',
			subcommands: [
				{ name: 'a', description: 'First' },
				{ name: 'longer', description: 'Second' },
			],
		});
		expect(output).toBe(
			'Group\n\nUsage:\n  app <command>\n\nCommands:\n  a       First\n  longer  Second\n',
		);
	});
});

describe('flags', () => {
	const flags = help({
		globals: { help: flag.boolean({ alias: 'h', description: 'Show help' }) },
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
