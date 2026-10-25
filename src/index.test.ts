import { readdirSync, readFileSync } from 'node:fs';

import ts from 'typescript';
import { describe, expect, expectTypeOf, test } from 'vitest';

import * as jinju from './index';
import type {
	AnyArg,
	HelpArg,
	HelpCommand,
	HelpData,
	HelpFlag,
	HelpParam,
	HelpPathPart,
	HelpProgram,
	HelpRow,
	HelpTemplate,
	HelpTemplateOptions,
	AnyCommand,
	AnyFlag,
	Arg,
	ArgList,
	ArgOptions,
	CheckArgs,
	CheckTree,
	NodeErrors,
	SegmentError,
	TreeErrors,
	CommandConfig,
	CommandTree,
	DefaultValue,
	ErrorData,
	ErrorTemplateOptions,
	Defined,
	Flag,
	FlagOptions,
	FlagRecord,
	InferArgs,
	InferArgType,
	InferFlags,
	InferFlagType,
	IsMultiple,
	JsonValue,
	MergeFlags,
	MultipleOptions,
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
	CheckSchemaInput,
	SchemaInput,
	SchemaOutput,
	StandardSchemaIssue,
	StandardSchemaResult,
	StandardSchemaV1,
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
			'ErrorTemplate',
			'HelpTemplate',
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
			'formatPath',
			'jinju',
			'packageVersion',
			'scope',
		]);
	});

	test('flag and arg creators', () => {
		expect(Object.keys(jinju.flag).sort()).toEqual([
			'boolean',
			'count',
			'custom',
			'date',
			'directory',
			'email',
			'entry',
			'file',
			'json',
			'number',
			'schema',
			'string',
			'url',
		]);
		expect(Object.keys(jinju.arg).sort()).toEqual([
			'custom',
			'date',
			'directory',
			'email',
			'entry',
			'file',
			'json',
			'number',
			'schema',
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
		expectTypeOf<NumberOptions<1 | 2>['choices']>().toEqualTypeOf<readonly (1 | 2)[] | undefined>();
		expectTypeOf<MultipleOptions>().toEqualTypeOf<{ separator?: string }>();
		expectTypeOf<{ a: [1, 'b', null] }>().toExtend<JsonValue>();
		expectTypeOf<undefined>().not.toExtend<JsonValue>();
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
		expectTypeOf<RunContext<Flags, Args>['unknown']>().toEqualTypeOf<readonly string[]>();
	});

	test('command and program types', () => {
		expectTypeOf<CommandConfig<{}, [], unknown>>().toHaveProperty('run');
		expectTypeOf<ScopeConfig<{}, []>>().toHaveProperty('flags');
		expectTypeOf<ScopeConfig<{}, []>>().toHaveProperty('strict');
		expectTypeOf<CommandConfig<{}, [], unknown>>().toHaveProperty('strict');
		expectTypeOf<Scope>().toHaveProperty('command');
		expectTypeOf<RunResult>().toEqualTypeOf<void | number | Promise<void | number>>();
		expectTypeOf<Parsed>().toHaveProperty('argv');
		expectTypeOf<Parsed>().toHaveProperty('unknown');
		expectTypeOf<Result<number>>().toEqualTypeOf<
			{ ok: true; value: number } | { ok: false; errors: jinju.JinjuError[] }
		>();
		expectTypeOf<CommandTree>().toBeObject();
		expectTypeOf<CheckTree<{ x: jinju.Command }>>().toBeUnknown();
		expectTypeOf<TreeErrors<{ x: jinju.Command }, [], ''>>().toBeNever();
		expectTypeOf<NodeErrors<jinju.Command, [], 'x'>>().toBeNever();
		expectTypeOf<SegmentError<[], ['a'], 'x'>>().toBeString();
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

	test('standard schema types', () => {
		expectTypeOf<StandardSchemaV1<string, number>['~standard']['validate']>().returns.toEqualTypeOf<
			StandardSchemaResult<number> | Promise<StandardSchemaResult<number>>
		>();
		expectTypeOf<StandardSchemaIssue>().toHaveProperty('message');
		expectTypeOf<SchemaInput<StandardSchemaV1<string, number>>>().toEqualTypeOf<string>();
		expectTypeOf<SchemaOutput<StandardSchemaV1<string, number>>>().toEqualTypeOf<number>();
		expectTypeOf<CheckSchemaInput<StandardSchemaV1<string, number>>>().toBeUnknown();
	});

	test('help types', () => {
		expectTypeOf<HelpTemplate['render']>().parameter(0).toEqualTypeOf<HelpData>();
		expectTypeOf<HelpTemplate['render']>().returns.toBeString();
		expectTypeOf<HelpTemplate['formatFlag']>().returns.toEqualTypeOf<HelpRow>();
		expectTypeOf<HelpTemplateOptions>().toEqualTypeOf<{
			sortFlags?: boolean;
			showHidden?: boolean;
		}>();
		expect(new jinju.HelpTemplate()).toBeInstanceOf(jinju.HelpTemplate);
		expectTypeOf<HelpData['flags'][number]>().toEqualTypeOf<HelpFlag>();
		expectTypeOf<HelpData['args'][number]>().toEqualTypeOf<HelpArg>();
		expectTypeOf<HelpData['commands'][number]>().toEqualTypeOf<HelpCommand>();
		expectTypeOf<HelpFlag>().toExtend<HelpParam>();
		expectTypeOf<HelpArg>().toExtend<HelpParam>();
		expectTypeOf<HelpCommand>().toExtend<HelpPathPart>();
		expectTypeOf<HelpData['program']>().toEqualTypeOf<HelpProgram>();
		expectTypeOf<HelpFlag['source']>().toEqualTypeOf<'command' | 'scope' | 'builtin'>();
		expectTypeOf<HelpArg['source']>().toEqualTypeOf<'command' | 'scope'>();
		expectTypeOf(jinju.formatPath).parameter(0).toEqualTypeOf<readonly HelpPathPart[]>();
		expectTypeOf<ProgramConfig['help']>().toEqualTypeOf<HelpTemplate | undefined>();
		expectTypeOf<ProgramConfig['env']>().toEqualTypeOf<
			Readonly<Record<string, string | undefined>> | undefined
		>();
		expectTypeOf<HelpFlag['env']>().toEqualTypeOf<string | undefined>();
		expectTypeOf<FlagOptions['env']>().toEqualTypeOf<string | undefined>();
		expectTypeOf<ParseOptions['env']>().toEqualTypeOf<
			Readonly<Record<string, string | undefined>> | undefined
		>();
	});

	test('error template types', () => {
		expectTypeOf<jinju.ErrorTemplate['render']>().parameter(0).toEqualTypeOf<ErrorData>();
		expectTypeOf<jinju.ErrorTemplate['render']>().returns.toBeString();
		expectTypeOf<ErrorData['errors'][number]>().toEqualTypeOf<jinju.JinjuError>();
		expectTypeOf<ErrorData['help']>().toEqualTypeOf<HelpData>();
		expectTypeOf<ErrorTemplateOptions>().toEqualTypeOf<{ hint?: boolean }>();
		expectTypeOf<ProgramConfig['error']>().toEqualTypeOf<jinju.ErrorTemplate | undefined>();
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

describe('documentation', () => {
	// Every export, values and types, as listed in `index.ts`.
	const exported = () => {
		const file = new URL('index.ts', import.meta.url);
		const source = ts.createSourceFile(
			'index.ts',
			readFileSync(file, 'utf8'),
			ts.ScriptTarget.Latest,
		);
		return source.statements.flatMap((statement) =>
			ts.isExportDeclaration(statement) &&
			statement.exportClause &&
			ts.isNamedExports(statement.exportClause)
				? statement.exportClause.elements.map((element) => element.name.text)
				: [],
		);
	};

	// Headings of the API reference (`docs/api/*.md`) naming an export, e.g. ``## `flag` ``.
	const documented = () => {
		const dir = new URL('../docs/api/', import.meta.url);
		const pages = readdirSync(dir).filter((name) => name.endsWith('.md'));
		return new Set(
			pages.flatMap((page) =>
				[...readFileSync(new URL(page, dir), 'utf8').matchAll(/^#{2,3} `(\w+)`/gm)].map(
					([, name]) => name,
				),
			),
		);
	};

	test('every export has a heading in the API reference', () => {
		const names = exported();
		expect(names.length).toBeGreaterThan(0);
		const headings = documented();
		expect(names.filter((name) => !headings.has(name))).toEqual([]);
	});
});
