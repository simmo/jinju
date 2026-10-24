---
description: 'Named options such as --port 8080: value types, switches, modifiers (.required(), .multiple(), .default()), aliases and custom parsers.'
---

# Flags

Flags are named options: `--port 8080`, `-v`, `--dry-run`. You create them with the `flag.*` creators and add them to a command (or [scope](./scopes)) under `flags`. The object key becomes the flag's name, converted from camelCase to kebab-case.

```ts twoslash
import { command, flag } from 'jinju';

command({
	description: 'Serve files',
	flags: {
		port: flag.number({ alias: 'p', description: 'Port to listen on', integer: true }),
		dryRun: flag.boolean({ description: "Don't write anything" }), // --dry-run
	},
	run: ({ flags }) => {},
	//      ^?
});
```

## Value flags

These take a value, written as `--name value`, `--name=value`, `-n value` or `-nvalue`:

| Creator                      | Type              | Options                    | Notes                                              |
| ---------------------------- | ----------------- | -------------------------- | -------------------------------------------------- |
| `flag.string(options)`       | `string`          | `choices?`                 | With `choices`, the type is the union of them      |
| `flag.number(options)`       | `number`          | `min?`, `max?`, `integer?` | Rejects non-numbers, and values outside the bounds |
| `flag.url(options)`          | `URL`             |                            | Parsed with `new URL()`                            |
| `flag.email(options)`        | `string`          |                            | Checks the value looks like an email address       |
| `flag.directory(options)`    | `string`          | `exists?`                  | Resolved to an absolute path                       |
| `flag.file(options)`         | `string`          | `exists?`                  | Resolved to an absolute path                       |
| `flag.custom(parse, name?)`  | Your parser's     | Your parser's options      | See [custom parsers](#custom-parsers)              |
| `flag.schema(schema, name?)` | The schema output |                            | See [Standard Schema](./schemas)                   |

`choices` narrows the type:

```ts twoslash
import { flag, type InferFlagType } from 'jinju';

const mode = flag.string({ description: 'Mode', choices: ['fast', 'safe'] });
type Mode = InferFlagType<typeof mode>;
//   ^?
```

With `exists: true`, `flag.directory` and `flag.file` also check that the path exists and is the right kind of entry.

## Switches

`flag.boolean` and `flag.count` are switches. They never take the next argument as a value.

| Creator                 | Default | Behaviour                                                           |
| ----------------------- | ------- | ------------------------------------------------------------------- |
| `flag.boolean(options)` | `false` | `--x` → `true`, `--no-x` → `false`. The last occurrence wins.       |
| `flag.count(options)`   | `0`     | Counts occurrences: `-vvv` → `3`. `--no-x` resets the count to `0`. |

A switch can also be set explicitly with `--x=<value>`, using `true`/`false`, `1`/`0`, `yes`/`no` or `on`/`off`. `--no-x=<value>` inverts the value. The built-in `--help` and `--version` follow the same rules, so `--help=false` doesn't show help.

A switch always has a value, so its type is never `undefined`. To default a boolean to `true`, use `.default(true)`. Help then shows it as `--[no-]name`.

## Shared options

Every flag creator takes these options:

| Option        | Description                                                                                                      |
| ------------- | ---------------------------------------------------------------------------------------------------------------- |
| `description` | Shown in help. Required.                                                                                         |
| `alias`       | Another name, without dashes. One character gives `-x`, longer names give `--xyz`.                               |
| `hidden`      | Leave the flag out of help. It's still accepted.                                                                 |
| `env`         | An environment variable to read when the flag isn't given. See [Environment variables](./environment-variables). |

## Modifiers

Flags are immutable: each modifier returns a new flag, so one definition can be reused with different settings.

| Modifier               | Effect                                                                            |
| ---------------------- | --------------------------------------------------------------------------------- |
| `.required(on = true)` | Must be provided. Clears any default.                                             |
| `.multiple(on = true)` | Repeatable, collected into an array. Converts any existing default (`v` ↔ `[v]`). |
| `.default(value)`      | Used when absent. Clears `required`. Must be a non-empty array when `multiple`.   |

Switches only have `.default(value)`.

The modifiers decide the type `run` receives:

| Definition                              | Type                      |
| --------------------------------------- | ------------------------- |
| `flag.url(o)`                           | `URL \| undefined`        |
| `flag.url(o).multiple()`                | `URL[] \| undefined`      |
| `flag.url(o).default(url)`              | `URL`                     |
| `flag.url(o).required().multiple()`     | `URL[]`                   |
| `flag.string({choices: ['a', 'b'], …})` | `'a' \| 'b' \| undefined` |

```ts twoslash
import { command, flag } from 'jinju';

const tag = flag.string({ alias: 't', description: 'Tag to apply' });

command({
	description: 'Publish',
	flags: {
		tag: tag.multiple().default(['latest']),
		registry: flag.url({ description: 'Registry' }).required(),
	},
	run: ({ flags }) => {},
	//      ^?
});
```

A `.multiple()` flag is repeated on the command line (`-t a -t b`). Giving a flag that isn't `.multiple()` more than once is an error.

## Custom parsers

`flag.custom(parse, name?)` turns a parser into a flag creator. The parser receives the raw string and the options passed to the creator, and returns the value. Throw to reject the input: the error message is shown to the user. Parsers may be async.

```ts twoslash
import { command, flag } from 'jinju';

const duration = flag.custom((input: string, { max }: { max?: number }) => {
	const match = /^(\d+)(ms|s|m)$/.exec(input);
	if (!match) throw new Error('must be a duration like 500ms, 10s or 5m');
	const ms = Number(match[1]) * { ms: 1, s: 1000, m: 60_000 }[match[2] as 'ms' | 's' | 'm'];
	if (max !== undefined && ms > max) throw new Error(`must be at most ${max}ms`);
	return ms;
}, 'duration');

command({
	description: 'Wait',
	flags: { timeout: duration({ description: 'Timeout', max: 60_000 }).default(5000) },
	run: ({ flags }) => {},
	//      ^?
});
```

The second argument names the value in help: `--timeout <duration>`. `arg.custom` accepts the same parsers.

## Command-line syntax

- `--name value`, `--name=value`, `-n value`, `-nvalue` and `-n=value` all set a value.
- Short switches can be bundled: `-abc` is `-a -b -c`, and `-vvv` counts three times. A bundle can end with a value flag: `-vp 8080`.
- Negative numbers are values, not flags: `--offset -5`.
- `--` ends flag parsing. Everything after it is a positional value, even if it starts with `-`.
- A value flag at the end of the input, or followed by another flag, is a "requires a value" error.

## Errors

Invalid input is reported with the flag's label and the parser's message, and every problem is reported at once:

```sh
$ app sync . --mode slow --times 0.5
error: Invalid value 'slow' for --mode: must be one of fast, safe
error: Invalid value '0.5' for --times: must be an integer

Run 'app sync --help' for usage.
```

Unknown flags are errors unless the program sets `strict: false`, which passes them to `run` instead (see [Passing on unknown flags](./commands#passing-on-unknown-flags)). See [Errors](./errors) to change how errors look.
