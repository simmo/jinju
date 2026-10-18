# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Flags: `flag.string` (with typed `choices`), `flag.number` (`min`, `max`, `integer`), `flag.url`, `flag.email`, `flag.directory` and `flag.file` (`exists`), and `flag.custom` for user-defined parsers, which may be async
- Switches: `flag.boolean` (with `--no-x` negation) and `flag.count` (`-vvv`)
- Positional args: `arg.*` creators sharing the same parsers as flags, plus `arg.custom`
- Immutable modifiers `.required()`, `.multiple()` and `.default()` on flags and args, with fully inferred types (`InferFlagType`, `InferArgType`, `InferFlags`, `InferArgs`). `Flag`, `Arg` and `Switch` are classes built on a shared abstract `Param` base. Every type used in a public signature is exported (e.g. `Param`, `Defined`, `ParseOptions`, `MergeFlags`, `CheckArgs`)
- Positional allocation supporting one `.multiple()` arg in any position (e.g. `cp`-style `[...sources, dest]`)
- `command()` with typed `run` context, optional `name`, `aliases`, `hidden` and exit codes returned from `run`
- `scope()` for flags and args shared by groups of commands; scopes nest, and shared flags are accepted before the command name
- Dynamic segments: a `:name` key in the command tree reads a value before the command name into the commands' arg called `name` (e.g. `app my-site deploy`), with static names taking priority and setup checked by `jinju()`
- `jinju()` program with nested command trees (`$` for a level's own command), built-in `--help`/`-h` and `--version`, help generation, `strict` mode and injectable `stdout`, `stderr` and `exit`
- Tokenizer support for `--x=v`, `--x v`, `-xv`, bundled shorts (`-abc`), negative numbers as values and `--`
- Error classes extending `JinjuError`; errors are collected and reported together
- Tooling: `fallow` (with type-aware analysis enabled), coverage checks, CI summary support and type tests run by `vitest`
- `AGENTS.md` (imported by `CLAUDE.md`) with contributor guidance for coding agents, including keeping the changelog up to date

### Changed

- Build is ESM-only (`dist/index.js`, `dist/index.d.ts`), with `exports` fixed to match the build output
- Requires Node `>=22`
- Replaced `eslint` with `oxlint` and `prettier` with `oxfmt`
- Updated `node` to `v24`, `vitest` to `v4` and `typescript` to `v6`
- VSCode config updates
- Updated LICENSE date

### Removed

- The 0.0.1 APIs (`celebrate`, `debug`, `fail`, `log`, `spinner`, `success`, `warn`) and configuration support, replaced by the command-line toolkit above
- CommonJS build and unused rollup plugins (`commonjs`, `json`, `node-resolve`, `terser`)

## [0.0.1] - 2025-05-06

### Added

- Initial setup
- New APIs; `celebrate`, `debug`, `fail`, `log`, `spinner`, `success`, `warn`
- Ability to set a configuration

[unreleased]: https://github.com/simmo/jinju/compare/0.0.1...HEAD
[@simmo]: https://github.com/simmo
[0.0.1]: https://github.com/simmo/jinju/compare/0.0.1-beta.16...0.0.1
