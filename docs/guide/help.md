---
description: The --help pages generated from your definitions, and customising them by extending HelpTemplate.
---

# Help

`--help` pages are generated from your definitions:

```sh
$ app sync --help
Sync files

Usage:
  app sync [flags] <files>
  app sync <command>

Commands:
  repeat  Sync files repeatedly

Arguments:
  <files>  Path to the files (required)

Flags:
  -h, --help       Show help
  --mode <string>  Sync mode (choices: fast, safe; default: safe)
  -r, --repeat     Repeat the operation
  -v, --verbose    Increase verbosity (env: VERBOSE)
  --version        Show version
```

Pages are rendered by a `HelpTemplate`. To customise them, pass an instance as `help` to `jinju()`, either with options or by extending the class.

## Options

```ts twoslash
import { HelpTemplate, jinju, type CommandTree } from 'jinju';
declare const commands: CommandTree;
// ---cut---
jinju({ commands, help: new HelpTemplate({ sortFlags: false, showHidden: true }) });
```

| Option       | Default | Description                                                        |
| ------------ | ------- | ------------------------------------------------------------------ |
| `sortFlags`  | `true`  | Sort flags by long name. With `false`, they keep definition order. |
| `showHidden` | `false` | Include hidden commands and flags.                                 |

## Extending the template

Override any method to change part of the page, and call `super` to build on the default:

```ts twoslash
import { type CommandTree, type HelpData, type HelpFlag, HelpTemplate, jinju } from 'jinju';
declare const commands: CommandTree;
// ---cut---
class MyHelp extends HelpTemplate {
	override formatFlag(flag: HelpFlag) {
		const [label, description] = super.formatFlag(flag);
		return [label, flag.source === 'builtin' ? `${description} (built-in)` : description] as const;
	}

	override sections(data: HelpData) {
		return [`${data.program.name} v${data.program.version}`, ...super.sections(data)];
	}
}

jinju({ version: '1.0.0', help: new MyHelp({ sortFlags: false }), commands });
```

| Method                                                                           | Default                                                                                                              |
| -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `render(data)`                                                                   | Joins `sections(data)` with blank lines and adds a trailing newline. Override it to replace the layout entirely      |
| `sections(data)`                                                                 | `[description, deprecated, usage, commands, args, flags]`, with empty sections left out                              |
| `formatDeprecated`, `formatUsage`, `formatCommands`, `formatArgs`, `formatFlags` | Each renders one section from `data`                                                                                 |
| `commands(data)`, `flags(data)`                                                  | Choose what to list: hidden entries are left out unless `showHidden`, and flags are sorted unless `sortFlags: false` |
| `formatCommand`, `formatArg`, `formatFlag`                                       | One `[left, right]` table row each                                                                                   |
| `formatTags`, `formatValue`, `formatPath`                                        | ` (required; default: 3)`, default values, `<project> deploy`                                                        |
| `formatTable(rows)`, `formatSection(title, lines)`                               | Layout primitives                                                                                                    |

The text `render` returns is printed as-is, so it should end with a newline.

## Help data

`HelpData` holds the building blocks of a page, and the template decides what to use and how. It makes no layout decisions: nothing is filtered or sorted.

| Field                                              | Contents                                                                                                                                                                                                                |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `program`                                          | `name`, `version`, `description`                                                                                                                                                                                        |
| `path`                                             | The command path as `{ name, dynamic }` parts. `formatPath(path)` gives `<project> deploy`                                                                                                                              |
| `description`, `aliases`, `runnable`, `deprecated` | This level's description, its command's aliases, whether it has a command to run, and whether that command is deprecated (`true` or the reason)                                                                         |
| `usage`                                            | Usage lines, e.g. `app <project> deploy [flags] [<env>]`                                                                                                                                                                |
| `commands`                                         | Each subcommand: `name`, `label`, `description`, `aliases`, `hidden`, `deprecated`, `dynamic`, full `path`, `runnable`, `group` (has subcommands)                                                                       |
| `args`                                             | Each arg in order: `name`, `label` (`<env>`), `usage` (`[<env>]`), `source` (`command` or `scope`), `segment`                                                                                                           |
| `flags`                                            | Each flag in definition order, hidden ones included: `key`, `name`, `alias`, `kind` (`flag` or `switch`), `env`, `source` (`command`, `scope` or `builtin`), `hidden`, `deprecated`, `label` (`-n, --dry-run <string>`) |

Args and flags also carry `description`, `type`, `required`, `multiple`, `separator`, `hasDefault`, the raw `default`, `choices`, and `options`. `options` is everything passed to the creator, including `min`, `max`, `integer`, `exists` and the options of custom parsers.

See the [Help API](../api/help) for every type.
