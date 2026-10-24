---
description: 'API reference for jinju() and Program: the program config, run() and help(), and packageVersion().'
---

# Program

See the [Program guide](../guide/program) for usage.

## `jinju`

```ts
function jinju<const T extends CommandTree>(config: ProgramConfig<T>): Program;
```

Creates a program from a tree of commands. Throws a `ConfigError` if the tree or its commands are invalid.

## `ProgramConfig`

```ts
interface ProgramConfig<T extends CommandTree = CommandTree> {
	name?: string;
	version?: string;
	description?: string;
	commands: T & CheckTree<T>;
	strict?: boolean;
	env?: Readonly<Record<string, string | undefined>>;
	help?: HelpTemplate;
	error?: ErrorTemplate;
	stdout?: (text: string) => void;
	stderr?: (text: string) => void;
	exit?: (code: number) => void;
}
```

| Option        | Default                    | Description                                                               |
| ------------- | -------------------------- | ------------------------------------------------------------------------- |
| `name`        | The script's file name     | Shown in usage.                                                           |
| `version`     |                            | Enables `--version`.                                                      |
| `description` |                            | Shown on the root help page.                                              |
| `commands`    |                            | The [command tree](#commandtree).                                         |
| `strict`      | `true`                     | Reject unknown flags. With `false`, they're passed to `run` in `unknown`. |
| `env`         | `process.env`              | Where flags' `env` variables are read from.                               |
| `help`        | `new HelpTemplate()`       | Renders help pages.                                                       |
| `error`       | `new ErrorTemplate()`      | Renders error output.                                                     |
| `stdout`      | Writes to `process.stdout` | Receives help and version output.                                         |
| `stderr`      | Writes to `process.stderr` | Receives error output.                                                    |
| `exit`        | Sets `process.exitCode`    | Receives the exit code.                                                   |

## `Program`

```ts
class Program {
	readonly name: string;
	constructor(config: ProgramConfig);
	run(argv?: readonly string[]): Promise<number>;
	help(path?: readonly string[]): string;
}
```

What [`jinju`](#jinju) returns. Define it once, then call its methods:

```ts
const app = jinju({ name: 'app', commands });

await app.run();
```

Use `jinju` rather than `new Program`, because `jinju` checks the command tree's types.

### Properties

| Property | Description                                                            |
| -------- | ---------------------------------------------------------------------- |
| `name`   | The program's name: `name` from the config, or the script's file name. |

### `run(argv?)`

```ts
run(argv?: readonly string[]): Promise<number>;
```

Parses `argv`, routes it to a command and runs it. `argv` defaults to `process.argv.slice(2)`; pass it yourself to run with other input, e.g. `app.run(['build', '--watch'])`.

Resolves to the exit code, which it also passes to `exit` (by default, setting `process.exitCode`). Help, `--version` and errors are written to `stdout` or `stderr`. It rejects only when a `run` handler throws an error that isn't a `JinjuError`.

### `help(path?)`

```ts
help(path?: readonly string[]): string;
```

Returns the help text for a command path, e.g. `app.help(['sync', 'repeat'])`, without printing it. With no path, it returns the root page. Throws `UnknownCommandError` for an unknown name.

## `CommandTree`

```ts
interface CommandTree {
	readonly [key: string]: AnyCommand | CommandTree;
}
```

Commands keyed by name. Nest objects for subcommands; `$` is the command for that level. A `:name` key is a dynamic segment, which captures one word into the commands' arg named `name`.

## `packageVersion`

```ts
function packageVersion(from: string | URL): string;
```

Reads `version` from the nearest `package.json` at or above `from`, usually the CLI's own `import.meta.url`. Pass the result as `jinju({ version })`. Throws a `ConfigError` when there's no `package.json`, or it has no `version`.
