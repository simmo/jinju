# Getting started

Jinju is a toolkit for building Node command-line apps in TypeScript. You define flags, args and commands as separate values, compose them into a program, and get back fully typed input in each command's `run` handler. Help pages, error messages and exit codes are handled for you.

## Requirements

- Node `>=22.12`
- ESM projects work as usual. CommonJS projects can `require('jinju')`, which loads the ESM build.

## Install

::: code-group

```sh [npm]
npm install jinju
```

```sh [pnpm]
pnpm add jinju
```

```sh [yarn]
yarn add jinju
```

:::

## Your first CLI

Create `cli.ts`:

```ts twoslash
import { arg, command, flag, jinju, packageVersion } from 'jinju';

const greet = command({
	description: 'Greet someone',
	args: [arg.string({ name: 'name', description: 'Who to greet' }).required()],
	flags: {
		shout: flag.boolean({ alias: 's', description: 'Shout the greeting' }),
		times: flag.number({ description: 'How many times', min: 1, integer: true }).default(1),
	},
	run: ({ args: [name], flags }) => {
		//               ^?
		const text = `Hello, ${name}!`;
		for (let i = 0; i < flags.times; i++) console.log(flags.shout ? text.toUpperCase() : text);
	},
});

const app = jinju({
	name: 'greet',
	version: packageVersion(import.meta.url),
	commands: { $: greet },
});

await app.run();
```

`$` is the command for a level of the tree, so here `greet` runs without a subcommand name. Hover over `name` and `flags` above: their types come from the definitions, so `name` is a `string` because the arg is `.required()`, and `times` is a `number` because it has a default.

Run it:

```sh
$ npx tsx cli.ts World --shout
HELLO, WORLD!

$ npx tsx cli.ts --help
Greet someone

Usage:
  greet [flags] <name>

Arguments:
  <name>  Who to greet (required)

Flags:
  -h, --help        Show help
  -s, --shout       Shout the greeting
  --times <number>  How many times (default: 1)
  --version         Show version

$ npx tsx cli.ts
error: Missing required argument <name>

Run 'greet --help' for usage.

$ npx tsx cli.ts World --times 0
error: Invalid value '0' for --times: must be at least 1

Run 'greet --help' for usage.
```

`jinju()` creates the [program](./program), and `app.run()` runs it. `run()` reads `process.argv.slice(2)` by default, sets `process.exitCode` and resolves to the exit code: `0` on success and `1` on errors. You can also pass the arguments yourself, which is useful in [tests](./testing):

```ts twoslash
import { command, jinju } from 'jinju';
const greet = command({ description: 'Greet someone', run: () => {} });
const app = jinju({ name: 'greet', commands: { $: greet } });
// ---cut---
const code = await app.run(['World', '--shout']);
```

## Publishing a CLI

To ship your CLI as a package, point `bin` in `package.json` at the built file and add a shebang to it:

```json
{
	"name": "greet",
	"version": "1.0.0",
	"type": "module",
	"bin": { "greet": "./dist/cli.js" }
}
```

```ts
#!/usr/bin/env node
```

`packageVersion(import.meta.url)` reads `version` from the nearest `package.json` above the file, so `--version` always matches what you published.

## Next steps

- [Flags](./flags): every flag type, modifiers and switches
- [Args](./args): positional arguments, including variadic args
- [Commands](./commands) and [Program](./program): building a command tree
- [Scopes](./scopes): sharing flags and args between commands
