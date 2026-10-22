import { basename, extname } from 'node:path';

import { kebabCase } from './case';
import { type AnyCommand, Command, indexFlags, switchState } from './command';
import { ErrorTemplate } from './error-template';
import { ConfigError, JinjuError, UnknownCommandError, UnknownFlagError } from './errors';
import { flag, type FlagRecord } from './flag';
import {
	formatPath,
	type HelpContext,
	helpData,
	type HelpEntry,
	type HelpPathPart,
	type HelpProgram,
	type HelpTemplate,
	renderHelp,
} from './help';
import { type Param, toParam } from './param';
import { type FlagLookup, type FlagSpec, isFlag, readFlag, tokenize } from './tokenize';
import type { CheckTree, CommandTree } from './tree';

export interface ProgramConfig<T extends CommandTree = CommandTree> {
	/** Shown in usage. Defaults to the executed script's name. */
	name?: string;
	/** Enables `--version`. */
	version?: string;
	description?: string;
	commands: T & CheckTree<T>;
	/** Reject unknown flags. Defaults to `true`. */
	strict?: boolean;
	/** Where flags' `env` variables are read from. Defaults to `process.env`. */
	env?: Readonly<Record<string, string | undefined>>;
	/** Renders help pages. Defaults to `new HelpTemplate()`; extend it to customise. */
	help?: HelpTemplate;
	/** Renders error output. Defaults to `new ErrorTemplate()`; extend it to customise. */
	error?: ErrorTemplate;
	stdout?: (text: string) => void;
	stderr?: (text: string) => void;
	/** Receives the exit code. Defaults to setting `process.exitCode`. */
	exit?: (code: number) => void;
}

interface Node {
	path: HelpPathPart[];
	command?: Command;
	description: string;
	children: Map<string, Node>;
	/** The `:name` child, matched by any word that isn't a static child. */
	dynamic?: Node;
	/** Names of the dynamic segments from the root to here, in order. */
	segments: string[];
	entries: HelpEntry[];
	/** Flags accepted before the next command name: built-ins plus any inherited below. */
	lookup: FlagLookup;
	/** Inherited flags shared (same definition) by every command below. */
	shared: FlagRecord;
}

/** Where routing ended. */
interface Match {
	node: Node;
	/** Argv after the command path. */
	rest: string[];
	/** Values captured by dynamic segments, in order. */
	captured: string[];
	/** The command path as typed, e.g. `['my-site', 'deploy']`. */
	words: string[];
}

const RESERVED = ['help', 'version'];

/**
 * Builds a lookup from (possibly conflicting) flags. Names whose definitions disagree on
 * taking a value are left out, so they end routing and must follow the command name.
 */
const unionLookup = (flags: Iterable<readonly [string, Param]>): FlagLookup => {
	const long = new Map<string, FlagSpec | null>();
	const short = new Map<string, FlagSpec | null>();
	const add = (map: Map<string, FlagSpec | null>, name: string, spec: FlagSpec) => {
		const existing = map.get(name);
		if (existing === undefined) map.set(name, spec);
		else if (existing && existing.takesValue !== spec.takesValue) map.set(name, null);
	};
	for (const [key, param] of flags) {
		const spec = { key, takesValue: param.kind !== 'switch' };
		add(long, kebabCase(key), spec);
		const { alias } = param.options;
		if (alias !== undefined) add(alias.length === 1 ? short : long, alias, spec);
	}
	return {
		long: (name) => long.get(name) ?? undefined,
		short: (char) => short.get(char) ?? undefined,
	};
};

const childNodes = (node: Node): Node[] => [
	...node.children.values(),
	...(node.dynamic ? [node.dynamic] : []),
];

const createNode = (path: HelpPathPart[], segments: string[], command?: Command): Node => ({
	path,
	command,
	description: command?.description ?? '',
	children: new Map(),
	segments,
	entries: [],
	lookup: unionLookup([]),
	shared: {},
});

