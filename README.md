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

### Program

`jinju({name?, version?, description?, commands, strict?, stdout?, stderr?, exit?})`

- Nest objects for subcommands. `$` is the command for that level. Keys starting with `:` are reserved for dynamic segments, a planned feature.
- Routing takes the longest matching command path. A flag not inherited by any command below that point, or `--`, ends the path.
- Help lists every flag a command accepts (its own, inherited and built-in) in one table, sorted by name.
- `--help`/`-h` and `--version` are built in.
- Errors are collected and printed with a usage hint. Exit code `1`.
- `run()` resolves to the exit code and sets `process.exitCode`. Override this with `exit`.

---

<small>© 2026 [Mike Simmonds](https://mike.id)</small>
