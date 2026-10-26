import type { ArgList } from './arg';
import { kebabCase } from './case';
import {
	ConfigError,
	InvalidValueError,
	type JinjuError,
	MissingValueError,
	UnexpectedArgError,
	UnknownFlagError,
} from './errors';
import { type FlagRecord, Switch } from './flag';
import type { CheckArgs, InferArgs, InferFlags, MergeFlags } from './infer';
import { type Param, type Result, toParam } from './param';
import { type FlagLookup, type FlagSpec, tokenize } from './tokenize';
import { toBoolean } from './value';

export interface RunContext<F extends FlagRecord, A extends ArgList> {
	flags: InferFlags<F>;
	args: InferArgs<A>;
	/** The argv this command parsed (command path removed). */
	argv: readonly string[];
	/**
	 * Flags the command doesn't define, as given (e.g. `--foo=bar`), in order. Only filled
	 * when the command isn't strict; otherwise they're errors and `run` isn't called.
	 */
	unknown: readonly string[];
	/**
	 * Aborted when the run is cancelled, e.g. by Ctrl+C. Pass it to `fetch`, child processes
	 * and timers, or check `signal.aborted`, to stop early.
	 */
	signal: AbortSignal;
}

/** Return a number to set the exit code. */
export type RunResult = void | number | Promise<void | number>;

export interface CommandConfig<
	F extends FlagRecord,
	A extends ArgList,
	Ctx,
	Prefix extends ArgList = [],
> {
	/** Overrides the name derived from the command's key. A single word. */
	name?: string;
	description: string;
	/** Alternative names for routing. */
	aliases?: readonly string[];
	/** Hide from help listings. */
	hidden?: boolean;
	/** Reject unknown flags. Overrides the scope's and the program's setting. */
	strict?: boolean;
	flags?: F;
	/** Appended to any args inherited from the scope. */
	args?: A & CheckArgs<[...Prefix, ...A]>;
	run: (context: Ctx) => RunResult;
}

/** Flags and args a command inherits from its scope. */
export interface ScopeDefinition {
	flags: FlagRecord;
	args: ArgList;
	/** Whether the scope's commands reject unknown flags, unless they set their own. */
	strict?: boolean;
}

const EMPTY_SCOPE: ScopeDefinition = { flags: {}, args: [] };

const checkMultiple = (params: readonly Param[]) => {
	if (params.filter((param) => param.state.multiple).length > 1) {
		throw new ConfigError('Only one arg can be .multiple()');
	}
};

export interface FlagEntry {
	key: string;
	param: Param;
	/** Primary display label, e.g. `--dry-run`. */
	label: string;
}

export interface FlagIndex extends FlagLookup {
	entries: Map<string, FlagEntry>;
}

/** Maps long names/aliases to flag keys, throwing on collisions. */
export const indexFlags = (flags: Record<string, unknown>): FlagIndex => {
	const entries = new Map<string, FlagEntry>();
	const long = new Map<string, FlagSpec>();
	const short = new Map<string, FlagSpec>();
	const claim = (map: Map<string, FlagSpec>, name: string, spec: FlagSpec, display: string) => {
		const existing = map.get(name);
		if (existing && existing.key !== spec.key) {
			throw new ConfigError(
				`Flag '${display}' is used by both '${existing.key}' and '${spec.key}'`,
			);
		}
		map.set(name, spec);
	};

	for (const [key, value] of Object.entries(flags)) {
		const param = toParam(value);
		const name = kebabCase(key);
		const spec = { key, takesValue: param.kind !== 'switch' };
		entries.set(key, { key, param, label: `--${name}` });
		claim(long, name, spec, `--${name}`);

		const { alias } = param.options;
		if (alias === undefined) continue;
		if (alias.length === 1) claim(short, alias, spec, `-${alias}`);
		else claim(long, alias, spec, `--${alias}`);
	}

	return { entries, long: (name) => long.get(name), short: (char) => short.get(char) };
};

const argLabel = (param: Param): string => `<${param.options.name ?? param.value.name}>`;

/**
 * Distributes positionals across args. Args before the (single) multiple arg fill from the
 * left, args after it from the right, and the multiple arg takes the middle. With too few
 * values, required args are served first, then optional args left to right.
 */
