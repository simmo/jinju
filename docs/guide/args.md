---
description: 'Positional values such as src and dest in cp src dest: the args tuple, optional and required args, variadic .multiple() args and how values are allocated.'
---

# Args

Args are positional values: the `src` and `dest` in `cp src dest`. A command's `args` is a tuple, and `run` receives a typed tuple in the same order.

```ts twoslash
import { arg, command } from 'jinju';

command({
	description: 'Rename a file',
	args: [
		arg.file({ name: 'from', description: 'File to rename', exists: true }).required(),
		arg.string({ name: 'to', description: 'New name' }).required(),
	],
	run: ({ args: [from, to] }) => {},
	//             ^?
	//                   ^?
});
```

## Creators

Args use the same creators and parsers as [flags](./flags#value-flags): `arg.string`, `arg.number`, `arg.url`, `arg.email`, `arg.directory`, `arg.file`, `arg.custom` and `arg.schema`. There are no switches.

Every arg takes these options:

| Option        | Description                                                                                                                                                              |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `description` | Shown in help. Required.                                                                                                                                                 |
| `name`        | The name shown in usage and help, e.g. `'files'` → `<files>`. Defaults to the value type (`<string>`). It also binds the arg to a [dynamic segment](./dynamic-segments). |

## Modifiers

Args are optional by default. They have the same modifiers as flags, with the same effect on their types:

| Definition                          | Type                    |
| ----------------------------------- | ----------------------- |
| `arg.string(o)`                     | `string \| undefined`   |
| `arg.string(o).required()`          | `string`                |
| `arg.string(o).default('x')`        | `string`                |
| `arg.file(o).multiple()`            | `string[] \| undefined` |
| `arg.file(o).multiple().required()` | `string[]`              |

## Variadic args

At most one arg can be `.multiple()`, in any position. It takes every value the other args don't:

- args before it fill from the left
- args after it fill from the right
- the `.multiple()` arg takes the middle

So `[sources.multiple().required(), dest.required()]` behaves like `cp`:

```ts twoslash
import { arg, command } from 'jinju';

const copy = command({
	description: 'Copy files into a directory',
	args: [
		arg.file({ name: 'source', description: 'Files to copy' }).multiple().required(),
		arg.directory({ name: 'dest', description: 'Destination' }).required(),
	],
	run: ({ args: [sources, dest] }) => {},
	//             ^?
	//                      ^?
});
// app a.txt b.txt out/  →  sources: ['…/a.txt', '…/b.txt'], dest: '…/out'
```

When there are too few values, required args are filled first, then optional args from left to right. Values left over when there's no `.multiple()` arg are "Unexpected argument" errors.

Declaring two `.multiple()` args is a type error, and throws a `ConfigError` at runtime:

```ts twoslash
// @errors: 2322
import { arg, command } from 'jinju';

command({
	description: 'Broken',
	args: [arg.string({ description: 'a' }).multiple(), arg.string({ description: 'b' }).multiple()],
	run: () => {},
});
```

## Help

Usage lines show optional args in brackets and `.multiple()` args with `...`:

```sh
Usage:
  app copy [flags] <source>... <dest>
```
