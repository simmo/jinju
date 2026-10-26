import { describe, expect, test } from 'vitest';

import { type ErrorData, ErrorTemplate } from './error-template';
import { JinjuError, MissingRequiredError, UnknownFlagError } from './errors';

const data = (errors: JinjuError[], words: string[] = ['my-site', 'deploy']): ErrorData => ({
	program: { name: 'app' },
	errors,
	path: [
		{ name: 'project', dynamic: true },
		{ name: 'deploy', dynamic: false },
	],
	words,
	help: {
		program: { name: 'app' },
		path: [],
		aliases: [],
		runnable: true,
		usage: ['app <project> deploy [flags]'],
		commands: [],
		args: [],
		flags: [],
	},
});

describe('ErrorTemplate', () => {
	const errors = [new MissingRequiredError('--token'), new UnknownFlagError('--nope')];

	test('formats warnings', () => {
		expect(new ErrorTemplate().formatWarning('--old is deprecated')).toBe(
			'warning: --old is deprecated',
		);
	});

	test('lists errors with a hint using the command as typed', () => {
		expect(new ErrorTemplate().render(data(errors))).toBe(
			"error: Missing required --token\nerror: Unknown flag '--nope'\n\nRun 'app my-site deploy --help' for usage.\n",
		);
	});

	test('the hint can be turned off', () => {
		const template = new ErrorTemplate({ hint: false });
		expect(template.options).toEqual({ hint: false });
		expect(template.render(data(errors))).toBe(
			"error: Missing required --token\nerror: Unknown flag '--nope'\n",
		);
	});

	test('at the root, the hint names just the program', () => {
		expect(new ErrorTemplate().formatHint(data([], []))).toBe("Run 'app --help' for usage.");
	});

	test('override a formatter, using the error type', () => {
		class Friendly extends ErrorTemplate {
			override formatError(error: JinjuError) {
				if (error instanceof MissingRequiredError) return `✗ please provide ${error.label}`;
				return super.formatError(error);
			}
		}
		expect(new Friendly().formatErrors(data(errors))).toBe(
			"✗ please provide --token\nerror: Unknown flag '--nope'",
		);
	});

	test('override sections to use the help data', () => {
		class WithUsage extends ErrorTemplate {
			override sections(input: ErrorData) {
				return [this.formatErrors(input), `Usage: ${input.help.usage[0]}`];
			}
		}
		expect(new WithUsage().render(data([new JinjuError('Bad')]))).toBe(
			'error: Bad\n\nUsage: app <project> deploy [flags]\n',
		);
	});

	test('override render to replace the output', () => {
		class Json extends ErrorTemplate {
			override render(input: ErrorData) {
				return `${JSON.stringify(input.errors.map((error) => error.name))}\n`;
			}
		}
		expect(new Json().render(data(errors))).toBe('["MissingRequiredError","UnknownFlagError"]\n');
	});
});