export const allocate = (params: readonly Param[], values: readonly string[]) => {
	const variadic = params.findIndex((param) => param.state.multiple);
	const fixed = params.map((_, index) => index).filter((index) => index !== variadic);
	const takes = new Set(fixed.filter((index) => params[index]!.state.required));
	const minVariadic = variadic !== -1 && params[variadic]!.state.required ? 1 : 0;

	let spare = values.length - takes.size - minVariadic;
	for (const index of fixed) {
		if (spare <= 0) break;
		if (takes.has(index)) continue;
		takes.add(index);
		spare--;
	}
	// Too few values even for required args: drop the right-most claims, keeping the
	// value a required multiple arg needs (so `cp a` reports the missing destination).
	for (const index of fixed.toReversed()) {
		if (takes.size + minVariadic <= values.length) break;
		takes.delete(index);
	}

	const before = fixed.filter((index) => variadic === -1 || index < variadic);
	const after = fixed.filter((index) => variadic !== -1 && index > variadic);
	const result: string[][] = params.map(() => []);
	let start = 0;
	let end = values.length;

	for (const index of before) if (takes.has(index)) result[index] = [values[start++]!];
	for (const index of after.toReversed()) if (takes.has(index)) result[index] = [values[--end]!];

	const middle = values.slice(start, end);
	if (variadic === -1) return { inputs: result, extra: middle };
	result[variadic] = middle;
	return { inputs: result, extra: [] };
};

export interface ParseOptions {
	/**
	 * Extra flags parsed and validated alongside the command's own (e.g. program built-ins).
	 * Their values aren't included in the result.
	 */
	globals?: FlagRecord;
	/**
	 * Reject unknown flags, for commands (and their scopes) that don't set `strict`. Defaults
	 * to `true`.
	 */
	strict?: boolean;
	/** Positional values captured before the command name (dynamic segments), placed first. */
	leading?: readonly string[];
	/** Where flags' `env` variables are read from. Defaults to `process.env`. */
	env?: Readonly<Record<string, string | undefined>>;
}

export interface Parsed {
	flags: Record<string, unknown>;
	args: unknown[];
	argv: readonly string[];
	/** Always set by `parse`. Optional so `Parsed` values built by hand still work; `execute` defaults it to `[]`. */
	unknown?: readonly string[];
}

// oxlint-disable-next-line no-explicit-any
export type AnyCommand = Command<any, any>;

/** A runnable command: flags + args + handler. Name-less; mounted by `jinju()`. */
export class Command<F extends FlagRecord = FlagRecord, A extends ArgList = ArgList> {
	/** Own and inherited flags. */
	readonly flags: F;
	/** Inherited args followed by own args. */
	readonly args: A;
	/** Keys of flags inherited from the scope (and not redefined by the command). */
	readonly inherited: ReadonlySet<string>;
	/** The command's own `strict`, or else its scope's. `undefined` when neither sets it. */
	readonly strict: boolean | undefined;
	readonly #params: Param[];

	constructor(
		readonly config: CommandConfig<FlagRecord, ArgList, never>,
		scope: ScopeDefinition = EMPTY_SCOPE,
	) {
		const own = config.flags ?? {};
		this.flags = { ...scope.flags, ...own } as F;
		this.inherited = new Set(Object.keys(scope.flags).filter((key) => !(key in own)));
		this.args = [...scope.args, ...(config.args ?? [])] as unknown as A;
		this.strict = config.strict ?? scope.strict;
		this.#params = this.args.map(toParam);
		indexFlags(this.flags);
		checkMultiple(this.#params);

		if (config.name !== undefined && !/^[^\s:$-][^\s]*$/.test(config.name)) {
			throw new ConfigError(`Invalid command name '${config.name}'`);
		}
	}

	get description(): string {
		return this.config.description;
	}

	get params(): readonly Param[] {
		return this.#params;
	}

	/** Parses argv (without the command path) into typed flags and args. */
	async parse(argv: readonly string[], options: ParseOptions = {}): Promise<Result<Parsed>> {
		const { globals = {} } = options;
		const strict = this.strict ?? options.strict ?? true;
		const index = indexFlags({ ...globals, ...this.flags });
		const errors: JinjuError[] = [];
		const flagInputs = new Map<string, string[]>();
		const occurrences = new Map<string, boolean[]>();
		const positionals: string[] = [...(options.leading ?? [])];
		const unknown: string[] = [];
		const given = new Set<string>();

		for (const token of tokenize(argv, index)) {
			if (token.type === 'arg') {
				positionals.push(token.value);
				continue;
			}
			if (token.type === 'unknown') {
				if (strict) errors.push(new UnknownFlagError(token.raw));
				else unknown.push(token.raw);
				continue;
			}

			const { label, param } = index.entries.get(token.key)!;
			// Given on the command line, even if invalid: the env fallback no longer applies.
			given.add(token.key);
			if (param.kind === 'switch') {
				const on = switchState(token);
				if (on === undefined) {
					errors.push(new InvalidValueError(label, token.value!, 'must be true or false'));
				} else {
					occurrences.set(token.key, [...(occurrences.get(token.key) ?? []), on]);
				}
			} else if (token.missing) {
				errors.push(new MissingValueError(label));
			} else {
				flagInputs.set(token.key, [...(flagInputs.get(token.key) ?? []), token.value!]);
			}
		}

		const env = options.env ?? process.env;
		const flags: Record<string, unknown> = {};
		// Every accepted flag (own and `globals`) is validated; only the command's own are returned.
		const flagResults = [...index.entries].map(async ([key, { label, param }]) => {
			const own = Object.hasOwn(this.flags, key);
			const name = param.options.env;
			const fromEnv = given.has(key) || name === undefined ? undefined : env[name] || undefined;

			if (fromEnv === undefined && param instanceof Switch) {
				if (own) flags[key] = param.resolveSwitch(occurrences.get(key) ?? []);
				return;
			}
			const result =
				fromEnv === undefined
					? await param.resolve(flagInputs.get(key) ?? [], label)
					: await param.resolve([fromEnv], `${label} (from $${name})`);
			if (!result.ok) errors.push(...result.errors);
			else if (own) flags[key] = result.value;
		});

		const { extra, inputs } = allocate(this.#params, positionals);
		for (const value of extra) errors.push(new UnexpectedArgError(value));
		const args: unknown[] = [];
		const argResults = this.#params.map(async (param, i) => {
			const result = await param.resolve(inputs[i]!, `argument ${argLabel(param)}`);
			if (result.ok) args[i] = result.value;
			else errors.push(...result.errors);
		});

		await Promise.all([...flagResults, ...argResults]);
		if (errors.length > 0) return { ok: false, errors };
		return { ok: true, value: { args, argv, flags, unknown } };
	}

