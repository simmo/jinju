import { basename, extname } from 'node:path';

import { kebabCase } from './case';
import { Command, indexFlags } from './command';
import { ConfigError, JinjuError, UnknownCommandError, UnknownFlagError } from './errors';
import { flag, type FlagRecord } from './flag';
import { type HelpEntry, renderHelp } from './help';
import { type Param, toParam } from './param';
import { type FlagLookup, type FlagSpec, isFlag, readFlag, tokenize } from './tokenize';

// oxlint-disable-next-line no-explicit-any
type AnyCommand = Command<any, any>;

/**
 * Commands keyed by name. Nest objects for subcommands; `$` is the command for that level.
 * Keys starting with `:` are reserved for dynamic segments.
 */
export interface CommandTree {
	readonly [key: string]: AnyCommand | CommandTree;
}

export interface ProgramConfig {
	/** Shown in usage. Defaults to the executed script's name. */
	name?: string;
	/** Enables `--version`. */
	version?: string;
	description?: string;
	commands: CommandTree;
	/** Reject unknown flags. Defaults to `true`. */
	strict?: boolean;
	stdout?: (text: string) => void;
	stderr?: (text: string) => void;
	/** Receives the exit code. Defaults to setting `process.exitCode`. */
	exit?: (code: number) => void;
}

interface Node {
	path: string[];
	command?: Command;
	description: string;
	children: Map<string, Node>;
	entries: HelpEntry[];
	/** Flags accepted before the next command name: built-ins plus any inherited below. */
	lookup: FlagLookup;
	/** Inherited flags shared (same definition) by every command below. */
	shared: FlagRecord;
}

/** Where routing ended. Will also carry captured dynamic segment values. */
interface Match {
	node: Node;
	rest: string[];
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

const commandsBelow = (node: Node, seen = new Set<Node>()): Command[] => {
	if (seen.has(node)) return [];
	seen.add(node);
	const below = [...node.children.values()].flatMap((child) => commandsBelow(child, seen));
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
			const child = node.children.get(name);
			if (!child) throw new UnknownCommandError(name);
			node = child;
		}
		return this.#help(node);
	}

	async #execute(argv: readonly string[]): Promise<number> {
		const { node, rest } = this.#route(argv);
		const index = indexFlags({ ...this.#builtins, ...node.command?.flags });
		const tokens = tokenize(rest, {
			long: (name) => index.long(name) ?? node.lookup.long(name),
			short: (char) => index.short(char) ?? node.lookup.short(char),
		});
		const has = (key: string) =>
			tokens.some((token) => token.type === 'flag' && token.key === key && !token.negated);

		if (has('help')) return this.#print(this.#help(node), 0);
		if (this.#config.version !== undefined && has('version')) {
			return this.#print(`${this.#config.version}\n`, 0);
		}

		if (!node.command) {
			const unknown = tokens.flatMap((token) =>
				token.type === 'unknown' ? [new UnknownFlagError(token.raw)] : [],
			);
			if (unknown.length > 0) return this.#fail(unknown, node);
			const stray = tokens.find((token) => token.type === 'arg');
			if (stray) return this.#fail([new UnknownCommandError(stray.value)], node);
			return this.#print(this.#help(node), argv.length === 0 ? 0 : 1);
		}

		const result = await node.command.parse(rest, {
			globals: this.#builtins,
			strict: this.#config.strict,
		});
		if (!result.ok) return this.#fail(result.errors, node);

		try {
			const code = await node.command.execute(result.value);
			return typeof code === 'number' ? code : 0;
		} catch (error) {
			if (error instanceof JinjuError) return this.#fail([error], node);
			throw error;
		}
	}

	/** Consumes leading command names (skipping shared flags) to find the deepest command. */
	#route(argv: readonly string[]): Match {
		const rest: string[] = [];
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
				if (child) node = child;
				else {
					routing = false;
					rest.push(arg);
				}
			}
		}

		return { node, rest };
	}

	#build(tree: CommandTree, path: string[]): Node {
		const node = this.#buildTree(tree, path);
		this.#index(node);
		return node;
	}

	/** Computes routing lookups and shared flags, bottom-up. */
	#index(node: Node, seen = new Set<Node>()): void {
		if (seen.has(node)) return;
		seen.add(node);
		for (const child of node.children.values()) this.#index(child, seen);
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

	#buildTree(tree: CommandTree, path: string[]): Node {
		const root = tree.$;
		if (root !== undefined && !(root instanceof Command)) {
			throw new ConfigError(`'$' must be a command (at '${path.join(' ') || 'root'}')`);
		}
		const node: Node = {
			path,
			command: root,
			description: root?.description ?? '',
			children: new Map(),
			entries: [],
			lookup: unionLookup([]),
			shared: {},
		};
		if (root) this.#validate(root, path);

		for (const [key, value] of Object.entries(tree)) {
			if (key === '$') continue;
			if (key.startsWith(':')) {
				throw new ConfigError(`'${key}': keys starting with ':' are reserved for dynamic segments`);
			}
			const command = value instanceof Command ? value : (value.$ as AnyCommand | undefined);
			const name = command?.config.name ?? kebabCase(key);
			const childPath = [...path, name];
			let child: Node;
			if (value instanceof Command) {
				this.#validate(value, childPath);
				child = {
					path: childPath,
					command: value,
					description: value.description,
					children: new Map(),
					entries: [],
					lookup: unionLookup([]),
					shared: {},
				};
			} else {
				child = this.#buildTree(value, childPath);
			}

			for (const alias of [name, ...(command?.config.aliases ?? [])]) {
				if (node.children.has(alias)) {
					throw new ConfigError(`Duplicate command name '${[...path, alias].join(' ')}'`);
				}
				node.children.set(alias, child);
			}
			if (!command?.config.hidden) node.entries.push({ name, description: child.description });
		}

		return node;
	}

	/** Ensures a command's flags don't clash with the built-in flags. */
	#validate(command: Command, path: readonly string[]): void {
		for (const key of RESERVED) {
			if (key in command.flags) {
				throw new ConfigError(`Command '${path.join(' ')}' uses reserved flag '${key}'`);
			}
		}
		indexFlags({ ...this.#builtins, ...command.flags });
	}

	#help(node: Node): string {
		return renderHelp({
			command: node.command,
			description: node.description,
			globals: { ...node.shared, ...this.#builtins },
			subcommands: node.entries,
			usage: [this.name, ...node.path].join(' '),
		});
	}

	#print(text: string, code: number): number {
		(this.#config.stdout ?? ((value) => process.stdout.write(value)))(text);
		return code;
	}

	#fail(errors: readonly JinjuError[], node: Node): number {
		const usage = [this.name, ...node.path].join(' ');
		const lines = errors.map((error) => `error: ${error.message}`);
		(this.#config.stderr ?? ((value) => process.stderr.write(value)))(
			`${lines.join('\n')}\n\nRun '${usage} --help' for usage.\n`,
		);
		return 1;
	}
}

const programName = (): string => {
	const script = process.argv[1];
	return script ? basename(script, extname(script)) : 'cli';
};

/** Creates a program from a tree of commands. */
export const jinju = (config: ProgramConfig): Program => new Program(config);
