# arg

Creators for positional args. See the [Args guide](../guide/args) for usage.

## `arg`

```ts
const arg: {
	string<C extends string = string, N extends string | undefined = undefined>(options: ArgOptions<N> & StringOptions<C>): Arg<C | undefined, C, N>;
	number<N>(options: ArgOptions<N> & NumberOptions): Arg<number | undefined, number, N>;
	url<N>(options: ArgOptions<N>): Arg<URL | undefined, URL, N>;
	email<N>(options: ArgOptions<N>): Arg<string | undefined, string, N>;
	directory<N>(options: ArgOptions<N> & PathOptions): Arg<string | undefined, string, N>;
	file<N>(options: ArgOptions<N> & PathOptions): Arg<string | undefined, string, N>;
	custom<V, O>(parse: Parse<V, O>, valueName?: string): <N>(options: ArgOptions<N> & O) => Arg<V | undefined, V, N>;
	schema<S extends StandardSchemaV1>(schema: S, valueName?: string): <N>(options: ArgOptions<N>) => Arg<SchemaOutput<S> | undefined, SchemaOutput<S>, N>;
};
```

The creators match [`flag`](./flag#flag)'s value flags. There are no switches.

## `Arg` {#arg-class}

A positional arg. `T` is the resolved type, `V` is what one value parses to, and `N` is its `name` when given as a literal, which is used to check [dynamic segments](../guide/dynamic-segments). Extends [`Param`](./types#param).

```ts
class Arg<T, V extends Defined, N extends string | undefined = undefined> extends Param<T, V> {
	readonly kind: 'arg';
	readonly options: ArgOptions<N>;
	required(required?: boolean): Arg<…>;
	multiple(allow?: boolean): Arg<…>;
	default(value: DefaultValue<T, V>): Arg<…>;
}
```

The modifiers work like [`Flag`](./flag#flag-class)'s. Args are optional by default, and at most one arg in a command can be `.multiple()`.

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
