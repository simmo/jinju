---
description: API reference for HelpTemplate and the help data it renders.
---

# Help

See the [Help guide](../guide/help) for usage.

## `HelpTemplate`

```ts
class HelpTemplate {
	readonly options: Readonly<Required<HelpTemplateOptions>>;
	constructor(options?: HelpTemplateOptions);

	render(data: HelpData): string;
	sections(data: HelpData): string[];

	commands(data: HelpData): readonly HelpCommand[];
	flags(data: HelpData): readonly HelpFlag[];

	formatDeprecated(data: HelpData): string;
	formatUsage(data: HelpData): string;
	formatCommands(data: HelpData): string;
	formatArgs(data: HelpData): string;
	formatFlags(data: HelpData): string;

	formatCommand(command: HelpCommand): HelpRow;
	formatArg(arg: HelpArg): HelpRow;
	formatFlag(flag: HelpFlag): HelpRow;

	formatTags(param: HelpArg | HelpFlag): string;
	formatValue(value: unknown, type?: string): string;
	formatPath(path: readonly HelpPathPart[]): string;
	formatTable(rows: readonly HelpRow[]): string[];
	formatSection(title: string, lines: readonly string[]): string;
}
```

Renders help pages from [`HelpData`](#helpdata). This is the built-in layout: extend it and override any method to change part of it, or `render` to replace it.

| Method                                                       | Default                                                                                                                          |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| `render`                                                     | Joins `sections` with blank lines and adds a trailing newline. The result is printed as-is.                                      |
| `sections`                                                   | `[description, deprecated, usage, commands, args, flags]`, with empty sections left out                                          |
| `formatDeprecated`                                           | `Deprecated: <reason>` (or `Deprecated.`) when this level's command is deprecated, else `''`                                     |
| `commands`, `flags`                                          | What to list: hidden entries are left out unless `showHidden`; flags are sorted unless `sortFlags: false`                        |
| `formatUsage`, `formatCommands`, `formatArgs`, `formatFlags` | One section each, or `''` when there's nothing to show                                                                           |
| `formatCommand`, `formatArg`, `formatFlag`                   | One table row each: `[label, description + tags]`. Deprecated commands get ` (deprecated)`                                       |
| `formatTags`                                                 | e.g. ` (required; default: 3; deprecated: <reason>)`. Switch defaults aren't shown                                               |
| `formatValue`                                                | One value, given its type's name (`HelpParam.type`): e.g. `mode=fast` for an entry, JSON for `json`. Arrays are joined with `, ` |
| `formatPath`                                                 | [`formatPath`](#formatpath)                                                                                                      |
| `formatTable`                                                | Rows with the left column padded to a common width                                                                               |
| `formatSection`                                              | A `Title:` heading followed by indented lines                                                                                    |

## `HelpTemplateOptions`

```ts
interface HelpTemplateOptions {
	sortFlags?: boolean;
	showHidden?: boolean;
}
```

| Option       | Default | Description                        |
| ------------ | ------- | ---------------------------------- |
| `sortFlags`  | `true`  | Sort flags by long name.           |
| `showHidden` | `false` | Include hidden commands and flags. |

## `HelpData`

```ts
interface HelpData {
	program: HelpProgram;
	path: readonly HelpPathPart[];
	description?: string;
	aliases: readonly string[];
	deprecated?: true | string;
	runnable: boolean;
	usage: readonly string[];
	commands: readonly HelpCommand[];
	args: readonly HelpArg[];
	flags: readonly HelpFlag[];
}
```

Everything known about the page being rendered. Nothing is filtered or sorted.

| Field         | Description                                                                             |
| ------------- | --------------------------------------------------------------------------------------- |
| `program`     | The program's name, version and description.                                            |
| `path`        | The command path below the program. Empty at the root.                                  |
| `description` | This level's description: its command's, or the program's at the root.                  |
| `aliases`     | Aliases of this level's command.                                                        |
| `deprecated`  | Set when this level's command is deprecated: `true`, or the reason given.               |
| `runnable`    | Whether this level has a command to run, as opposed to only subcommands.                |
| `usage`       | Usage lines, e.g. `app <project> deploy [flags] [<env>]` and `app <project> <command>`. |
| `commands`    | Subcommands, in definition order.                                                       |
| `args`        | Args, in order.                                                                         |
| `flags`       | Every flag accepted here (own, inherited and built-in), in definition order.            |

## `HelpProgram`

```ts
interface HelpProgram {
	name: string;
	version?: string;
	description?: string;
}
```

## `HelpPathPart`

```ts
interface HelpPathPart {
	name: string;
	dynamic: boolean;
}
```

One step of a command path. `dynamic` is `true` for a dynamic segment (`:name` in the command tree).

## `HelpCommand`

```ts
interface HelpCommand extends HelpPathPart {
	label: string;
	description: string;
	aliases: readonly string[];
	hidden: boolean;
	path: readonly HelpPathPart[];
	runnable: boolean;
	group: boolean;
	deprecated?: true | string;
}
```

A subcommand. `deprecated` is set when it's deprecated: `true`, or the reason given. `label` is `deploy`, or `<project>` for a dynamic segment. `path` is its full path from the program. `runnable` means it has a command to run, and `group` means it has subcommands.

## `HelpParam`

```ts
interface HelpParam {
	description: string;
	type: string;
	required: boolean;
	multiple: boolean;
	separator?: string;
	hasDefault: boolean;
	default: unknown;
	choices?: readonly (string | number)[];
	options: Readonly<Record<string, unknown>>;
}
```

Details shared by args and flags. `type` is the value type's name, e.g. `string`, `url`, or `boolean`/`count` for switches. `separator` is what each value of a `multiple` param is split on, if anything. `default` is the raw default value, only meaningful when `hasDefault`. `options` is everything passed to the creator.

## `HelpArg`

```ts
interface HelpArg extends HelpParam {
	name: string;
	label: string;
	usage: string;
	source: 'command' | 'scope';
	segment: boolean;
}
```

An arg. `name` is its `name`, or its type when unnamed. `label` is e.g. `<env>`, and `usage` is how it appears in a usage line, e.g. `[<env>]` or `<files>...`. `segment` means its value comes from a dynamic segment in the command path.

## `HelpFlag`

```ts
interface HelpFlag extends HelpParam {
	key: string;
	name: string;
	alias?: string;
	kind: 'flag' | 'switch';
	env?: string;
	source: 'command' | 'scope' | 'builtin';
	hidden: boolean;
	deprecated?: true | string;
	label: string;
}
```

A flag. `deprecated` is set when it's deprecated: `true`, or the reason given. `key` is the key it's defined under (`dryRun`), and `name` is its long name without dashes (`dry-run`). `label` is e.g. `-n, --dry-run <string>`. A switch defaulting to `true` shows as `--[no-]name`.

## `HelpRow`

```ts
type HelpRow = readonly [string, string];
```

A table row: the left column (e.g. a label) and the right column (e.g. a description).

## `formatPath`

```ts
function formatPath(path: readonly HelpPathPart[]): string;
```

Joins a command path with spaces, with dynamic segments in angle brackets: `<project> deploy`.
