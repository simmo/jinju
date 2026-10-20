<br/>

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="./.github/assets/logo-dark.svg">
	<img alt="Jinju logo" src="./.github/assets/logo-light.svg" width="150">
</picture>

<small>Opinionated Node CLI Toolkit</small>

[![npm (latest)](https://img.shields.io/npm/v/jinju/latest?color=00b894&label=latest&style=flat)](https://www.npmjs.com/package/jinju) [![npm (beta)](https://img.shields.io/npm/v/jinju/beta?color=0984e3&label=beta&style=flat)](https://www.npmjs.com/package/jinju?activeTab=versions) [![GitHub Workflow Status](https://img.shields.io/github/actions/workflow/status/simmo/jinju/ci.yml?style=flat)](https://github.com/simmo/jinju/actions/workflows/ci.yml) ![Fallow health](.github/badges/health.svg)

---

## API

Define flags, args and commands separately, then compose them. Everything is immutable and fully typed.

```ts
import { arg, flag, jinju, scope } from 'jinju';

// Flags shared by every command created from the scope.
const app = scope({
	flags: { verbose: flag.count({ alias: 'v', description: 'Increase verbosity' }) },
});

const files = arg.directory({ name: 'files', description: 'Path to the files' }).required();
const repeat = flag.boolean({ alias: 'r', description: 'Repeat the operation' });

const sync = app.command({
	description: 'Sync files',
	args: [files],
	flags: {
		repeat,
		mode: flag.string({ description: 'Mode', choices: ['fast', 'safe'] }).default('safe'),
	},
	run: ({ args: [path], flags }) => {
		// path: string, flags: { verbose: number; repeat: boolean; mode: 'fast' | 'safe' }
	},
});

await jinju({
	version: '1.0.0',
	commands: { sync: { $: sync, repeat: app.command({ description: '…', run: () => {} }) } },
}).run(); // defaults to process.argv.slice(2)
```

### Flags

`flag.string({choices?})`, `flag.number({min?, max?, integer?})`, `flag.url()`, `flag.email()`, `flag.directory({exists?})`, `flag.file({exists?})` and `flag.custom(parse)` take a value (`--name value`, `--name=value`, `-n value`, `-nvalue`). Paths resolve to absolute paths.

`flag.boolean()` (`--x` / `--no-x`, defaults to `false`) and `flag.count()` (`-vvv` → `3`) are switches that never take a value.

All flags share `{description, alias?, hidden?}`. The object key is the flag name, converted from camelCase to kebab-case (`dryRun` → `--dry-run`).

| Modifier               | Effect                                                                            |
| ---------------------- | --------------------------------------------------------------------------------- |
| `.required(on = true)` | Must be provided. Clears any default.                                             |
| `.multiple(on = true)` | Repeatable, collected into an array. Converts any existing default (`v` ↔ `[v]`). |
| `.default(value)`      | Used when absent. Clears `required`. Must be a non-empty array when `multiple`.   |

| Definition                              | `InferFlagType`           |
| --------------------------------------- | ------------------------- |
| `flag.url(o)`                           | `URL \| undefined`        |
| `flag.url(o).multiple()`                | `URL[] \| undefined`      |
| `flag.url(o).default(url)`              | `URL`                     |
| `flag.url(o).required().multiple()`     | `URL[]`                   |
| `flag.string({choices: ['a', 'b'], …})` | `'a' \| 'b' \| undefined` |

Custom types: `flag.custom((input, options) => value, 'name')` returns a creator. Throw to reject input; parsers may be async. `arg.custom` accepts the same parser.

### Args

Args are a tuple (`args: [src, dest]`) and `run` receives a typed tuple. They use the same creators and modifiers as flags (except switches and `alias`) and are optional by default. At most one arg can be `.multiple()`. Args before it fill from the left, args after it fill from the right, and it takes the middle. For example, `[src.multiple().required(), dest.required()]` behaves like `cp`. When values are scarce, required args are filled first.

### Commands

`command({name?, description, aliases?, hidden?, flags?, args?, run})`. A command's name comes from its key in the tree (camelCase → kebab-case) unless `name` is set. `run` may be async and may return an exit code. Throw a `JinjuError` from `run` to report an error cleanly.

### Scopes

`scope({flags?, args?})` groups what several commands share. `scope.command(config)` creates a command that inherits the scope's flags and args, and `scope.scope(config)` nests a scope that adds more. `command()` is the same as a command from an empty scope.

```ts
const app = scope({ flags: { verbose } });
const project = app.scope({
	args: [arg.string({ name: 'project', description: 'Project' }).required()],
});

const deploy = project.command({
	description: 'Deploy',
	args: [arg.string({ name: 'env', description: 'Environment' })],
	run: ({ args: [project, env], flags: { verbose } }) => {},
});
// app -v deploy my-site staging
```

- **Flags** merge with the command's own. If a command defines a flag with the same key, its own definition replaces the inherited one.
- **Args** go first: `run` receives `[...scopeArgs, ...commandArgs]`, read after the command name. The one-`.multiple()` rule applies across the whole tuple.
- **Before the command name**, any flag inherited by a command further down the tree is accepted (`app -v deploy …`). If the command that matches doesn't declare it, that's an "Unknown flag" error. A flag name that takes a value in one scope but not in another must come after the command name.

### Dynamic segments

A `:name` key in the command tree reads a value before the command name. The value goes into the commands' arg called `name`, which comes from a scope:

```ts
const project = scope({
	args: [arg.string({ name: 'project', description: 'Project' }).required()],
});

const deploy = project.command({
	description: 'Deploy',
	args: [arg.string({ name: 'env', description: 'Environment' })],
	run: ({ args: [project, env] }) => {}, // [string, string | undefined]
});

jinju({ commands: { list, ':project': { deploy } } });
// app my-site deploy staging
```

- Segment values are ordinary args: they're parsed and validated by the arg, and appear first in `args`. Nested segments (`{ ':project': { ':env': { logs } } }`) fill the leading args in order.
- Static names win over a segment: `app list` runs `list`, not a project named `list`.
- Mistakes in the tree are compile-time errors on `commands`, worded like the `ConfigError` that `jinju()` throws for them at runtime:
  - `$` isn't a command (subcommands go under named keys next to it): `'$' must be a command (at 'sync')`;
  - a level has more than one segment;
  - a level's `$` command takes its own positional args alongside a segment;
  - a command under a segment doesn't have the matching named arg at the right position, e.g. `Command '<project> x' must have an arg named 'project' at position 1 for segment ':project'`;
  - the segment's arg is `.multiple()`.

  The arg checks need literal names (as above); args named with a plain `string` are only checked at runtime.

- Help shows segments in the path (`app <project> deploy [<env>]`). Error hints use the values that were actually typed (`Run 'app my-site deploy --help'`).

### Program

`jinju({name?, version?, description?, commands, strict?, help?, error?, stdout?, stderr?, exit?})`

- Nest objects for subcommands. `$` is the command for that level. A `:name` key is a dynamic segment (see below).
- Routing takes the longest matching command path. A flag not inherited by any command below that point, or `--`, ends the path.
- Help lists every flag a command accepts (its own, inherited and built-in) in one table, sorted by name.
- `--help`/`-h` and `--version` are built in. Use `packageVersion(import.meta.url)` to read `version` from your CLI's nearest `package.json`.
- Errors are collected and printed with a usage hint. Exit code `1`.
- `run()` resolves to the exit code and sets `process.exitCode`. Override this with `exit`.

### Help

`--help` pages are rendered by a `HelpTemplate`. Pass an instance as `help` to customise them, either with options or by extending the class and overriding any method:

```ts
import { type HelpData, type HelpFlag, HelpTemplate } from 'jinju';

class MyHelp extends HelpTemplate {
	override formatFlag(flag: HelpFlag) {
		const [label, description] = super.formatFlag(flag);
		return [label, flag.source === 'builtin' ? `${description} (built-in)` : description] as const;
	}

	override sections(data: HelpData) {
		return [`${data.program.name} v${data.program.version}`, ...super.sections(data)];
	}
}

jinju({ version: '1.0.0', help: new MyHelp({ sortFlags: false }), commands });
```

| Method                                                       | Default                                                                                                              |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| `render(data)`                                               | Joins `sections(data)` with blank lines and adds a trailing newline. Override it to replace the layout entirely      |
| `sections(data)`                                             | `[description, usage, commands, args, flags]`, with empty sections left out                                          |
| `formatUsage`, `formatCommands`, `formatArgs`, `formatFlags` | Each renders one section from `data`                                                                                 |
| `commands(data)`, `flags(data)`                              | Choose what to list: hidden entries are left out unless `showHidden`, and flags are sorted unless `sortFlags: false` |
| `formatCommand`, `formatArg`, `formatFlag`                   | One `[left, right]` table row each                                                                                   |
| `formatTags`, `formatValue`, `formatPath`                    | ` (required; default: 3)`, default values, `<project> deploy`                                                        |
| `formatTable(rows)`, `formatSection(title, lines)`           | Layout primitives                                                                                                    |

`HelpData` holds the building blocks of a page; the template decides what to use and how. It makes no layout decisions: nothing is filtered or sorted.

| Field                                | Contents                                                                                                                                                                                           |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `program`                            | `name`, `version`, `description`                                                                                                                                                                   |
| `path`                               | The command path as `{ name, dynamic }` parts. `formatPath(path)` gives `<project> deploy`                                                                                                         |
| `description`, `aliases`, `runnable` | This level's description, its command's aliases, and whether it has a command to run                                                                                                               |
| `usage`                              | Usage lines, e.g. `app <project> deploy [flags] [<env>]`                                                                                                                                           |
| `commands`                           | Each subcommand: `name`, `label`, `description`, `aliases`, `hidden`, `dynamic`, full `path`, `runnable`, `group` (has subcommands)                                                                |
| `args`                               | Each arg in order: `name`, `label` (`<env>`), `usage` (`[<env>]`), `source` (`command` or `scope`), `segment`                                                                                      |
| `flags`                              | Each flag in definition order, hidden ones included: `key`, `name`, `alias`, `kind` (`flag` or `switch`), `source` (`command`, `scope` or `builtin`), `hidden`, `label` (`-n, --dry-run <string>`) |

Args and flags also carry `description`, `type`, `required`, `multiple`, `hasDefault`, the raw `default`, `choices`, and `options`. `options` is everything passed to the creator, including `min`, `max`, `integer`, `exists` and the options of custom parsers. The text is printed as-is, so include a trailing newline.

### Errors

Error output (printed to stderr, with exit code `1`) is rendered by an `ErrorTemplate`, customised the same way as help: pass an instance as `error`, with options or a subclass.

```ts
import { ErrorTemplate, type JinjuError, MissingRequiredError } from 'jinju';

class MyErrors extends ErrorTemplate {
	override formatError(error: JinjuError) {
		return error instanceof MissingRequiredError
			? `✗ please provide ${error.label}`
			: super.formatError(error);
	}
}

jinju({ error: new MyErrors({ hint: false }), commands });
```

`ErrorData` has the `program`, the `errors` (each a `JinjuError` subclass such as `MissingRequiredError`, `UnknownFlagError` or `InvalidValueError`, with its own details), the matched `path`, the `words` as typed, and the matched level's full `help` data, for showing usage or suggesting names.

| Method                                     | Default                                                             |
| ------------------------------------------ | ------------------------------------------------------------------- |
| `render(data)`                             | Joins `sections(data)` with blank lines and adds a trailing newline |
| `sections(data)`                           | `[errors, hint]`; the hint is left out with `hint: false`           |
| `formatErrors(data)`, `formatError(error)` | One `error: <message>` line per error                               |
| `formatHint(data)`, `formatCommand(data)`  | `Run 'app my-site deploy --help' for usage.`                        |

---

<small>© 2026 [Mike Simmonds](https://mike.id)</small>