	/**
	 * Invokes the handler with parsed input. `signal` cancels the run; without one, it's
	 * never aborted.
	 */
	execute(parsed: Parsed, signal: AbortSignal = new AbortController().signal): RunResult {
		type Run = (context: Required<Parsed> & { signal: AbortSignal }) => RunResult;
		return (this.config.run as Run)({ ...parsed, unknown: parsed.unknown ?? [], signal });
	}
}

/**
 * What a switch token sets: `--x` → `true`, `--no-x` → `false`, `--x=<value>` → the value
 * (`true`/`1`/`yes`/`on` or `false`/`0`/`no`/`off`), inverted for `--no-x=<value>`.
 * `undefined` when the value isn't a boolean.
 */
export const switchState = (token: { value?: string; negated?: boolean }): boolean | undefined => {
	if (token.value === undefined) return !token.negated;
	const on = toBoolean(token.value);
	return on === undefined ? undefined : on !== Boolean(token.negated);
};

export interface ScopeConfig<F extends FlagRecord, A extends ArgList, Prefix extends ArgList = []> {
	/** Flags every command in the scope declares. Accepted before the command name. */
	flags?: F;
	/** Args every command in the scope starts with. */
	args?: A & CheckArgs<[...Prefix, ...A]>;
	/**
	 * Reject unknown flags. Overrides the program's setting and any outer scope's; commands
	 * can override it.
	 */
	strict?: boolean;
}

/** Shared flags and args for a group of commands. Scopes nest. */
export interface Scope<P extends FlagRecord = {}, PA extends ArgList = []> {
	readonly flags: P;
	readonly args: PA;
	/** Creates a command that inherits this scope's flags and args. */
	command<const A extends ArgList = [], F extends FlagRecord = {}>(
		config: CommandConfig<F, A, RunContext<MergeFlags<P, F>, [...PA, ...A]>, PA>,
	): Command<MergeFlags<P, F>, [...PA, ...A]>;
	/** Creates a nested scope adding more flags and args. */
	scope<const A extends ArgList = [], F extends FlagRecord = {}>(
		config: ScopeConfig<F, A, PA>,
	): Scope<MergeFlags<P, F>, [...PA, ...A]>;
}

const createScope = (definition: ScopeDefinition): Scope => ({
	flags: definition.flags,
	args: definition.args as [],
	command: ((config: CommandConfig<FlagRecord, ArgList, never>) =>
		new Command(config, definition)) as Scope['command'],
	scope: ((config: { flags?: FlagRecord; args?: ArgList; strict?: boolean }) => {
		const strict = config.strict ?? definition.strict;
		const next: ScopeDefinition = {
			flags: { ...definition.flags, ...config.flags },
			args: [...definition.args, ...(config.args ?? [])],
			...(strict === undefined ? {} : { strict }),
		};
		indexFlags(next.flags);
		checkMultiple(next.args.map(toParam));
		return createScope(next);
	}) as Scope['scope'],
});

const root = createScope(EMPTY_SCOPE);

/** Creates a scope: flags and args shared by every command created from it. */
export const scope: Scope['scope'] = root.scope;

/** Creates a standalone command. */
export const command: Scope['command'] = root.command;