/** A plain object of commands (not a command, `null`, an array or a primitive). */
const isTree = (value: unknown): value is CommandTree =>
	typeof value === 'object' &&
	value !== null &&
	!Array.isArray(value) &&
	!(value instanceof Command);

/** What a subcommand listing needs to know about a child node. */
const summary = (node: Node) => ({
	description: node.description,
	path: node.path,
	runnable: node.command !== undefined,
	group: childNodes(node).length > 0,
});

const commandsBelow = (node: Node, seen = new Set<Node>()): Command[] => {
	if (seen.has(node)) return [];
	seen.add(node);
	const below = childNodes(node).flatMap((child) => commandsBelow(child, seen));
	return node.command ? [node.command, ...below] : below;
};

const sharedFlags = (commands: readonly Command[]): FlagRecord => {
	const [first, ...others] = commands;
	if (!first) return {};
	const keys = [...first.inherited].filter((key) =>
		others.every((other) => other.inherited.has(key) && other.flags[key] === first.flags[key]),
	);
	return Object.fromEntries(keys.map((key) => [key, first.flags[key]!]));
};

export class Program {
	readonly name: string;
	readonly #config: ProgramConfig;
	readonly #builtins: FlagRecord;
	readonly #program: HelpProgram;
	readonly #root: Node;

	constructor(config: ProgramConfig) {
		this.#config = config;
		this.name = config.name ?? programName();

		this.#builtins = {
			help: flag.boolean({ alias: 'h', description: 'Show help' }),
			...(config.version === undefined
				? {}
				: { version: flag.boolean({ description: 'Show version' }) }),
		};

