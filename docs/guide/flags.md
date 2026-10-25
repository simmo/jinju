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

| Creator                      | Type              | Options                                | Notes                                                         |
| ---------------------------- | ----------------- | -------------------------------------- | ------------------------------------------------------------- |
| `flag.string(options)`       | `string`          | `choices?`                             | With `choices`, the type is the union of them                 |
| `flag.number(options)`       | `number`          | `min?`, `max?`, `integer?`, `choices?` | Rejects non-numbers, and values outside the bounds or choices |
| `flag.url(options)`          | `URL`             |                                        | Parsed with `new URL()`                                       |
| `flag.email(options)`        | `string`          |                                        | Checks the value looks like an email address                  |
| `flag.directory(options)`    | `string`          | `exists?`                              | Resolved to an absolute path                                  |
| `flag.file(options)`         | `string`          | `exists?`                              | Resolved to an absolute path                                  |
| `flag.date(options)`         | `Date`            |                                        | An ISO 8601 date, or date and time                            |
| `flag.json(options)`         | `JsonValue`       |                                        | Parsed with `JSON.parse`                                      |
| `flag.entry(options)`        | `[key, value]`    |                                        | `key=value`, split at the first `=`                           |
| `flag.custom(parse, name?)`  | Your parser's     | Your parser's options                  | See [custom parsers](#custom-parsers)                         |
| `flag.schema(schema, name?)` | The schema output |                                        | See [Standard Schema](./schemas)                              |

`choices` narrows the type:

```ts twoslash
import { flag, type InferFlagType } from 'jinju';

const mode = flag.string({ description: 'Mode', choices: ['fast', 'safe'] });
type Mode = InferFlagType<typeof mode>;
//   ^?
```

`flag.number` takes `choices` too: `choices: [1, 2, 4]` gives the type `1 | 2 | 4`.

With `exists: true`, `flag.directory` and `flag.file` also check that the path exists and is the right kind of entry.

### Dates, JSON and key-value pairs

`flag.date` reads an ISO 8601 date (`2026-10-25`) or date and time (`2026-10-25T14:30`, optionally with seconds and a `Z` or `+01:00` offset) into a `Date`. As with `new Date()`, a date alone is midnight UTC, and a time without an offset is local time. Dates that don't exist, such as `2026-02-30`, are rejected.

`flag.json` parses its value with `JSON.parse`, so its type is [`JsonValue`](../api/types#jsonvalue), which covers any JSON. To check the value's shape and get a narrower type, use a [schema](./schemas) that parses JSON instead.

`flag.entry` reads `key=value` into a `[key, value]` pair, split at the first `=`, so the value can contain `=` and can be empty. With `.multiple()` and a one-letter alias, it gives the familiar `-D` style, and `Object.fromEntries` turns the pairs into an object:

```ts twoslash
import { command, flag } from 'jinju';

command({
	description: 'Build',
	flags: { define: flag.entry({ alias: 'D', description: 'Define a variable' }).multiple() },
	run: ({ flags }) => {
		const defines = Object.fromEntries(flags.define ?? []);
		//    ^?
	},
});
// -D mode=fast -Dlevel=2 → { mode: 'fast', level: '2' }
```

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

| Modifier                   | Effect                                                                                         |
| -------------------------- | ---------------------------------------------------------------------------------------------- |
| `.required(on = true)`     | Must be provided. Clears any default.                                                          |
| `.multiple(on = true)`     | Repeatable, collected into an array.                                                           |
| `.multiple({ separator })` | Like `.multiple()`, and each value is also split on `separator`: `--tag a,b`.                  |
| `.default(...values)`      | Used when absent: `.default('x')`, or `.default('a', 'b')` when `multiple`. Clears `required`. |

Switches only have `.default(value)`.

Each argument to `.default()` is one value, so an array is one value of an array type: `flag.entry(o).multiple().default(['a', '1'], ['b', '2'])` is two entries. Modifiers work in any order. A flag keeps all its default values, and a single flag uses the first: `.default('a', 'b').multiple()` and `.multiple().default('a', 'b')` both give `['a', 'b']`.

`.multiple(on)` with a `boolean` variable gives `V | V[]`, since the type can't know which, and `.required()` and `.default()` keep both.

The modifiers decide the type `run` receives:

| Definition                              | Type                      |
| --------------------------------------- | ------------------------- |
| `flag.url(o)`                           | `URL \| undefined`        |
| `flag.url(o).multiple()`                | `URL[] \| undefined`      |
| `flag.url(o).default(url)`              | `URL`                     |
| `flag.url(o).multiple().default(a, b)`  | `URL[]`                   |
| `flag.url(o).required().multiple()`     | `URL[]`                   |
| `flag.string({choices: ['a', 'b'], …})` | `'a' \| 'b' \| undefined` |

```ts twoslash
import { command, flag } from 'jinju';

const tag = flag.string({ alias: 't', description: 'Tag to apply' });

command({
	description: 'Publish',
	flags: {
		tag: tag.multiple().default('latest'),
		registry: flag.url({ description: 'Registry' }).required(),
	},
	run: ({ flags }) => {},
	//      ^?
});
```

A `.multiple()` flag is repeated on the command line (`-t a -t b`). Giving a flag that isn't `.multiple()` more than once is an error.

With a separator, each value is also split: with `tag.multiple({ separator: ',' })`, `-t a,b -t c` gives `['a', 'b', 'c']`. Values are trimmed and empty ones dropped, and a value with nothing left, such as `-t ,`, is an error. The split happens before each value is parsed, so pick a separator that can't appear inside a value: `,` would break up `flag.json` or `flag.entry` values that contain commas. Help shows the flag as `(multiple, separated by ',')`. The separator also splits a value read from an [environment variable](./environment-variables), such as `TAGS=a,b`. The type is the same as with `.multiple()`.

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

Unknown flags are errors unless the command, its scope or the program sets `strict: false`, which passes them to `run` instead (see [Passing on unknown flags](./commands#passing-on-unknown-flags)). See [Errors](./errors) to change how errors look.
