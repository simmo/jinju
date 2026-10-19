import { kebabCase } from './case';
import type { Command } from './command';
import type { FlagRecord } from './flag';
import { type Param, toParam } from './param';

// ── Data ────────────────────────────────────────────────────────────────────────────────
// What a help page is about, without layout decisions: nothing is filtered or sorted
// here. Labels and usage lines are included because they describe command-line syntax.

/** One step of a command path. */
export interface HelpPathPart {
	name: string;
	/** A dynamic segment (`:name` in the command tree) rather than a command name. */
	dynamic: boolean;
}

/** A subcommand of the current level, in definition order. */
export interface HelpCommand extends HelpPathPart {
	/** e.g. `deploy`, or `<project>` for a dynamic segment. */
	label: string;
	description: string;
	aliases: readonly string[];
	hidden: boolean;
	/** Its full path from the program, e.g. `<project> deploy`. */
	path: readonly HelpPathPart[];
	/** Has a command to run. */
	runnable: boolean;
	/** Has subcommands of its own. */
	group: boolean;
}

/** Details shared by args and flags. */
export interface HelpParam {
	description: string;
	/** The value type's name, e.g. `string`, `url`, or `boolean`/`count` for switches. */
	type: string;
	required: boolean;
	multiple: boolean;
	hasDefault: boolean;
	/** The raw default value (e.g. a `URL`); only meaningful when `hasDefault`. */
	default: unknown;
	choices?: readonly string[];
	/**
	 * Everything passed to the creator, including type-specific options such as `min`,
	 * `max`, `integer` or `exists`, and options of custom parsers.
	 */
	options: Readonly<Record<string, unknown>>;
}

/** A positional argument, in order. */
export interface HelpArg extends HelpParam {
	/** The arg's `name`, or its type when unnamed. */
	name: string;
	/** e.g. `<env>`. */
	label: string;
	/** How it appears in a usage line, e.g. `[<env>]` or `<files>...`. */
	usage: string;
	/** Defined on the command itself, or inherited from a scope. */
	source: 'command' | 'scope';
	/** Bound to a dynamic segment, so its value comes from the command path. */
	segment: boolean;
}

/** A flag accepted at this level: the command's own, inherited and built-in. */
export interface HelpFlag extends HelpParam {
	/** The key it's defined under, e.g. `dryRun`. */
	key: string;
	/** Long name without dashes, e.g. `dry-run`. */
	name: string;
	/** Without dashes: one character for `-x`, longer for `--xyz`. */
	alias?: string;
	/** Switches (`flag.boolean`, `flag.count`) never take a value. */
	kind: 'flag' | 'switch';
	/** Defined on the command itself, inherited from a scope, or built in (`--help`, `--version`). */
	source: 'command' | 'scope' | 'builtin';
	hidden: boolean;
	/** e.g. `-n, --dry-run <string>`; a switch defaulting to `true` shows as `--[no-]name`. */
	label: string;
}

export interface HelpProgram {
	/** e.g. `app`. */
	name: string;
	version?: string;
	description?: string;
}

/** Everything known about the help page being rendered. */
export interface HelpData {
	program: HelpProgram;
	/** Command path below the program, e.g. `<project> deploy`. Empty at the root. */
	path: readonly HelpPathPart[];
	/** This level's description: its command's, or the program's at the root. */
	description?: string;
	/** Aliases of this level's command. */
	aliases: readonly string[];
	/** Whether this level has a command to run (as opposed to only subcommands). */
	runnable: boolean;
	/** Usage lines, e.g. `app <project> deploy [flags] [<env>]` and `app <project> <command>`. */
	usage: readonly string[];
	commands: readonly HelpCommand[];
	args: readonly HelpArg[];
	flags: readonly HelpFlag[];
}

/** A subcommand as the program knows it; `helpData` adds the `label`. */
export type HelpEntry = Omit<HelpCommand, 'label'>;

