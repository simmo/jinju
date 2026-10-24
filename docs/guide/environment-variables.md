---
description: Let any flag fall back to an environment variable with the env option, and supply variables yourself in tests.
---

# Environment variables

Any flag can fall back to an environment variable. Set `env` to the variable's name:

```ts twoslash
import { command, flag } from 'jinju';

command({
	description: 'Deploy',
	flags: {
		token: flag.string({ description: 'API token', env: 'API_TOKEN' }).required(),
		port: flag.number({ description: 'Port', env: 'PORT' }).default(8080),
		verbose: flag.count({ alias: 'v', description: 'Verbosity', env: 'VERBOSE' }),
	},
	run: ({ flags }) => {},
});
```

## Priority

The command line wins, then the variable, then the default. A value from the variable satisfies `.required()`.

## Parsing

Values from the environment are parsed and validated like command-line values, so `flag.number({ env: 'PORT' })` checks that `PORT` is a number. Errors name where the value came from:

```sh
error: Invalid value 'abc' for --port (from $PORT): must be a number
```

- `flag.boolean` accepts `true`/`false`, `1`/`0`, `yes`/`no` and `on`/`off`, in any case.
- `flag.count` accepts a whole number: `VERBOSE=2`.
- Empty values (`API_TOKEN=`) count as unset.
- A `.multiple()` flag gets a single value from its variable.

## Help

Help shows the variable after the description:

```sh
Flags:
  --token <string>  API token (required; env: API_TOKEN)
```

## Where variables come from

Variables are read from `process.env` by default. Pass `env` to `jinju()` to supply them yourself, for example in [tests](./testing):

```ts twoslash
import { command, jinju } from 'jinju';
const deploy = command({ description: 'Deploy', run: () => {} });
// ---cut---
const app = jinju({ commands: { deploy }, env: { API_TOKEN: 'test' } });

await app.run(['deploy']);
```
