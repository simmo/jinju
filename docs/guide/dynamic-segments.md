---
description: 'Read a value before the command name, like a route parameter: app my-site deploy, with :name keys in the command tree.'
---

# Dynamic segments

A `:name` key in the command tree reads a value **before** the command name, like a route parameter. `app my-site deploy` can run `deploy` for the project `my-site`.

The value goes into the commands' arg called `name`, which comes from a [scope](./scopes):

```ts twoslash
import { arg, command, jinju, scope } from 'jinju';

const list = command({ description: 'List projects', run: () => {} });

const project = scope({
	args: [arg.string({ name: 'project', description: 'Project' }).required()],
});

const deploy = project.command({
	description: 'Deploy',
	args: [arg.string({ name: 'env', description: 'Environment' })],
	run: ({ args: [project, env] }) => {},
	//             ^?
	//                      ^?
});

jinju({ commands: { list, ':project': { deploy } } });
// app my-site deploy staging
```

## How it works

- Segment values are ordinary args. They're parsed and validated by the arg, and come first in `args`.
- Static names win over a segment: `app list` runs `list`, not a project named `list`.
- Segments nest: `{ ':project': { ':env': { logs } } }` fills the leading args in order, so `logs` must start with `project` and then `env` args.
- Help shows segments in the path, e.g. `app <project> deploy [<env>]`. The root help lists the segment with its arg's description.
- Error hints use the values that were typed: `Run 'app my-site deploy --help' for usage.`

## Rules

- A level can have one segment.
- The segment's arg can't be `.multiple()`.
- Each command under a segment must have the matching named arg at the right position.
- A level's `$` command can't take positional args of its own next to a segment, because a word there could be either.

## Compile-time checks

Mistakes in the tree are type errors on `commands`, worded like the `ConfigError` that `jinju()` throws for them at runtime:

```ts twoslash
// @errors: 2322
import { arg, command, jinju } from 'jinju';

const deploy = command({
	description: 'Deploy',
	args: [arg.string({ name: 'env', description: 'Environment' })],
	run: () => {},
});

jinju({ commands: { ':project': { deploy } } });
```

The checks cover:

- `$` not being a command: `'$' must be a command (at 'sync')`
- a level with more than one segment
- a level's `$` command taking its own positional args alongside a segment
- a command under a segment without the matching named arg in the right position, e.g. `Command '<project> deploy' must have an arg named 'project' at position 1 for segment ':project'`
- a segment's arg being `.multiple()`

The arg checks need literal names, as in the examples. Args named with a plain `string` variable are only checked at runtime.