export interface HelpContext {
	program: HelpProgram;
	path: readonly HelpPathPart[];
	description?: string;
	command?: Command;
	subcommands: readonly HelpEntry[];
	/** Inherited flags shared by every command at this level. */
	shared?: FlagRecord;
	/** `--help`, `--version`. */
	builtins?: FlagRecord;
	/** How many leading args are bound to dynamic segments in `path`. */
	segments?: number;
}

const helpParam = (param: Param): HelpParam => ({
	description: param.options.description,
	type: param.value.name,
	required: param.state.required,
	multiple: param.state.multiple,
	hasDefault: param.state.hasDefault,
	default: param.defaultValue,
	...(param.options.choices ? { choices: param.options.choices } : {}),
	options: { ...param.options },
});

/** `<project> deploy`: dynamic segments in angle brackets. */
export const formatPath = (path: readonly HelpPathPart[]): string =>
	path.map((part) => (part.dynamic ? `<${part.name}>` : part.name)).join(' ');

const usageArg = (arg: Pick<HelpArg, 'label' | 'multiple' | 'required'>): string => {
	const label = arg.label + (arg.multiple ? '...' : '');
	return arg.required ? label : `[${label}]`;
};

/** `-n, --dry-run <string>`; a switch defaulting to `true` shows as `--[no-]name`. */
const flagLabel = (
	flag: Pick<HelpFlag, 'alias' | 'default' | 'kind' | 'name' | 'type'>,
): string => {
	const negatable = flag.kind === 'switch' && flag.default === true;
	const names = [negatable ? `--[no-]${flag.name}` : `--${flag.name}`];
	if (flag.alias !== undefined) {
		names.unshift(flag.alias.length === 1 ? `-${flag.alias}` : `--${flag.alias}`);
	}
	return names.join(', ') + (flag.kind === 'switch' ? '' : ` <${flag.type}>`);
};

/** Collects what a help page is about into plain data for a `HelpTemplate`. */
export const helpData = (context: HelpContext): HelpData => {
	const { builtins = {}, command, path, program, segments = 0, shared = {}, subcommands } = context;
	const params = command?.params ?? [];
	const inheritedArgs = params.length - (command?.config.args?.length ?? 0);

	const args = params.map((param, index): HelpArg => {
		const name = param.options.name ?? param.value.name;
		const arg = { ...helpParam(param), name, label: `<${name}>` };
		return {
			...arg,
			usage: usageArg(arg),
			source: index < inheritedArgs ? 'scope' : 'command',
			segment: index < segments,
		};
	});

	const flags = Object.entries({ ...shared, ...command?.flags, ...builtins }).map(
		([key, value]): HelpFlag => {
			const param = toParam(value);
			const { alias } = param.options;
			const flag = {
				...helpParam(param),
				key,
				name: kebabCase(key),
				...(alias === undefined ? {} : { alias }),
				kind: param.kind === 'switch' ? ('switch' as const) : ('flag' as const),
			};
			const source =
				key in builtins
					? 'builtin'
					: key in shared || command?.inherited.has(key)
						? 'scope'
						: 'command';
			return { ...flag, source, hidden: param.options.hidden ?? false, label: flagLabel(flag) };
		},
	);

	const prefix = [program.name, formatPath(path)].filter(Boolean).join(' ');
	const usage: string[] = [];
	if (command) {
		const parts = [prefix];
		if (flags.length > 0) parts.push('[flags]');
		parts.push(...args.filter((arg) => !arg.segment).map((arg) => arg.usage));
		usage.push(parts.join(' '));
	}
	if (subcommands.length > 0) usage.push(`${prefix} <command>`);

	return {
		program,
		path,
		...(context.description ? { description: context.description } : {}),
		aliases: command?.config.aliases ?? [],
		runnable: command !== undefined,
		usage,
		commands: subcommands.map((entry) => ({ ...entry, label: formatPath([entry]) })),
		args,
		flags,
	};
};

// ── Rendering ───────────────────────────────────────────────────────────────────────────

export interface HelpTemplateOptions {
	/** Sort flags by long name. Defaults to `true`. */
	sortFlags?: boolean;
	/** Include hidden commands and flags. Defaults to `false`. */
	showHidden?: boolean;
}

