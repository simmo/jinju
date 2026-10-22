# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Flags: `flag.string` (with typed `choices`), `flag.number` (`min`, `max`, `integer`), `flag.url`, `flag.email`, `flag.directory` and `flag.file` (`exists`), and `flag.custom` for user-defined parsers, which may be async
- Standard Schema support: `flag.schema(schema, name?)` and `arg.schema(schema, name?)` use any Standard Schema (zod, valibot, arktype, …) as the parser, with types from the schema's output. Schemas that can't receive a string (e.g. `z.number()`) are type errors. No new dependencies; a compatible `StandardSchemaV1` type is exported
- Environment variable fallback: `env: 'API_TOKEN'` on any flag reads the variable when the flag isn't given (priority: argv, env, default), parsed and validated like a command-line value. `jinju({ env })` supplies the variables (defaults to `process.env`), and `HelpFlag.env` exposes them to help templates
- Switches: `flag.boolean` (with `--no-x` negation, and `--x=<value>` accepting `true`/`false`, `1`/`0`, `yes`/`no`, `on`/`off`) and `flag.count` (`-vvv`). Built-in `--help`/`--version` follow the same rules
- Positional args: `arg.*` creators sharing the same parsers as flags, plus `arg.custom`
- Immutable modifiers `.required()`, `.multiple()` and `.default()` on flags and args, with fully inferred types (`InferFlagType`, `InferArgType`, `InferFlags`, `InferArgs`). `Flag`, `Arg` and `Switch` are classes built on a shared abstract `Param` base. Every type used in a public signature is exported (e.g. `Param`, `Defined`, `ParseOptions`, `MergeFlags`, `CheckArgs`)
- Positional allocation supporting one `.multiple()` arg in any position (e.g. `cp`-style `[...sources, dest]`)
- `command()` with typed `run` context, optional `name`, `aliases`, `hidden` and exit codes returned from `run`
- `scope()` for flags and args shared by groups of commands; scopes nest, and shared flags are accepted before the command name
- Dynamic segments: a `:name` key in the command tree reads a value before the command name into the commands' arg called `name` (e.g. `app my-site deploy`), with static names taking priority and setup checked by `jinju()`. Mistakes in the command tree are compile-time errors: `$` must be a command, one segment per level, no args on `$` next to a segment, and (with literal arg names) each command's segment args. `Arg` has a third type parameter carrying its literal `name`, and `CheckTree` (with its building blocks `TreeErrors`, `NodeErrors` and `SegmentError`) is exported
- `jinju()` program with nested command trees (`$` for a level's own command), built-in `--help`/`-h` and `--version`, help generation, `strict` mode and injectable `stdout`, `stderr` and `exit`
- Customisable help: pass a `HelpTemplate` instance as `help` to `jinju()`. Configure it with `sortFlags` and `showHidden`, or extend it and override any method: `render`, `sections`, the per-section and per-row formatters (`formatFlag`, `formatArg`, `formatCommand`, …) and the layout primitives. It renders from `HelpData`, the building blocks of a page with no filtering or sorting applied: the program, path, usage lines, and every subcommand, arg and flag with its syntax `label`, `source` (command, scope or built-in), raw details and creator `options`. Also exported: `formatPath`, and the `HelpTemplateOptions`, `HelpRow`, `HelpData`, `HelpProgram`, `HelpPathPart`, `HelpCommand`, `HelpArg`, `HelpFlag` and `HelpParam` types
- Customisable errors: pass an `ErrorTemplate` instance as `error` to `jinju()`. Configure it with `hint`, or extend it and override `render`, `sections`, `formatErrors`, `formatError`, `formatHint` or `formatCommand`. It renders from `ErrorData`: the program, the `JinjuError` instances, the matched path, the words as typed, and the matched level's `HelpData`. Also exported: the `ErrorData` and `ErrorTemplateOptions` types
- `packageVersion(import.meta.url)` reads `version` from the nearest `package.json`, for `jinju({ version })`
- Tokenizer support for `--x=v`, `--x v`, `-xv`, bundled shorts (`-abc`), negative numbers as values and `--`
- Error classes extending `JinjuError`; errors are collected and reported together
- Tooling: `fallow` (with type-aware analysis enabled, and `fallow dead-code` checked in CI), CI tests on Node 22, 24 and 26 (including loading the build with `require()`), coverage checks (100% required), CI summary support and type tests run by `vitest`
- `AGENTS.md` (imported by `CLAUDE.md`) with contributor guidance for coding agents, including keeping the changelog up to date

### Changed

- Build is ESM-only (`dist/index.js`, `dist/index.d.ts`), built with `tsdown` (rolldown), with `exports` fixed to match the build output
- Requires Node `>=22.12`. CommonJS projects can `require('jinju')`, which loads the ESM build
- Replaced `eslint` with `oxlint` and `prettier` with `oxfmt`
- Updated `node` to `v24` (pinned to `24.22.0` in `.nvmrc`), `vitest` to `v5` and `typescript` to `v6`
- Updated GitHub Actions `actions/checkout` and `actions/setup-node` to `v7`
- Releases publish to npm with Trusted Publishing (OIDC) instead of an `NPM_TOKEN` secret, and published versions now carry provenance. Prereleases run from `release.yml` after CI passes on `main`
- Bump dependencies
- VSCode config updates
- Updated LICENSE date

### Removed

- The 0.0.1 APIs (`celebrate`, `debug`, `fail`, `log`, `spinner`, `success`, `warn`) and configuration support, replaced by the command-line toolkit above
- CommonJS build, and `rollup` with its plugins (replaced by `tsdown`)

## [0.0.1] - 2025-05-06

### Added

- Initial setup
- New APIs; `celebrate`, `debug`, `fail`, `log`, `spinner`, `success`, `warn`
- Ability to set a configuration

[unreleased]: https://github.com/simmo/jinju/compare/0.0.1...HEAD
[@simmo]: https://github.com/simmo
[0.0.1]: https://github.com/simmo/jinju/compare/0.0.1-beta.16...0.0.1
