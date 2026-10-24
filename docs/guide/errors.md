# Errors

When input is invalid, Jinju collects every problem, prints them to stderr with a usage hint, and exits with code `1`. `run` isn't called.

```sh
$ app my-site deploy prod --port 1
error: Unknown flag '--port'
error: Unexpected argument '1'

Run 'app my-site deploy --help' for usage.
```

## Error classes

Every error is a subclass of `JinjuError`, with its own details:

| Class                  | Message                                 | Properties                 |
| ---------------------- | --------------------------------------- | -------------------------- |
| `UnknownCommandError`  | `Unknown command 'x'`                   | `command`                  |
| `UnknownFlagError`     | `Unknown flag '--x'`                    | `flag`                     |
| `UnexpectedArgError`   | `Unexpected argument 'x'`               | `arg`                      |
| `MissingRequiredError` | `Missing required --x` / `argument <x>` | `label`                    |
| `MissingValueError`    | `--x requires a value`                  | `label`                    |
| `DuplicateFlagError`   | `--x can only be provided once`         | `label`                    |
| `InvalidValueError`    | `Invalid value 'v' for --x: <reason>`   | `label`, `input`, `reason` |
| `ConfigError`          | Describes a mistake in your definitions |                            |

`ConfigError` is different from the rest: it's thrown synchronously, when you create commands, scopes or the program, for mistakes such as two flags with the same alias. It means the CLI itself is wrong, not the user's input.

## Throwing from `run`

Throw a `JinjuError` from `run` to report a problem the same way as input errors, with exit code `1`:

```ts twoslash
import { arg, command, JinjuError } from 'jinju';

command({
	description: 'Open a project',
	args: [arg.string({ name: 'project', description: 'Project' }).required()],
	run: ({ args: [project] }) => {
		if (project === 'secret') throw new JinjuError(`No access to '${project}'`);
	},
});
```

Other errors aren't caught: they reject the promise returned by `app.run()`.

## Customising output

Error output is rendered by an `ErrorTemplate`, customised the same way as [help](./help): pass an instance as `error`, with options or a subclass.

```ts twoslash
import {
	type CommandTree,
	ErrorTemplate,
	jinju,
	type JinjuError,
	MissingRequiredError,
} from 'jinju';
declare const commands: CommandTree;
// ---cut---
class MyErrors extends ErrorTemplate {
	override formatError(error: JinjuError) {
		return error instanceof MissingRequiredError
			? `✗ please provide ${error.label}`
			: super.formatError(error);
	}
}

jinju({ error: new MyErrors({ hint: false }), commands });
```

| Option | Default | Description                             |
| ------ | ------- | --------------------------------------- |
| `hint` | `true`  | Add a `Run '… --help' for usage.` line. |

| Method                                     | Default                                                             |
| ------------------------------------------ | ------------------------------------------------------------------- |
| `render(data)`                             | Joins `sections(data)` with blank lines and adds a trailing newline |
| `sections(data)`                           | `[errors, hint]`; the hint is left out with `hint: false`           |
| `formatErrors(data)`, `formatError(error)` | One `error: <message>` line per error                               |
| `formatHint(data)`, `formatCommand(data)`  | `Run 'app my-site deploy --help' for usage.`                        |

## Error data

`ErrorData` has:

- `program`: the program's `name`, `version` and `description`
- `errors`: the `JinjuError` instances, in the order they were found
- `path`: the matched command path
- `words`: the command path as typed, e.g. `['my-site', 'deploy']`
- `help`: the matched level's full [help data](./help#help-data), for showing usage or suggesting names