/** A table row: left column (e.g. a label) and right column (e.g. a description). */
export type HelpRow = readonly [string, string];

/**
 * Renders help pages from `HelpData`. This is the built-in layout; extend it and override
 * any method to change part of it, or `render` to replace it entirely.
 */
export class HelpTemplate {
	readonly options: Readonly<Required<HelpTemplateOptions>>;

	constructor(options: HelpTemplateOptions = {}) {
		this.options = { sortFlags: true, showHidden: false, ...options };
	}

	/** The full page. Printed as-is, so it should end with a newline. */
	render(data: HelpData): string {
		return `${this.sections(data).join('\n\n')}\n`;
	}

	/** The page's sections, in order. Empty strings are left out. */
	sections(data: HelpData): string[] {
		return [
			data.description ?? '',
			this.formatUsage(data),
			this.formatCommands(data),
			this.formatArgs(data),
			this.formatFlags(data),
		].filter(Boolean);
	}

	/** Which subcommands to list. */
	commands(data: HelpData): readonly HelpCommand[] {
		return this.options.showHidden ? data.commands : data.commands.filter((entry) => !entry.hidden);
	}

	/** Which flags to list, in order. */
	flags(data: HelpData): readonly HelpFlag[] {
		const flags = this.options.showHidden ? data.flags : data.flags.filter((flag) => !flag.hidden);
		return this.options.sortFlags ? flags.toSorted((a, b) => a.name.localeCompare(b.name)) : flags;
	}

	formatUsage(data: HelpData): string {
		return this.formatSection('Usage', data.usage);
	}

	formatCommands(data: HelpData): string {
		const rows = this.commands(data).map((entry) => this.formatCommand(entry));
		return rows.length > 0 ? this.formatSection('Commands', this.formatTable(rows)) : '';
	}

	formatArgs(data: HelpData): string {
		const rows = data.args.map((arg) => this.formatArg(arg));
		return rows.length > 0 ? this.formatSection('Arguments', this.formatTable(rows)) : '';
	}

	formatFlags(data: HelpData): string {
		const rows = this.flags(data).map((flag) => this.formatFlag(flag));
		return rows.length > 0 ? this.formatSection('Flags', this.formatTable(rows)) : '';
	}

	formatCommand(command: HelpCommand): HelpRow {
		return [command.label, command.description];
	}

	formatArg(arg: HelpArg): HelpRow {
		return [arg.label, arg.description + this.formatTags(arg)];
	}

	formatFlag(flag: HelpFlag): HelpRow {
		return [flag.label, flag.description + this.formatTags(flag)];
	}

	/** e.g. ` (required; default: 3)`. Switch defaults (false/0) aren't worth repeating. */
	formatTags(param: HelpArg | HelpFlag): string {
		const tags: string[] = [];
		if (param.required) tags.push('required');
		if (param.multiple) tags.push('multiple');
		if (param.choices) tags.push(`choices: ${param.choices.join(', ')}`);
		const isSwitch = 'kind' in param && param.kind === 'switch';
		if (param.hasDefault && !isSwitch) tags.push(`default: ${this.formatValue(param.default)}`);
		return tags.length > 0 ? ` (${tags.join('; ')})` : '';
	}

	formatValue(value: unknown): string {
		return Array.isArray(value)
			? value.map((item) => this.formatValue(item)).join(', ')
			: String(value);
	}

	formatPath(path: readonly HelpPathPart[]): string {
		return formatPath(path);
	}

	/** Rows with the left column padded to a common width. */
	formatTable(rows: readonly HelpRow[]): string[] {
		const width = Math.max(...rows.map(([left]) => left.length));
		return rows.map(([left, right]) => `${left.padEnd(width)}  ${right}`.trimEnd());
	}

	/** A heading followed by indented lines. */
	formatSection(title: string, lines: readonly string[]): string {
		return `${title}:\n${lines.map((line) => `  ${line}`).join('\n')}`;
	}
}

export const renderHelp = (context: HelpContext, template = new HelpTemplate()): string =>
	template.render(helpData(context));
