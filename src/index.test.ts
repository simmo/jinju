import { describe, expect, expectTypeOf, test } from 'vitest';

import * as jinju from './index';
import type {
	AnyArg,
	AnyCommand,
	AnyFlag,
	Arg,
	ArgList,
	ArgOptions,
	CheckArgs,
	CommandConfig,
	CommandTree,
	DefaultValue,
	Defined,
	Flag,
	FlagOptions,
	FlagRecord,
	InferArgs,
	InferArgType,
	InferFlags,
	InferFlagType,
	IsMultiple,
	MergeFlags,
	NumberOptions,
	Parse,
	Parsed,
	Param,
	ParamInit,
	ParamKind,
	ParamOptions,
	ParamState,
	ParseOptions,
	PathOptions,
	ProgramConfig,
	Result,
	RunContext,
	RunResult,
	Scope,
	ScopeConfig,
	ScopeDefinition,
	StringOptions,
	Switch,
	Toggle,
	ValueType,
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
		expectTypeOf<jinju.Command>().toExtend<AnyCommand>();
		expectTypeOf<ParseOptions>().toHaveProperty('strict');
		expectTypeOf<ScopeDefinition>().toHaveProperty('args');
		expectTypeOf<MergeFlags<{ a: 1; b: 2 }, { b: 3 }>>().toEqualTypeOf<{ a: 1; b: 3 }>();
		expectTypeOf<CheckArgs<[Arg<string[], string>]>>().toBeUnknown();
		expectTypeOf<CheckArgs<[Arg<string[], string>, Arg<string[], string>]>>().toHaveProperty(
			'~error',
		);
	});

	test('param base types', () => {
		expectTypeOf<Flag<string | undefined, string>>().toExtend<Param<string | undefined, string>>();
		expectTypeOf<Arg<string, string>>().toExtend<Param<string, string>>();
		expectTypeOf<Switch<boolean>>().toExtend<Param<boolean, boolean>>();
		expectTypeOf<IsMultiple<string[] | undefined, string>>().toEqualTypeOf<true>();
		expectTypeOf<IsMultiple<string[], string[]>>().toEqualTypeOf<false>();
		expectTypeOf<DefaultValue<string[], string>>().toEqualTypeOf<readonly [string, ...string[]]>();
		expectTypeOf<undefined>().not.toExtend<Defined>();
		expectTypeOf<ParamInit<number>>().toHaveProperty('value');
		expectTypeOf<ValueType<number>['parse']>().returns.toEqualTypeOf<number | Promise<number>>();
		expectTypeOf<Toggle<number>>().returns.toBeNumber();
		expectTypeOf<ParamKind>().toEqualTypeOf<'arg' | 'flag' | 'switch'>();
		expectTypeOf<ParamOptions>().toHaveProperty('choices');
	});
});
