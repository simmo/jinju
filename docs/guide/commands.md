# Commands

A command bundles flags, args and a `run` handler. Commands don't have names of their own: a command is named by its key when you add it to the [program](./program)'s command tree.

```ts twoslash
import { arg, command, flag } from 'jinju';

const deploy = command({
	description: 'Deploy the app',
	aliases: ['ship'],
	args: [arg.string({ name: 'env', description: 'Environment', choices: ['staging', 'prod'] })],
	flags: { force: flag.boolean({ alias: 'f', description: 'Skip checks' }) },
	run: async ({ args: [env], flags, argv }) => {
		//                   ^?
		if (env === 'prod' && !flags.force) return 2; // exit code
	},
});
```

## Config

`command({ name?, description, aliases?, hidden?, flags?, args?, run })`

| Option        | Description                                                     |
| ------------- | --------------------------------------------------------------- |
| `description` | Shown in help. Required.                                        |
| `name`        | Overrides the name taken from the command's key. A single word. |
| `aliases`     | Other names that route to this command.                         |
| `hidden`      | Leave the command out of help listings. It can still be run.    |
| `flags`       | An object of [flags](./flags). Keys become kebab-case names.    |
| `args`        | A tuple of [args](./args).                                      |
| `run`         | The handler. Receives `{ flags, args, argv }`.                  |

## The `run` handler

`run` receives a context with:

- `flags`: an object of parsed flag values, typed from the definitions
- `args`: a tuple of parsed arg values, in order
- `argv`: the raw argv the command parsed, with the command path removed

`run` may be async. Its return value sets the exit code:

- returning nothing (or resolving to nothing) exits with `0`
- returning a number exits with that number
- throwing a [`JinjuError`](./errors#throwing-from-run) reports it like an input error, with exit code `1`
- any other error is rethrown from `app.run()`

`run` is only called when all input is valid. All parsing and validation errors are collected first and reported together.

## Names

A command's name comes from its key in the tree, converted from camelCase to kebab-case: `{ dryRun }` routes `app dry-run`. Set `name` to choose a different one, and `aliases` to accept more:

```ts twoslash
import { command, jinju } from 'jinju';
// ---cut---
const remove = command({ name: 'rm', aliases: ['del'], description: 'Remove', run: () => {} });

jinju({ commands: { remove } }); // app rm, app del
```

Two commands with the same name or alias at the same level are a `ConfigError`. Commands can't define `help` or `version` flags, which are built in.

## Sharing flags and args

To give several commands the same flags or leading args, create them from a [scope](./scopes). `command()` is the same as creating a command from an empty scope.
