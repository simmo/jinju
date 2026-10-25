---
description: 'API reference for arg: every positional arg creator, their options and the Arg modifiers.'
---

# arg

Creators for positional args. See the [Args guide](../guide/args) for usage.

## `arg`

```ts
const arg: {
	string<const C extends string = string, const N extends string | undefined = undefined>(options: ArgOptions<N> & StringOptions<C>): Arg<NoInfer<C> | undefined, NoInfer<C>, NoInfer<N>>;
	number<const N extends string | undefined = undefined, const C extends number = number>(options: ArgOptions<N> & NumberOptions<C>): Arg<NoInfer<C> | undefined, NoInfer<C>, NoInfer<N>>;
	url<const N extends string | undefined = undefined>(options: ArgOptions<N>): Arg<URL | undefined, URL, NoInfer<N>>;
	email<const N extends string | undefined = undefined>(options: ArgOptions<N>): Arg<string | undefined, string, NoInfer<N>>;
	directory<const N extends string | undefined = undefined>(options: ArgOptions<N> & PathOptions): Arg<string | undefined, string, NoInfer<N>>;
	file<const N extends string | undefined = undefined>(options: ArgOptions<N> & PathOptions): Arg<string | undefined, string, NoInfer<N>>;
	date<const N extends string | undefined = undefined>(options: ArgOptions<N>): Arg<Date | undefined, Date, NoInfer<N>>;
	json<const N extends string | undefined = undefined>(options: ArgOptions<N>): Arg<JsonValue | undefined, JsonValue, NoInfer<N>>;
	entry<const N extends string | undefined = undefined>(options: ArgOptions<N>): Arg<[key: string, value: string] | undefined, [key: string, value: string], NoInfer<N>>;
	custom<V extends Defined, O extends object = {}>(parse: Parse<V, O>, valueName?: string): <const N extends string | undefined = undefined>(options: ArgOptions<N> & O) => Arg<V | undefined, V, NoInfer<N>>;
	schema<S extends StandardSchemaV1<unknown, Defined>>(schema: S & CheckSchemaInput<S>, valueName?: string): <const N extends string | undefined = undefined>(options: ArgOptions<N>) => Arg<SchemaOutput<S> | undefined, SchemaOutput<S>, NoInfer<N>>;
};
```

The creators match [`flag`](./flag#flag)'s value flags. There are no switches.

## `Arg` {#arg-class}

A positional arg. `T` is the resolved type, `V` is what one value parses to, and `N` is its `name` when given as a literal, which is used to check [dynamic segments](../guide/dynamic-segments). Extends [`Param`](./types#param).

```ts
class Arg<T, V extends Defined, N extends string | undefined = undefined> extends Param<T, V> {
	readonly kind: 'arg';
	readonly options: ArgOptions<N>;
	required<R extends boolean = true>(
		required?: R,
	): Arg<Exclude<T, undefined> | (R extends true ? never : undefined), V, N>;
	multiple<M extends boolean = true>(
		allow?: M,
	): Arg<(M extends false ? V : V[]) | (undefined extends T ? undefined : never), V, N>;
	default(...values: DefaultValues<T, V>): Arg<Exclude<T, undefined>, V, N>;
}
```

The modifiers work like [`Flag`](./flag#flag-class)'s, except that `.multiple()` takes no [separator](./types#multipleoptions): each word is one value. Args are optional by default, and at most one arg in a command can be `.multiple()`.

## `ArgOptions`

```ts
interface ArgOptions<N extends string | undefined = string | undefined> {
	description: string;
	name?: N;
}
```

| Option        | Description                                                                                                                            |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `description` | Shown in help.                                                                                                                         |
| `name`        | Display name in usage, e.g. `'files'` → `<files>`. Defaults to the value type's name. Also binds the arg to a `:name` dynamic segment. |

## `ArgList`

```ts
type ArgList = readonly AnyArg[];
```

A tuple of args, as passed to `args`.

## `AnyArg`

```ts
type AnyArg = Arg<any, any, any>;
```

Any arg, for constraints in generic code.