		this.#program = {
			name: this.name,
			...(config.version === undefined ? {} : { version: config.version }),
			...(config.description === undefined ? {} : { description: config.description }),
		};
		this.#root = this.#build(config.commands, []);
		this.#root.description ||= config.description ?? '';
	}

	/** Routes and runs argv, returning (and reporting via `exit`) the exit code. */
	async run(argv: readonly string[] = process.argv.slice(2)): Promise<number> {
		const code = await this.#execute(argv);
		(this.#config.exit ?? ((value) => (process.exitCode = value)))(code);
		return code;
	}

	/** Help text for the command at `path` (e.g. `['sync', 'files']`). */
	help(path: readonly string[] = []): string {
		let node = this.#root;
		for (const name of path) {
			const child = node.children.get(name) ?? node.dynamic;
			if (!child) throw new UnknownCommandError(name);
			node = child;
		}
		return this.#help(node);
	}

	async #execute(argv: readonly string[]): Promise<number> {
		const match = this.#route(argv);
		const { captured, node, rest } = match;
		const index = indexFlags({ ...this.#builtins, ...node.command?.flags });
		const tokens = tokenize(rest, {
			long: (name) => index.long(name) ?? node.lookup.long(name),
			short: (char) => index.short(char) ?? node.lookup.short(char),
		});
		// Built-in switches follow the same rules as any boolean switch (last occurrence wins).
		const has = (key: string) =>
			tokens
				.flatMap((token) =>
					token.type === 'flag' && token.key === key ? [switchState(token)] : [],
				)
				.at(-1) === true;

		if (has('help')) return this.#print(this.#help(node), 0);
		if (this.#config.version !== undefined && has('version')) {
			return this.#print(`${this.#config.version}\n`, 0);
		}

		if (!node.command) {
			const unknown = tokens.flatMap((token) =>
				token.type === 'unknown' ? [new UnknownFlagError(token.raw)] : [],
			);
			if (unknown.length > 0 && this.#config.strict !== false) return this.#fail(unknown, match);
			const stray = tokens.find((token) => token.type === 'arg');
			if (stray) return this.#fail([new UnknownCommandError(stray.value)], match);
			return this.#print(this.#help(node), argv.length === 0 ? 0 : 1);
		}

		const result = await node.command.parse(rest, {
			globals: this.#builtins,
			leading: captured,
			strict: this.#config.strict,
			...(this.#config.env === undefined ? {} : { env: this.#config.env }),
		});
		if (!result.ok) return this.#fail(result.errors, match);

		try {
			const code = await node.command.execute(result.value);
			return typeof code === 'number' ? code : 0;
		} catch (error) {
			if (error instanceof JinjuError) return this.#fail([error], match);
			throw error;
		}
	}

	/**
	 * Consumes the command path (skipping shared flags) to find the deepest command. Static
	 * names win; otherwise a dynamic segment captures the word.
	 */
	#route(argv: readonly string[]): Match {
		const rest: string[] = [];
		const captured: string[] = [];
		const words: string[] = [];
		let node = this.#root;
		let routing = true;

		for (let i = 0; i < argv.length; i++) {
			const arg = argv[i]!;
			if (!routing) {
				rest.push(arg);
			} else if (arg === '--') {
				routing = false;
				rest.push(arg);
			} else if (isFlag(arg, node.lookup)) {
				const { size, tokens } = readFlag(argv, i, node.lookup);
				// A flag not shared by any command below ends the command path.
				if (tokens.some((token) => token.type === 'unknown')) routing = false;
				const used = routing ? size : 1;
				rest.push(...argv.slice(i, i + used));
				i += used - 1;
			} else {
				const child = node.children.get(arg);
				if (child) {
					node = child;
					words.push(arg);
				} else if (node.dynamic) {
					node = node.dynamic;
					captured.push(arg);
					words.push(arg);
				} else {
					routing = false;
					rest.push(arg);
				}
			}
		}

		return { captured, node, rest, words };
	}

	#build(tree: CommandTree, path: HelpPathPart[]): Node {
		const node = this.#buildTree(tree, path, []);
		this.#index(node);
		return node;
	}

	/** Computes routing lookups and shared flags, bottom-up. */
	#index(node: Node, seen = new Set<Node>()): void {
		if (seen.has(node)) return;
		seen.add(node);
		for (const child of childNodes(node)) this.#index(child, seen);
		const commands = commandsBelow(node);
		const inherited = commands.flatMap((command) =>
			[...command.inherited].map((key) => [key, toParam(command.flags[key])] as const),
		);
		const builtins = Object.entries(this.#builtins).map(
			([key, value]) => [key, toParam(value)] as const,
		);
		node.lookup = unionLookup([...builtins, ...inherited]);
		node.shared = sharedFlags(commands);
	}

	#buildTree(tree: CommandTree, path: HelpPathPart[], segments: string[]): Node {
		// Types already require this; JavaScript callers get a clear error instead.
		if (!isTree(tree)) throw new ConfigError("'commands' must be an object of commands");
		const root = tree.$;
		if (root !== undefined && !(root instanceof Command)) {
			throw new ConfigError(`'$' must be a command (at '${formatPath(path) || 'root'}')`);
		}
		const node = createNode(path, segments, root);
		if (root) this.#validate(root, path, segments);

		for (const [key, value] of Object.entries(tree)) {
			if (key === '$') continue;
			if (!(value instanceof Command) && !isTree(value)) {
				const at = [formatPath(path), key].filter(Boolean).join(' ');
				throw new ConfigError(`'${at}' must be a command or an object of commands`);
			}
			if (key.startsWith(':')) {
				this.#addDynamic(node, key, value);
				continue;
			}
			// A subtree's `$` gives its name/aliases; an invalid `$` is reported when it's built.
			const command =
				value instanceof Command ? value : value.$ instanceof Command ? value.$ : undefined;
			const name = command?.config.name ?? kebabCase(key);
			const child = this.#child(value, [...path, { name, dynamic: false }], segments);

			for (const alias of [name, ...(command?.config.aliases ?? [])]) {
				if (node.children.has(alias)) {
					const at = formatPath([...path, { name: alias, dynamic: false }]);
					throw new ConfigError(`Duplicate command name '${at}'`);
				}
				node.children.set(alias, child);
			}
			node.entries.push({
				...summary(child),
				name,
				aliases: command?.config.aliases ?? [],
				hidden: command?.config.hidden ?? false,
				dynamic: false,
			});
		}

		if (node.dynamic && root && root.params.length > segments.length) {
			throw new ConfigError(
				`'${formatPath(path) || 'root'}' has a dynamic segment, so its '$' command can't take positional args`,
			);
		}

		return node;
	}

	#child(value: AnyCommand | CommandTree, path: HelpPathPart[], segments: string[]): Node {
		if (!(value instanceof Command)) return this.#buildTree(value, path, segments);
		this.#validate(value, path, segments);
		return createNode(path, segments, value);
	}

	#addDynamic(node: Node, key: string, value: AnyCommand | CommandTree): void {
		const name = key.slice(1);
		const at = formatPath(node.path) || 'root';
		if (!/^[^\s]+$/.test(name)) throw new ConfigError(`Invalid dynamic segment '${key}'`);
		if (node.dynamic) {
			throw new ConfigError(`'${at}' can only have one dynamic segment`);
		}

		const segments = [...node.segments, name];
		const child = this.#child(value, [...node.path, { name, dynamic: true }], segments);
		const bound = commandsBelow(child)[0]?.params[segments.length - 1];
		node.dynamic = child;
		const description = bound?.options.description ?? '';
		node.entries.push({
			...summary(child),
			name,
			description,
			aliases: [],
			hidden: false,
			dynamic: true,
		});
	}

	/**
	 * Ensures a command's flags don't clash with the built-ins, and that it starts with an
	 * arg for each dynamic segment above it, in order.
	 */
	#validate(command: Command, path: readonly HelpPathPart[], segments: readonly string[]): void {
		const at = formatPath(path);
		for (const key of RESERVED) {
			if (key in command.flags) {
				throw new ConfigError(`Command '${at}' uses reserved flag '${key}'`);
			}
		}
		indexFlags({ ...this.#builtins, ...command.flags });

		segments.forEach((name, index) => {
			const param = command.params[index];
			if (param?.options.name !== name) {
				throw new ConfigError(
					`Command '${at}' must have an arg named '${name}' at position ${index + 1} for segment ':${name}'`,
				);
			}
			if (param.state.multiple) {
				throw new ConfigError(`Command '${at}': segment ':${name}' can't be a .multiple() arg`);
			}
		});
	}

	#helpContext(node: Node): HelpContext {
		return {
			program: this.#program,
			path: node.path,
			command: node.command,
			description: node.description,
			shared: node.shared,
			builtins: this.#builtins,
			segments: node.segments.length,
			subcommands: node.entries,
		};
	}

	#help(node: Node): string {
		return renderHelp(this.#helpContext(node), this.#config.help);
	}

	#print(text: string, code: number): number {
		(this.#config.stdout ?? ((value) => process.stdout.write(value)))(text);
		return code;
	}

	#fail(errors: readonly JinjuError[], { node, words }: Match): number {
		const template = this.#config.error ?? new ErrorTemplate();
		const text = template.render({
			program: this.#program,
			errors,
			path: node.path,
			words,
			help: helpData(this.#helpContext(node)),
		});
		(this.#config.stderr ?? ((value) => process.stderr.write(value)))(text);
		return 1;
	}
}

const programName = (): string => {
	const script = process.argv[1];
	return script ? basename(script, extname(script)) : 'cli';
};

/** Creates a program from a tree of commands. */
export const jinju = <const T extends CommandTree>(config: ProgramConfig<T>): Program =>
	// `CheckTree` only narrows what's accepted; the tree itself is a plain `CommandTree`.
	new Program({ ...config, commands: config.commands as CommandTree });
