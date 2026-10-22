import type { AnyArg, ArgList } from './arg';
import type { AnyCommand, Command } from './command';
import type { FlagRecord } from './flag';
import type { ELEMENT, IsMultiple, VALUE } from './param';

/**
 * Commands keyed by name. Nest objects for subcommands; `$` is the command for that level.
 * A `:name` key is a dynamic segment: it captures one word into the commands' arg named
 * `name`, e.g. `{ ':project': { deploy } }` routes `app my-site deploy`.
 */
export interface CommandTree {
	readonly [key: string]: AnyCommand | CommandTree;
}

// ── Compile-time checks for dynamic segments ──────────────────────────────────────────
// Each command under `:name` keys must start with args named after those segments, in
// order, none of them `.multiple()`. Args whose name isn't a literal type can't be checked
// here and are left to the runtime check in `jinju()`. `CheckTree` is the entry point; the
// other types are its building blocks, exported so every type in a public signature can be
// named.

/** The first problem binding args `A` of the command at `At` to segments `S`, or `never`. */
export type SegmentError<
	A,
	S extends readonly string[],
	At extends string,
	Index extends unknown[] = [],
> = S extends readonly [infer Name extends string, ...infer Rest extends string[]]
	? A extends readonly [infer Head extends AnyArg, ...infer Tail]
		? Exclude<Head['options']['name'], undefined> extends infer Bound
			? [Bound] extends [never]
				? `Command '${At}' must name arg ${[...Index, 1]['length']} '${Name}' for segment ':${Name}'`
				: string extends Bound
					? SegmentError<Tail, Rest, At, [...Index, 1]>
					: [Bound] extends [Name]
						? IsMultiple<Head[typeof VALUE], Head[typeof ELEMENT]> extends true
							? `Command '${At}': segment ':${Name}' can't be a .multiple() arg`
							: SegmentError<Tail, Rest, At, [...Index, 1]>
						: `Command '${At}' must have an arg named '${Name}' at position ${[...Index, 1]['length']} for segment ':${Name}'`
			: never
		: `Command '${At}' must have an arg named '${Name}' at position ${[...Index, 1]['length']} for segment ':${Name}'`
	: never;

/** Problems for a command or subtree `V` at `At`, under segments `S`, or `never`. */
export type NodeErrors<V, S extends readonly string[], At extends string> =
	V extends Command<FlagRecord, infer A extends ArgList>
		? SegmentError<A, S, At>
		: V extends CommandTree
			? TreeErrors<V, S, At>
			: never;

/**
 * Problems anywhere in tree `T`, or `never`. Trees typed only as `CommandTree` (index
 * signatures) have no known keys, so they aren't checked. Besides each entry's own
 * problems, a level must have a command (not a tree) as `$`, at most one `:segment`, and
 * no positional args on `$` next to a segment.
 */
export type TreeErrors<T, S extends readonly string[], At extends string> = string extends keyof T
	? never
	:
			| {
					[K in keyof T & string]: K extends ':'
						? never // Invalid name; reported by the runtime check.
						: K extends `:${infer Name}`
							? NodeErrors<T[K], [...S, Name], `${At}${At extends '' ? '' : ' '}<${Name}>`>
							: K extends '$'
								? T[K] extends AnyCommand
									? NodeErrors<T[K], S, At extends '' ? 'root' : At>
									: `'$' must be a command (at '${At extends '' ? 'root' : At}')`
								: NodeErrors<T[K], S, `${At}${At extends '' ? '' : ' '}${K}`>;
			  }[keyof T & string]
			// More than one segment: some segment key leaves others when removed.
			| {
					[K in Exclude<keyof T & `:${string}`, ':'>]: [
						Exclude<Exclude<keyof T & `:${string}`, ':'>, K>,
					] extends [never]
						? never
						: `'${At extends '' ? 'root' : At}' can only have one dynamic segment`;
			  }[Exclude<keyof T & `:${string}`, ':'>]
			// `$` next to a segment: its args may only be the segment args above it.
			| ([Exclude<keyof T & `:${string}`, ':'>] extends [never]
					? never
					: T extends { $: Command<FlagRecord, infer A extends ArgList> }
						? A extends readonly [...{ [I in keyof S]: unknown }, unknown, ...unknown[]]
							? `'${At extends '' ? 'root' : At}' has a dynamic segment, so its '$' command can't take positional args`
							: never
						: never);

/** Resolves to an unsatisfiable shape describing the first problem with dynamic segments. */
export type CheckTree<T> = [TreeErrors<T, [], ''>] extends [never]
	? unknown
	: { '~error': TreeErrors<T, [], ''> };
