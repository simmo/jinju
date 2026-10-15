import { describe, expect, expectTypeOf, test } from 'vitest';

import * as jinju from './index';
import type {
	AnyArg,
	AnyFlag,
	Arg,
	ArgList,
	ArgOptions,
	CommandConfig,
	CommandTree,
	Flag,
	FlagOptions,
	FlagRecord,
	InferArgs,
	InferArgType,
	InferFlags,
	InferFlagType,
	NumberOptions,
	Parse,
	Parsed,
	ParamState,
	PathOptions,
	ProgramConfig,
	Result,
	RunContext,
	RunResult,
	Scope,
	ScopeConfig,
	StringOptions,
	Switch,
} from './index';

describe('runtime exports', () => {
	test('exposes exactly the public API', () => {
		expect(Object.keys(jinju).sort()).toEqual([
			'Command',
			'ConfigError',
			'DuplicateFlagError',
			'InvalidValueError',
			'JinjuError',
			'MissingRequiredError',
			'MissingValueError',
			'Program',
			'UnexpectedArgError',
			'UnknownCommandError',
			'UnknownFlagError',
			'arg',
			'command',
			'flag',
			'jinju',
			'scope',
		]);
	});

	test('flag and arg creators', () => {
		expect(Object.keys(jinju.flag).sort()).toEqual([
			'boolean',
			'count',
			'custom',
			'directory',
			'email',
			'file',
			'number',
			'string',
			'url',
		]);
		expect(Object.keys(jinju.arg).sort()).toEqual([
			'custom',
			'directory',
			'email',
			'file',
			'number',
			'string',
			'url',
		]);
	});

	test('errors share a base class', () => {
		const errors = [
			jinju.ConfigError,
			jinju.DuplicateFlagError,
			jinju.InvalidValueError,
			jinju.MissingRequiredError,
			jinju.MissingValueError,
			jinju.UnexpectedArgError,
			jinju.UnknownCommandError,
			jinju.UnknownFlagError,
		];
		expect(Object.keys(jinju).filter((name) => name.endsWith('Error'))).toHaveLength(
			errors.length + 1,
		);
		for (const error of errors) expect(error.prototype).toBeInstanceOf(jinju.JinjuError);
		expect(jinju.JinjuError.prototype).toBeInstanceOf(Error);
	});

	test('end to end', async () => {
		let received: unknown;
		const app = jinju.scope({
			flags: { verbose: jinju.flag.boolean({ alias: 'v', description: 'v' }) },
		});
		const program = jinju.jinju({
			commands: {
				greet: app.command({
					description: 'Greet',
					args: [jinju.arg.string({ name: 'name', description: 'Name' }).required()],
					run: ({ args: [name], flags }) => {
						received = { name, verbose: flags.verbose };
					},
				}),
			},
			exit: () => {},
		});
		expect(program).toBeInstanceOf(jinju.Program);
		expect(await program.run(['-v', 'greet', 'Ada'])).toBe(0);
		expect(received).toEqual({ name: 'Ada', verbose: true });
	});
});

describe('type exports', () => {
	test('param types', () => {
		expectTypeOf<Flag<string | undefined, string>>().toExtend<AnyFlag>();
		expectTypeOf<Switch<boolean>>().toExtend<AnyFlag>();
		expectTypeOf<Arg<number, number>>().toExtend<AnyArg>();
		expectTypeOf<[Arg<number, number>]>().toExtend<ArgList>();
		expectTypeOf<{ x: Switch<boolean> }>().toExtend<FlagRecord>();
		expectTypeOf<FlagOptions>().toHaveProperty('alias');
		expectTypeOf<ArgOptions>().toHaveProperty('name');
		expectTypeOf<NumberOptions>().toHaveProperty('integer');
		expectTypeOf<PathOptions>().toHaveProperty('exists');
		expectTypeOf<StringOptions<'a'>['choices']>().toEqualTypeOf<readonly 'a'[] | undefined>();
		expectTypeOf<Parse<number>>().returns.toEqualTypeOf<number | Promise<number>>();
		expectTypeOf<ParamState>().toHaveProperty('multiple');
	});

	test('inference helpers', () => {
		type Flags = { n: Flag<number, number>; v: Switch<boolean> };
		type Args = [Arg<string | undefined, string>];
		expectTypeOf<InferFlagType<Flags['n']>>().toEqualTypeOf<number>();
		expectTypeOf<InferArgType<Args[0]>>().toEqualTypeOf<string | undefined>();
		expectTypeOf<InferFlags<Flags>>().toEqualTypeOf<{ n: number; v: boolean }>();
		expectTypeOf<InferArgs<Args>>().toEqualTypeOf<[string | undefined]>();
		expectTypeOf<RunContext<Flags, Args>['flags']>().toEqualTypeOf<{ n: number; v: boolean }>();
	});

	test('command and program types', () => {
		expectTypeOf<CommandConfig<{}, [], unknown>>().toHaveProperty('run');
		expectTypeOf<ScopeConfig<{}, []>>().toHaveProperty('flags');
		expectTypeOf<Scope>().toHaveProperty('command');
		expectTypeOf<RunResult>().toEqualTypeOf<void | number | Promise<void | number>>();
		expectTypeOf<Parsed>().toHaveProperty('argv');
		expectTypeOf<Result<number>>().toEqualTypeOf<
			{ ok: true; value: number } | { ok: false; errors: jinju.JinjuError[] }
		>();
		expectTypeOf<CommandTree>().toBeObject();
		expectTypeOf<ProgramConfig>().toHaveProperty('commands');
	});
});
