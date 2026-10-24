---
description: 'jinju() builds a program from a command tree: its options, nested commands, running it with argv and rendering help.'
---

# Program

`jinju()` builds a program from a tree of commands. The program's methods then [run it](#running) or [render its help](#rendering-help).

Keep defining the program separate from running it. The definition is plain configuration, and the program can be run as many times as you like, with any input.

```ts twoslash
import { command, jinju, packageVersion } from 'jinju';

const init = command({ description: 'Create a project', run: () => {} });
const build = command({ description: 'Build the project', run: () => {} });
const watch = command({ description: 'Rebuild on changes', run: () => {} });

const app = jinju({
	name: 'app',
	version: packageVersion(import.meta.url),
	description: 'My app',
	commands: {
		init,
		build: { $: build, watch }, // app build, app build watch
	},
});

await app.run();
```

## Config

`jinju({ name?, version?, description?, commands, strict?, help?, error?, env?, stdout?, stderr?, exit?, signals? })`

| Option        | Default                 | Description                                                                                                    |
| ------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------- |
| `commands`    |                         | The command tree. Required.                                                                                    |
| `name`        | The script's file name  | Shown in usage and error hints.                                                                                |
| `version`     |                         | Printed by `--version`. Without it, there's no `--version` flag.                                               |
| `description` |                         | Shown at the top of the root help page.                                                                        |
| `strict`      | `true`                  | Reject unknown flags. With `false`, they're passed to `run` in `unknown`. Scopes and commands can override it. |
| `help`        | `new HelpTemplate()`    | Renders help pages. See [Help](./help).                                                                        |
| `error`       | `new ErrorTemplate()`   | Renders errors. See [Errors](./errors).                                                                        |
| `env`         | `process.env`           | Where flags' `env` variables are read from.                                                                    |
| `stdout`      | `process.stdout.write`  | Receives help and version text.                                                                                |
| `stderr`      | `process.stderr.write`  | Receives error output.                                                                                         |
| `exit`        | Sets `process.exitCode` | Receives the exit code.                                                                                        |
| `signals`     | `['SIGINT', 'SIGTERM']` | Process signals that [cancel](./commands#cancellation) a running command. `[]` leaves them to Node.            |

See [Testing](./testing) for how `env`, `stdout`, `stderr` and `exit` help in tests.

## The command tree

- Each key is a command name. Its value is a command, or an object of subcommands.
- `$` is the command for that level itself. In `{ build: { $: build, watch } }`, `app build` runs `build` and `app build watch` runs `watch`.
- A level without `$` is a group: running it shows its help, which lists its subcommands.
- A `:name` key is a [dynamic segment](./dynamic-segments), which reads a value before the command name.
- `{ $: command }` at the root makes a single-command CLI.

Mistakes such as duplicate names, `$` holding a subtree or invalid names throw a `ConfigError` when `jinju()` is called. Mistakes in dynamic segments are also [compile-time errors](./dynamic-segments#compile-time-checks).

## The program

`jinju()` returns a [`Program`](../api/program#program):

| Member                 | Description                                                                                                                                     |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `run(argv?, options?)` | Parses argv, routes it to a command and runs it. Resolves to the exit code. `options.signal` can [cancel](./commands#cancellation) the command. |
| `help(path?)`          | Returns the help text for a command path, without printing it.                                                                                  |
| `name`                 | The program's name: `name` from the config, or the script's file name.                                                                          |

### Running

`run()` reads `process.argv.slice(2)` by default:

```ts twoslash
import { command, jinju } from 'jinju';
const build = command({ description: 'Build the project', run: () => {} });
const app = jinju({ name: 'app', commands: { build } });
// ---cut---
await app.run(); // node app.js build --watch → ['build', '--watch']
```

Pass argv yourself to run the program with other input, such as in [tests](./testing), when embedding a CLI in another tool, or when your arguments come from somewhere other than `process.argv`:

```ts twoslash
import { command, jinju } from 'jinju';
const build = command({ description: 'Build the project', run: () => {} });
const app = jinju({ name: 'app', commands: { build } });
// ---cut---
const code = await app.run(['build', '--help']);
//    ^?
```

`run()` resolves to the [exit code](#exit-codes) and also passes it to `exit`. It rejects only when a `run` handler throws an error that isn't a `JinjuError`.

### Rendering help

`help(path?)` returns the help text for a command path, e.g. `app.help(['build', 'watch'])`, or the root page with no path. This is useful to generate docs or snapshot help in tests. It throws an `UnknownCommandError` for an unknown name.

## Routing

`run()` takes the longest command path that matches argv. Static names win over dynamic segments.

Flags can come before the command name when a command further down the tree inherits them from a [scope](./scopes): `app -v build`. A flag that no command below that point inherits, or `--`, ends the command path.

## Built-in flags

- `--help`/`-h` prints the help page for the matched level, and exits with `0`.
- `--version` prints `version`, and exits with `0`. It only exists when `version` is set.

Running a group (a level without `$`) prints its help. It exits with `0` when there was no input at all (just `app`), and with `1` otherwise (e.g. `app build` when `build` is a group). An unknown command name there is an error.

## Exit codes

`app.run()` resolves to the exit code and passes it to `exit`, which by default sets `process.exitCode`, so Node exits with it once pending work is done.

| Code       | When                                                                                 |
| ---------- | ------------------------------------------------------------------------------------ |
| `0`        | Success, `--help` or `--version`                                                     |
| `1`        | Invalid input, or a `JinjuError` thrown from `run`                                   |
| any number | Returned from `run`                                                                  |
| `130`      | [Cancelled](./commands#cancellation) by Ctrl+C (`SIGINT`) or `run`'s `signal` option |
| `143`      | Cancelled by `SIGTERM` (any signal: `128` plus its number)                           |

## Reading the version

`packageVersion(from)` reads `version` from the nearest `package.json` at or above `from`, usually your CLI's `import.meta.url`. It throws a `ConfigError` if there's no `package.json` or it has no `version`.
