---
description: 'API reference for flag: every flag and switch creator, their options and the Flag modifiers.'
---

# flag

Creators for flags and switches. See the [Flags guide](../guide/flags) for usage.

## `flag`

```ts
const flag: {
	string<const C extends string = string>(options: FlagOptions & StringOptions<C>): Flag<NoInfer<C> | undefined, NoInfer<C>>;
	number<const C extends number = number>(options: FlagOptions & NumberOptions<C>): Flag<NoInfer<C> | undefined, NoInfer<C>>;
	url(options: FlagOptions): Flag<URL | undefined, URL>;
	email(options: FlagOptions): Flag<string | undefined, string>;
	directory(options: FlagOptions & PathOptions): Flag<string | undefined, string>;
	file(options: FlagOptions & PathOptions): Flag<string | undefined, string>;
	date(options: FlagOptions): Flag<Date | undefined, Date>;
	json(options: FlagOptions): Flag<JsonValue | undefined, JsonValue>;
	entry(options: FlagOptions): Flag<[key: string, value: string] | undefined, [key: string, value: string]>;
	boolean(options: FlagOptions): Switch<boolean>;
	count(options: FlagOptions): Switch<number>;
	custom<V extends Defined, O extends object = {}>(parse: Parse<V, O>, valueName?: string): (options: FlagOptions & O) => Flag<V | undefined, V>;
	schema<S extends StandardSchemaV1<unknown, Defined>>(schema: S & CheckSchemaInput<S>, valueName?: string): (options: FlagOptions) => Flag<SchemaOutput<S> | undefined, SchemaOutput<S>>;
};
```

| Creator          | Value                            | Value name in help    | Notes                                                                                           |
| ---------------- | -------------------------------- | --------------------- | ----------------------------------------------------------------------------------------------- |
| `flag.string`    | `string`                         | `string`              | [`StringOptions`](./types#stringoptions): `choices` narrows the type                            |
| `flag.number`    | `number`                         | `number`              | [`NumberOptions`](./types#numberoptions): `min`, `max`, `integer`, `choices` (narrows the type) |
| `flag.url`       | `URL`                            | `url`                 |                                                                                                 |
| `flag.email`     | `string`                         | `email`               |                                                                                                 |
| `flag.directory` | `string`                         | `directory`           | Absolute path. [`PathOptions`](./types#pathoptions): `exists`                                   |
| `flag.file`      | `string`                         | `file`                | Absolute path. [`PathOptions`](./types#pathoptions): `exists`                                   |
| `flag.date`      | `Date`                           | `date`                | ISO 8601: `2026-10-25` or `2026-10-25T14:30`, with an optional offset                           |
| `flag.json`      | [`JsonValue`](./types#jsonvalue) | `json`                | Parsed with `JSON.parse`                                                                        |
| `flag.entry`     | `[key, value]`                   | `key=value`           | Split at the first `=`                                                                          |
| `flag.boolean`   | `boolean`                        |                       | Switch, defaults to `false`                                                                     |
| `flag.count`     | `number`                         |                       | Switch, defaults to `0`                                                                         |
| `flag.custom`    | Your parser's                    | `valueName` (`value`) | See [`Parse`](./types#parse)                                                                    |
| `flag.schema`    | Schema output                    | `valueName` (`value`) | The schema's input must accept a string                                                         |

## `Flag` {#flag-class}

A flag that takes a value. `T` is the resolved type (e.g. `string[] | undefined`) and `V` is what one value parses to. Extends [`Param`](./types#param).

```ts
class Flag<T, V extends Defined> extends Param<T, V> {
	readonly kind: 'flag';
	readonly options: FlagOptions;
	required<R extends boolean = true>(
		required?: R,
	): Flag<Exclude<T, undefined> | (R extends true ? never : undefined), V>;
	multiple<M extends boolean | MultipleOptions = true>(
		allow?: M,
	): Flag<(M extends false ? V : V[]) | (undefined extends T ? undefined : never), V>;
	default(...values: DefaultValues<T, V>): Flag<Exclude<T, undefined>, V>;
}
```

| Method                | Effect                                                                                                                          |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `.required(on?)`      | Must be provided. Clears any default.                                                                                           |
| `.multiple(on?)`      | Repeatable, collected into an array. Pass [`MultipleOptions`](./types#multipleoptions) to also split each value on a separator. |
| `.default(...values)` | Used when absent: one value, or one or more when `multiple`. Clears `required`.                                                 |

Each returns a new flag: flags are immutable.

## `Switch`

A flag that never takes a value: `flag.boolean` and `flag.count`. Always resolves to a value. Extends [`Param`](./types#param).

```ts
class Switch<T> extends Param<T, T> {
	readonly kind: 'switch';
	readonly options: FlagOptions;
	default(value: T): Switch<T>;
	resolveSwitch(occurrences: readonly boolean[]): T;
}
```

`resolveSwitch` turns occurrences (`--x` → `true`, `--no-x` → `false`) into the value, or the default when there are none.

## `FlagOptions`

```ts
interface FlagOptions {
	description: string;
	alias?: string;
	hidden?: boolean;
	env?: string;
}
```

| Option        | Description                                                                                                          |
| ------------- | -------------------------------------------------------------------------------------------------------------------- |
| `description` | Shown in help.                                                                                                       |
| `alias`       | Another name, without dashes: `'v'` → `-v`, `'dir'` → `--dir`.                                                       |
| `hidden`      | Leave out of help.                                                                                                   |
| `env`         | Environment variable to read when the flag isn't given. See [Environment variables](../guide/environment-variables). |

## `FlagRecord`

```ts
type FlagRecord = Record<string, AnyFlag>;
```

An object of flags, as passed to `flags`.

## `AnyFlag`

```ts
type AnyFlag = Flag<any, any> | Switch<any>;
```

Any flag or switch, for constraints in generic code.
