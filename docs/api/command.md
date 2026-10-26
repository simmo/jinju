---
description: 'API reference for command() and scope(): their config, the run context and returned values.'
---

# command & scope

See the [Commands](../guide/commands) and [Scopes](../guide/scopes) guides for usage.

## `command`

```ts
function command<const A extends ArgList = [], F extends FlagRecord = {}>(
	config: CommandConfig<F, A, RunContext<F, A>>,
): Command<F, A>;
```

Creates a standalone command. The same as `scope({}).command(config)`.

## `scope`

```ts
function scope<const A extends ArgList = [], F extends FlagRecord = {}>(
	config: ScopeConfig<F, A>,
): Scope<F, A>;
```

Creates a [`Scope`](#scope-interface): flags and args shared by every command created from it.

## `CommandConfig`

```ts
interface CommandConfig<F extends FlagRecord, A extends ArgList, Ctx, Prefix extends ArgList = []> {
	name?: string;
	description: string;
	aliases?: readonly string[];
	hidden?: boolean;
	strict?: boolean;
	flags?: F;
	args?: A & CheckArgs<[...Prefix, ...A]>;
	run: (context: Ctx) => RunResult;
}
```

`Ctx` is the context `run` receives, a [`RunContext`](#runcontext). `Prefix` is the args inherited from a scope, which are checked together with the command's own.

## `RunContext`

```ts
interface RunContext<F extends FlagRecord, A extends ArgList> {
	flags: InferFlags<F>;
	args: InferArgs<A>;
	argv: readonly string[];
	unknown: readonly string[];
	signal: AbortSignal;
}
```

What `run` receives: typed flags and args, the argv the command parsed (without the command path), and `unknown`: flags the command doesn't define, as given (e.g. `--foo=bar`), in order. `unknown` is only filled when the command isn't strict; otherwise unknown flags are errors and `run` isn't called. `signal` is aborted when the run is [cancelled](../guide/commands#cancellation).

## `RunResult`

```ts
type RunResult = void | number | Promise<void | number>;
```

What `run` returns. A number sets the exit code.

## `Command`

```ts
class Command<F extends FlagRecord = FlagRecord, A extends ArgList = ArgList> {
	readonly config: CommandConfig<FlagRecord, ArgList, never>;
	readonly flags: F;
	readonly args: A;
	readonly inherited: ReadonlySet<string>;
	readonly strict: boolean | undefined;
	get description(): string;
	get params(): readonly Param[];
	parse(argv: readonly string[], options?: ParseOptions): Promise<Result<Parsed>>;
	execute(parsed: Parsed, signal?: AbortSignal): RunResult;
}
```

| Member      | Description                                                                                                                             |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `flags`     | Own and inherited flags.                                                                                                                |
| `args`      | Inherited args followed by own args.                                                                                                    |
| `inherited` | Keys of flags inherited from the scope and not redefined.                                                                               |
| `strict`    | The command's own `strict`, or else its innermost scope's that sets one. `undefined` when none do, so `parse` uses its `strict` option. |
| `params`    | The args as [`Param`](./types#param)s.                                                                                                  |
| `parse`     | Parses argv (without the command path) into flags and args.                                                                             |
| `execute`   | Calls `run` with parsed input, and `signal` (by default one that's never aborted).                                                      |

Create commands with [`command`](#command) or `scope.command` rather than `new Command`.

## `ParseOptions`

```ts
interface ParseOptions {
	globals?: FlagRecord;
	strict?: boolean;
	leading?: readonly string[];
	env?: Readonly<Record<string, string | undefined>>;
}
```

| Option    | Description                                                                                                                                |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `globals` | Extra flags parsed and validated alongside the command's own, such as the program's built-ins. Their values aren't included in the result. |
| `strict`  | Reject unknown flags, for commands (and scopes) that don't set `strict`. Defaults to `true`. With `false`, they're returned in `unknown`.  |
| `leading` | Positional values captured before the command name (dynamic segments), placed first.                                                       |
| `env`     | Where flags' `env` variables are read from. Defaults to `process.env`.                                                                     |

## `Parsed`

```ts
interface Parsed {
	flags: Record<string, unknown>;
	args: unknown[];
	argv: readonly string[];
	unknown?: readonly string[];
}
```

The untyped result of `Command.parse`, passed to `Command.execute`. `parse` always sets `unknown`. It's optional so that a `Parsed` built by hand, as before `unknown` existed, still works: `execute` passes `[]` to `run` when it's missing.

## `Scope` {#scope-interface}

```ts
interface Scope<P extends FlagRecord = {}, PA extends ArgList = []> {
	readonly flags: P;
	readonly args: PA;
	command<const A extends ArgList = [], F extends FlagRecord = {}>(
		config: CommandConfig<F, A, RunContext<MergeFlags<P, F>, [...PA, ...A]>, PA>,
	): Command<MergeFlags<P, F>, [...PA, ...A]>;
	scope<const A extends ArgList = [], F extends FlagRecord = {}>(
		config: ScopeConfig<F, A, PA>,
	): Scope<MergeFlags<P, F>, [...PA, ...A]>;
}
```

`command` creates a command that inherits the scope's flags and args. `scope` creates a nested scope that adds more.

## `ScopeConfig`

```ts
interface ScopeConfig<F extends FlagRecord, A extends ArgList, Prefix extends ArgList = []> {
	flags?: F;
	args?: A & CheckArgs<[...Prefix, ...A]>;
	strict?: boolean;
}
```

`flags` are declared by every command in the scope, and accepted before the command name. Every command in the scope starts with `args`. `strict` sets whether its commands reject unknown flags. It overrides the program and any outer scope, and commands can override it.

## `ScopeDefinition`

```ts
interface ScopeDefinition {
	flags: FlagRecord;
	args: ArgList;
	strict?: boolean;
}
```

The flags, args and `strict` setting a command inherits from its scope.

## `AnyCommand`

```ts
type AnyCommand = Command<any, any>;
```

Any command, for constraints in generic code.
