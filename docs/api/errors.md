---
description: API reference for ErrorTemplate, JinjuError and every error class Jinju throws.
---

# Errors

See the [Errors guide](../guide/errors) for usage.

## `ErrorTemplate`

```ts
class ErrorTemplate {
	readonly options: Readonly<Required<ErrorTemplateOptions>>;
	constructor(options?: ErrorTemplateOptions);

	render(data: ErrorData): string;
	sections(data: ErrorData): string[];
	formatErrors(data: ErrorData): string;
	formatError(error: JinjuError): string;
	formatHint(data: ErrorData): string;
	formatCommand(data: ErrorData): string;
}
```

Renders error output, which is printed to stderr, from [`ErrorData`](#errordata). Extend it and override any method to change part of it, or `render` to replace it.

| Method          | Default                                                       |
| --------------- | ------------------------------------------------------------- |
| `render`        | Joins `sections` with blank lines and adds a trailing newline |
| `sections`      | `[errors, hint]`. The hint is left out with `hint: false`     |
| `formatErrors`  | One line per error, from `formatError`                        |
| `formatError`   | `error: <message>`                                            |
| `formatHint`    | `Run 'app my-site deploy --help' for usage.`                  |
| `formatCommand` | The command as typed, e.g. `app my-site deploy`               |

## `ErrorTemplateOptions`

```ts
interface ErrorTemplateOptions {
	hint?: boolean;
}
```

`hint` adds a "Run '… --help' for usage." line. Defaults to `true`.

## `ErrorData`

```ts
interface ErrorData {
	program: HelpProgram;
	errors: readonly JinjuError[];
	path: readonly HelpPathPart[];
	words: readonly string[];
	help: HelpData;
}
```

| Field     | Description                                                            |
| --------- | ---------------------------------------------------------------------- |
| `program` | The program's name, version and description.                           |
| `errors`  | The errors, in the order found.                                        |
| `path`    | The matched command path, e.g. `<project> deploy`. Empty at the root.  |
| `words`   | The command path as typed, e.g. `['my-site', 'deploy']`.               |
| `help`    | The matched level's [`HelpData`](./help#helpdata), e.g. to show usage. |

## `JinjuError`

```ts
class JinjuError extends Error {}
```

The base class for every error Jinju produces. Throw it (or a subclass) from `run` to report a problem with exit code `1`.

## `ConfigError`

```ts
class ConfigError extends JinjuError {}
```

Thrown synchronously when flags, args or commands are defined in a conflicting way, such as two flags with the same alias, or an invalid command tree.

## `UnknownCommandError`

```ts
class UnknownCommandError extends JinjuError {
	readonly command: string;
}
```

`Unknown command '<command>'`.

## `UnknownFlagError`

```ts
class UnknownFlagError extends JinjuError {
	readonly flag: string;
}
```

`Unknown flag '<flag>'`. Only reported in strict mode, which is the default.

## `UnexpectedArgError`

```ts
class UnexpectedArgError extends JinjuError {
	readonly arg: string;
}
```

`Unexpected argument '<arg>'`: a positional value with no arg to take it.

## `MissingRequiredError`

```ts
class MissingRequiredError extends JinjuError {
	readonly label: string;
}
```

`Missing required <label>`, where `label` is e.g. `--token` or `argument <name>`.

## `MissingValueError`

```ts
class MissingValueError extends JinjuError {
	readonly label: string;
}
```

`<label> requires a value`: a value flag with nothing after it.

## `DuplicateFlagError`

```ts
class DuplicateFlagError extends JinjuError {
	readonly label: string;
}
```

`<label> can only be provided once`: a flag that isn't `.multiple()` given more than once.

## `InvalidValueError`

```ts
class InvalidValueError extends JinjuError {
	readonly label: string;
	readonly input: string;
	readonly reason: string;
}
```

`Invalid value '<input>' for <label>: <reason>`. `reason` is the parser's error message. For values read from an environment variable, `label` names it, e.g. `--port (from $PORT)`.
