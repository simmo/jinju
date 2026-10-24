# Types

Every type used in a public signature is exported. Most code only needs the [inference types](#inference). The rest are here so that anything an editor shows can be named.

## Inference

### `InferFlagType`

```ts
type InferFlagType<F extends AnyFlag>;
```

The value a flag resolves to, e.g. `flag.url(o).multiple()` → `URL[] | undefined`.

### `InferArgType`

```ts
type InferArgType<A extends AnyArg>;
```

The value an arg resolves to.

### `InferFlags`

```ts
type InferFlags<F extends FlagRecord> = { [K in keyof F]: InferFlagType<F[K]> };
```

An object of flag values, as `run` receives it.

### `InferArgs`

```ts
type InferArgs<A extends ArgList> = { -readonly [K in keyof A]: InferArgType<A[K]> };
```

A tuple of arg values, as `run` receives it.

### `MergeFlags`

```ts
type MergeFlags<A, B>;
```

`A` with `B`'s keys added or replaced. This is how scope and command flags combine.

## Checks

Each check resolves to `unknown` when the input is valid, and otherwise to an object with an `~error` key that describes the problem, so the message appears in the type error.

### `CheckArgs`

```ts
type CheckArgs<A extends ArgList, Seen extends boolean = false>;
```

Fails when more than one arg is `.multiple()`.

### `CheckTree`

```ts
type CheckTree<T>;
```

Fails on the first problem with dynamic segments in a command tree. See [Dynamic segments](../guide/dynamic-segments#compile-time-checks).

### `TreeErrors`

```ts
type TreeErrors<T, S extends readonly string[], At extends string>;
```

Every problem in tree `T` as a union of messages, or `never`. `S` is the segments above it and `At` is its path. Used by `CheckTree`.

### `NodeErrors`

```ts
type NodeErrors<V, S extends readonly string[], At extends string>;
```

Problems for a command or subtree `V` at `At`, or `never`. Used by `TreeErrors`.

### `SegmentError`

```ts
type SegmentError<A, S extends readonly string[], At extends string, Index extends unknown[] = []>;
```

The first problem binding args `A` of the command at `At` to segments `S`, or `never`. Used by `NodeErrors`.

### `CheckSchemaInput`

```ts
type CheckSchemaInput<S extends StandardSchemaV1>;
```

Fails when a schema can't receive a string, e.g. `z.number()`.

## Params

### `Param`

```ts
abstract class Param<T = unknown, V = unknown> {
	abstract readonly kind: ParamKind;
	readonly value: ValueType<V>;
	readonly options: ParamOptions;
	readonly state: ParamState;
	readonly defaultValue: unknown;
	resolve(inputs: readonly string[], label: string): Promise<Result<unknown>>;
}
```

The base class of [`Flag`](./flag#flag-class), [`Switch`](./flag#switch) and [`Arg`](./arg#arg-class). `T` is the resolved type, e.g. `string[] | undefined`, and `V` is what one input parses to. `resolve` parses raw inputs into the final value, applying the modifiers.

### `ParamKind`

```ts
type ParamKind = 'arg' | 'flag' | 'switch';
```

### `ParamOptions`

```ts
interface ParamOptions {
	description: string;
	alias?: string;
	hidden?: boolean;
	name?: string;
	choices?: readonly string[];
	env?: string;
}
```

The options any param can have: the union of [`FlagOptions`](./flag#flagoptions) and [`ArgOptions`](./arg#argoptions).

### `ParamState`

```ts
interface ParamState {
	readonly required: boolean;
	readonly multiple: boolean;
	readonly hasDefault: boolean;
}
```

The modifier state at runtime. At the type level, it's derived from `T` and `V`.

### `ParamInit`

```ts
interface ParamInit<V> {
	value: ValueType<V>;
	options: ParamOptions;
	state: ParamState;
	defaultValue?: unknown;
}
```

What a param is constructed from.

### `Toggle`

```ts
type Toggle<V> = (occurrences: readonly [boolean, ...boolean[]]) => V;
```

Reduces a switch's occurrences (`--x` → `true`, `--no-x` → `false`) to its value. Only called when the switch was given at least once.

### `Result`

```ts
type Result<T> = { ok: true; value: T } | { ok: false; errors: JinjuError[] };
```

### `Defined`

```ts
type Defined = {} | null;
```

A parsed value: anything but `undefined`, which means "not provided".

### `IsMultiple`

```ts
type IsMultiple<T, V>;
```

`true` when resolved type `T` collects `V` values into an array.

### `DefaultValue`

```ts
type DefaultValue<T, V> = IsMultiple<T, V> extends true ? readonly [V, ...V[]] : V;
```

What `.default()` accepts: a non-empty array for `.multiple()` params, so `.multiple(false)` can take the first value.

## Values

### `Parse`

```ts
type Parse<V, O = {}> = (input: string, options: O) => V | Promise<V>;
```

Converts a raw command-line string into a typed value, using the options passed to the creator. Throw any `Error` to reject the input: its message is shown to the user.

### `ValueType`

```ts
interface ValueType<V = unknown> {
	readonly name: string;
	readonly parse: (input: string) => V | Promise<V>;
}
```

A parser bound to its options, and the name used in help (`--port <number>`).

### `StringOptions`

```ts
interface StringOptions<C extends string = string> {
	choices?: readonly C[];
}
```

`choices` restricts input to these values, and the type is their union.

### `NumberOptions`

```ts
interface NumberOptions {
	min?: number;
	max?: number;
	integer?: boolean;
}
```

### `PathOptions`

```ts
interface PathOptions {
	exists?: boolean;
}
```

`exists` checks the path exists and is the right kind of entry (file or directory).

## Standard Schema

### `StandardSchemaV1`

```ts
interface StandardSchemaV1<Input = unknown, Output = Input> {
	readonly '~standard': {
		readonly version: 1;
		readonly vendor: string;
		readonly validate: (
			value: unknown,
		) => StandardSchemaResult<Output> | Promise<StandardSchemaResult<Output>>;
		readonly types?: { readonly input: Input; readonly output: Output } | undefined;
	};
}
```

The [Standard Schema](https://standardschema.dev) interface, as far as Jinju uses it. It's structurally compatible with `@standard-schema/spec`, so schemas from any compliant library work without Jinju depending on them.

### `StandardSchemaResult`

```ts
type StandardSchemaResult<Output> =
	| { readonly value: Output; readonly issues?: undefined }
	| { readonly issues: readonly StandardSchemaIssue[] };
```

### `StandardSchemaIssue`

```ts
interface StandardSchemaIssue {
	readonly message: string;
	readonly path?: readonly (PropertyKey | { readonly key: PropertyKey })[] | undefined;
}
```

### `SchemaInput`

```ts
type SchemaInput<S extends StandardSchemaV1>;
```

A schema's declared input type, or `unknown` when it doesn't declare `types`.

### `SchemaOutput`

```ts
type SchemaOutput<S extends StandardSchemaV1>;
```

What a schema validates to.
