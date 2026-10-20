# Agent guide

jinju is a composable, type-safe toolkit for building Node command-line apps. The source is in `src/`; the public API is everything exported from `src/index.ts`.

## Changelog (required)

Every change that affects users, the public API, the build or tooling must update `CHANGELOG.md` in the same change. Don't leave it for later.

- Add entries under `## [Unreleased]`, following [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
- Use these subheadings, in this order, creating them as needed: `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, `Security`.
- Write one line per change, from a user's point of view. Wrap API names in backticks.
- Breaking changes go under `Changed` or `Removed` and must say what to do instead.
- If a change revises something already listed under `[Unreleased]`, edit that entry. Don't add a second one.
- Never edit released sections (`## [x.y.z]`). Release tooling (`release-it` with `keep-a-changelog`) moves `[Unreleased]` into a version.
- Skip the changelog only for changes with no external effect, such as test-only edits or internal refactors. Say so when reporting the change.

## Commands

- `npm test` runs the `unit` vitest project: every `src/**/*.test.ts`, both as runtime tests and as type tests
- `npm run typecheck`, `npm run lint`, `npm run format` (`format:check` in CI)
- `npm run dead-code` runs `fallow dead-code` (unused code, private type leaks, circular dependencies; type-aware via `.fallowrc.jsonc`)
- `npm run build` produces `dist/index.js` and `dist/index.d.ts` (ESM-only; CommonJS consumers load it with `require()`, Node >= 22.12)
- `npm run test:package` runs the `package` vitest project (`test/**/*.test.ts`) against the built `dist`, e.g. loading it with `require('jinju')` (run after `build`)
- `npx tsx src/example.ts <args>` runs the example CLI

Before reporting work as done, run tests, typecheck, lint, format and dead-code.

## Conventions

- Each `src/<name>.ts` has a matching `src/<name>.test.ts`, except `example.ts`. Type assertions (`expectTypeOf`, `@ts-expect-error`) go in the same file as the runtime tests.
- Changes to the public API also update `src/index.test.ts`, which pins the exports, and the API section of `README.md`.
- Types should show resolved values in editors (e.g. `string[] | undefined`). Don't expose type-alias names like `Foo<Bar>`. Check by hovering, or with the TypeScript checker's `typeToString`.
- Tabs and single quotes; `oxfmt` decides formatting.
