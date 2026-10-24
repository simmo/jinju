# Standard Schema

Any [Standard Schema](https://standardschema.dev) can be used as a parser: zod, valibot, arktype and others. `flag.schema(schema, name?)` and `arg.schema(schema, name?)` return a creator, like [`custom`](./flags#custom-parsers):

```ts twoslash
import { command, flag } from 'jinju';
import { z } from 'zod';

const port = flag.schema(z.coerce.number().int().min(1), 'port');
const tags = flag.schema(z.enum(['alpha', 'beta']));

command({
	description: 'Serve',
	flags: {
		port: port({ description: 'Port' }).default(80),
		tag: tags({ description: 'Tag' }).multiple(),
	},
	run: ({ flags }) => {},
	//      ^?
});
```

The optional second argument names the value in help: `--port <port>`. It defaults to `value`.

## Types

The value's type comes from the schema's output, and the modifiers apply as usual.

## Values arrive as strings

Command-line values and environment variables are always strings, so schemas for other types must coerce, e.g. `z.coerce.number()` or `z.stringbool()`.

A schema whose input can't be a string, such as `z.number()`, `z.boolean()` or `z.date()`, is a type error:

```ts twoslash
// @errors: 2345
import { flag } from 'jinju';
import { z } from 'zod';

flag.schema(z.number());
```

Coercing schemas (input `unknown`), enums and string schemas are accepted, whether written inline or declared beforehand.

## No `undefined` outputs

`undefined` already means "not provided", so a schema that can output `undefined` (such as `.optional()`) is a type error. Use `.default()` on the flag or arg instead.

## Errors

Validation errors use the schema's issue messages, joined with `; `:

```sh
error: Invalid value '0' for --port: Too small: expected number to be >=1
```

## No dependency

Jinju doesn't depend on any schema library or on `@standard-schema/spec`. It ships a compatible `StandardSchemaV1` type, so any schema that follows the spec works.
