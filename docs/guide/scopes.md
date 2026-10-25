---
description: Share flags and args across several commands with scope(), with their types flowing through to each command.
---

# Scopes

A scope groups the flags and args that several commands share. Commands created from a scope inherit them, and their types flow through to each command's `run`.

```ts twoslash
import { arg, flag, scope } from 'jinju';

const app = scope({
	flags: { verbose: flag.count({ alias: 'v', description: 'Increase verbosity' }) },
});

const project = app.scope({
	args: [arg.string({ name: 'project', description: 'Project' }).required()],
});

const deploy = project.command({
	description: 'Deploy',
	args: [arg.string({ name: 'env', description: 'Environment' })],
	run: ({ args: [project, env], flags: { verbose } }) => {},
	//             ^?
	//                      ^?
	//                                     ^?
});
// app -v deploy my-site staging
```

## API

- `scope({ flags?, args?, strict? })` creates a scope. `strict` sets whether its commands reject unknown flags, unless they set their own (see [Passing on unknown flags](./commands#passing-on-unknown-flags)).
- `scope.command(config)` creates a command that inherits the scope's flags and args. It takes the same config as [`command()`](./commands#config).
- `scope.scope(config)` creates a nested scope that adds more flags and args.

`command()` is the same as a command from an empty scope.

## Flags

A scope's flags merge with each command's own. If a command defines a flag with the same key, its own definition replaces the inherited one:

```ts twoslash
import { flag, scope } from 'jinju';

const app = scope({ flags: { output: flag.string({ description: 'Output file' }) } });

app.command({
	description: 'Export',
	flags: { output: flag.string({ description: 'Output file' }).default('out.json') },
	run: ({ flags: { output } }) => {},
	//               ^?
});
```

Inherited flags are also accepted **before the command name**: `app -v deploy …` works when `deploy` inherits `verbose`. If the command that matches doesn't declare a flag given before its name, that's an "Unknown flag" error.

A flag name that takes a value in one scope but is a switch in another must come after the command name, because Jinju can't know whether it takes the next word.

## Args

Scope args come first: `run` receives `[...scopeArgs, ...commandArgs]`, read after the command name. The [one `.multiple()` rule](./args#variadic-args) applies across the whole tuple, including inherited args.

Scope args are also how [dynamic segments](./dynamic-segments) work: a segment's value fills the scope's arg of the same name.

## Help

Help lists every flag a command accepts (its own, inherited and built-in) in one table. Custom [help templates](./help) can tell them apart with `HelpFlag.source`, which is `'command'`, `'scope'` or `'builtin'`.
