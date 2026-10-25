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

## Documentation (required)

The docs site (VitePress, in `docs/`) is the reference for users. Every change that affects users or the public API must update it in the same change, alongside the changelog. Don't leave it for later.

- `docs/guide/*.md` explains features with examples. Update every page whose behaviour, options or output changed, and add a page (and a `sidebar` entry in `docs/.vitepress/config.ts`) for a new feature.
- `docs/api/*.md` is the API reference. Every export of `src/index.ts` needs a `##` or `###` heading there, named in backticks (``## `flag` ``); `src/index.test.ts` fails otherwise. Keep signatures, options and defaults in step with the source.
- Write TypeScript examples as `ts twoslash` blocks. They import `jinju` from `src/index.ts` and are type-checked by `npm run docs:build`, so a broken example fails the build. Use `// ^?` to show an inferred type (rendered as a line under the code) and `// @errors: <code>` for an intended type error. Point `^?` at values a reader cares about, such as a destructured arg or flag, not at `args`, whose type is the raw `RunContext<…>`. Several `^?` lines can follow one line of code.
- Example output (help pages, error messages) must be real: run the code (e.g. with `npx tsx`) and copy it.
- `README.md` is a short introduction that links to the site. Don't copy the reference into it.
- Every page needs a `description` in its frontmatter: one sentence saying what the page covers. It's the page's meta description and its summary in `llms.txt`.
- `npm run format` also formats code inside the docs. Run it before `docs:build`, since a reformatted line can move a `^?` marker.

Before reporting a change as done, check the docs against the code, not from memory. Nothing checks the API reference's signatures or tables automatically:

- **Signatures.** For every export you changed, read its declaration in `src/` and copy its signature into `docs/api/` from it: type parameters in order, with their constraints and defaults, then parameter and return types. A documented signature must be valid TypeScript that matches the real one, not a sketch.
- **Tables.** Options and field tables (`FlagOptions`, `ProgramConfig`, `HelpData`, …) must list every property of the interface, with current defaults, and nothing that's gone.
- **Every mention.** Search `docs/` for each name you changed or added (`grep -rn 'name' docs/guide docs/api`) and update each hit, guides included, not just the page you started from.
- **Output.** Rerun any example whose output a page shows, and copy the new output.
- **Compatibility.** Compare each changed export with the last release (`git show <tag>:src/<file>.ts`). Type parameters (their order and names) and option names are part of the public API: reordering or renaming them breaks callers. Avoid that, or list it under `Changed` as a breaking change.

How the site is published:

- Releases deploy it. `release.yml` calls `docs.yml`, which runs `scripts/build-docs.ts` and deploys to GitHub Pages. Run `docs.yml` by hand to redeploy without a release.
- The site's address is `homepage` in `package.json`. `scripts/build-docs.ts` reads it from the current checkout and passes it to every version's build, so changing it moves every version, old tags included. Don't hard-code the address in `docs/`.
- `scripts/build-docs.ts` rebuilds every version from its own tag: the root is the latest release, `/<version>/` is each release, and `/next/` is the newest prerelease. Tags without `docs/.vitepress/config.ts` are skipped. Node runs it directly (type stripping), so it can only use erasable TypeScript syntax and `node:` modules.
- Old tags are rebuilt with today's script, so the build contract must stay compatible: `npx vitepress build docs` in a checkout of the tag, with `DOCS_SITE_ORIGIN` (the site's scheme and host, e.g. `https://jinju.js.org`; optional), `DOCS_SITE_BASE` (the path the site is served from, e.g. `/`) and `DOCS_VERSION` (the folder: empty, `x.y.z` or `next`) set in the environment. `docs/.vitepress/config.ts` derives `base` and the absolute links in the files for AI assistants from them.
- The version switcher and the "old version" banner read `versions.json` from the site root at runtime.
- Each build also writes files for AI assistants: `llms.txt`, `llms-full.txt` and a `.md` copy of every page (`vitepress-plugin-llms`). `docs/.vitepress/llms.ts` then runs each `twoslash` example through twoslash and writes the `^?` types and `@errors` errors into those copies as comments, since agents can't see hovers.

## Commands

- `npm test` runs the `unit` vitest project: every `src/**/*.test.ts`, both as runtime tests and as type tests
- `npm run typecheck`, `npm run lint`, `npm run format` (`format:check` in CI)
- `npm run dead-code` runs `fallow dead-code` (unused code, private type leaks, circular dependencies; type-aware via `.fallowrc.jsonc`)
- `npm run build` produces `dist/index.js` and `dist/index.d.ts` (ESM-only; CommonJS consumers load it with `require()`, Node >= 22.12)
- `npm run test:package` runs the `package` vitest project (`test/**/*.test.ts`) against the built `dist`, e.g. loading it with `require('jinju')` (run after `build`)
- `npx tsx src/example.ts <args>` runs the example CLI
- `npm run docs:dev` serves the docs site locally. `npm run docs:build` builds it, failing on dead links or broken `twoslash` examples. `npm run docs:build:all -- <out-dir>` builds every published version, as the deploy does (needs git tags)

Before reporting work as done, run tests, typecheck, lint, format, dead-code and `docs:build`.

## Conventions

- Coverage of `src` must stay at 100% (lines, statements, functions and branches); `npm run test:coverage` fails otherwise. Remove unreachable code rather than excluding it.
- Each `src/<name>.ts` has a matching `src/<name>.test.ts`, except `example.ts`. Type assertions (`expectTypeOf`, `@ts-expect-error`) go in the same file as the runtime tests.
- Changes to the public API also update `src/index.test.ts`, which pins the exports, and the API reference in `docs/api/`.
- Types should show resolved values in editors (e.g. `string[] | undefined`). Don't expose type-alias names like `Foo<Bar>`. Check by hovering, or with the TypeScript checker's `typeToString`.
- Tabs and single quotes; `oxfmt` decides formatting.
