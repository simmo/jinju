<br/>

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="./.github/assets/logo-dark.svg">
	<img alt="Jinju logo" src="./.github/assets/logo-light.svg" width="150">
</picture>

<small>Opinionated Node CLI Toolkit</small>

[![npm (latest)](https://img.shields.io/npm/v/jinju/latest?color=00b894&label=latest&style=flat)](https://www.npmjs.com/package/jinju) [![npm (beta)](https://img.shields.io/npm/v/jinju/beta?color=0984e3&label=beta&style=flat)](https://www.npmjs.com/package/jinju?activeTab=versions) [![GitHub Workflow Status](https://img.shields.io/github/actions/workflow/status/simmo/jinju/ci.yml?style=flat)](https://github.com/simmo/jinju/actions/workflows/ci.yml) ![Fallow health](.github/badges/health.svg)

---

A composable, type-safe toolkit for building Node command-line apps. Define flags, args and commands separately, compose them, and get fully typed input in every command. Help pages, errors and exit codes are handled for you.

**[Read the documentation →](https://jinju.js.org/)**

## Install

```sh
npm install jinju
```

Requires Node `>=22.12`. ESM-only; CommonJS projects can `require('jinju')`.

## Example

```ts
import { arg, flag, jinju, scope } from 'jinju';

// Flags shared by every command created from the scope.
const base = scope({
	flags: { verbose: flag.count({ alias: 'v', description: 'Increase verbosity' }) },
});

const sync = base.command({
	description: 'Sync files',
	args: [arg.directory({ name: 'files', description: 'Path to the files' }).required()],
	flags: {
		mode: flag.string({ description: 'Mode', choices: ['fast', 'safe'] }).default('safe'),
	},
	run: ({ args: [path], flags }) => {
		// path: string, flags: { verbose: number; mode: 'fast' | 'safe' }
	},
});

const app = jinju({ version: '1.0.0', commands: { sync } });

await app.run(); // reads process.argv.slice(2)
```

```sh
$ app sync ./photos -vv --mode fast
$ app sync --help
```

## Features

- **Typed from your definitions**: `run` receives exact types, such as `'fast' | 'safe'` or `URL[] | undefined`
- **Composable and immutable**: derive `.required()`, `.multiple()` and `.default()` variants, and share flags and args with scopes
- **Command trees**: nested subcommands, aliases, variadic args and dynamic segments (`app my-site deploy`), checked at compile time
- **Validation**: numbers, URLs, emails, paths, choices, environment variables, custom parsers and any [Standard Schema](https://standardschema.dev)
- **Help and errors**: generated `--help` pages and collected errors, both customisable
- **Testable**: inject argv, env, stdout, stderr and the exit code

See the [guide](https://jinju.js.org/guide/getting-started) and the [API reference](https://jinju.js.org/api/flag).

---

<small>© 2026 [Mike Simmonds](https://mike.id)</small>
