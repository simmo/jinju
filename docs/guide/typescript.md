---
description: 'The types for naming what Jinju infers: InferFlagType, InferFlags, InferArgs and more.'
---

# TypeScript

Everything in Jinju is typed from your definitions: there are no separate interfaces to keep in sync. This page covers the types you can use to name those types yourself.

## Inferring values

```ts twoslash
import { arg, flag, type InferArgs, type InferFlags, type InferFlagType } from 'jinju';

const port = flag.number({ description: 'Port' }).default(8080);
type Port = InferFlagType<typeof port>;
//   ^?

const flags = {
	port,
	host: flag.string({ description: 'Host' }),
};
type Flags = InferFlags<typeof flags>;
//   ^?

const args = [arg.file({ description: 'Files' }).multiple().required()] as const;
type Args = InferArgs<typeof args>;
//   ^?
```

| Type               | Gives                                                                               |
| ------------------ | ----------------------------------------------------------------------------------- |
| `InferFlagType<F>` | The value a flag resolves to                                                        |
| `InferArgType<A>`  | The value an arg resolves to                                                        |
| `InferFlags<F>`    | An object of flag values, as `run` receives it                                      |
| `InferArgs<A>`     | A tuple of arg values, as `run` receives it                                         |
| `MergeFlags<A, B>` | `A` with `B`'s keys added or replaced, which is how scope and command flags combine |

## Sharing handlers

`RunContext<Flags, Args>` is the type of `run`'s context, so a handler can be written separately from its command:

```ts twoslash
import { command, flag, type RunContext } from 'jinju';

const cleanFlags = { force: flag.boolean({ description: 'Force' }) };

const clean = ({ flags }: RunContext<typeof cleanFlags, []>) => {
	if (flags.force) console.log('forcing');
};

command({ description: 'Clean', flags: cleanFlags, run: clean });
```

To call such a handler yourself, e.g. in a unit test, pass the whole context: `clean({ flags: { force: true }, args: [], argv: [], unknown: [], signal: new AbortController().signal })`.

## Compile-time checks

Some mistakes are reported as type errors as well as at runtime:

- more than one `.multiple()` arg (`CheckArgs`)
- [dynamic segment](./dynamic-segments#compile-time-checks) problems in the command tree (`CheckTree`)
- Standard Schemas whose input can't be a string (`CheckSchemaInput`)

These types resolve to an object with an `~error` key that describes the problem, so the message appears in the type error.

## Readable types

Types are written to show resolved values in editors, e.g. `string[] | undefined` rather than an alias such as `Flag<…>`. Every type used in a public signature is exported, so you can name anything you see. See the [Types API](../api/types) for the full list.
