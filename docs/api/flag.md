---
description: 'API reference for flag: every flag and switch creator, their options and the Flag modifiers.'
---

# flag

Creators for flags and switches. See the [Flags guide](../guide/flags) for usage.

## `flag`

```ts
const flag: {
	string<C extends string = string>(options: FlagOptions & StringOptions<C>): Flag<C | undefined, C>;
	number(options: FlagOptions & NumberOptions): Flag<number | undefined, number>;
	url(options: FlagOptions): Flag<URL | undefined, URL>;
	email(options: FlagOptions): Flag<string | undefined, string>;
	directory(options: FlagOptions & PathOptions): Flag<string | undefined, string>;
	file(options: FlagOptions & PathOptions): Flag<string | undefined, string>;
	boolean(options: FlagOptions): Switch<boolean>;
	count(options: FlagOptions): Switch<number>;
	custom<V, O>(parse: Parse<V, O>, valueName?: string): (options: FlagOptions & O) => Flag<V | undefined, V>;
	schema<S extends StandardSchemaV1>(schema: S, valueName?: string): (options: FlagOptions) => Flag<SchemaOutput<S> | undefined, SchemaOutput<S>>;
};
```

| Creator          | Value         | Value name in help    | Notes                                                                |
| ---------------- | ------------- | --------------------- | -------------------------------------------------------------------- |
| `flag.string`    | `string`      | `string`              | [`StringOptions`](./types#stringoptions): `choices` narrows the type |
| `flag.number`    | `number`      | `number`              | [`NumberOptions`](./types#numberoptions): `min`, `max`, `integer`    |
| `flag.url`       | `URL`         | `url`                 |                                                                      |
| `flag.email`     | `string`      | `email`               |                                                                      |
| `flag.directory` | `string`      | `directory`           | Absolute path. [`PathOptions`](./types#pathoptions): `exists`        |
| `flag.file`      | `string`      | `file`                | Absolute path. [`PathOptions`](./types#pathoptions): `exists`        |
| `flag.boolean`   | `boolean`     |                       | Switch, defaults to `false`                                          |
| `flag.count`     | `number`      |                       | Switch, defaults to `0`                                              |
| `flag.custom`    | Your parser's | `valueName` (`value`) | See [`Parse`](./types#parse)                                         |
| `flag.schema`    | Schema output | `valueName` (`value`) | The schema's input must accept a string                              |

## `Flag` {#flag-class}

A flag that takes a value. `T` is the resolved type (e.g. `string[] | undefined`) and `V` is what one value parses to. Extends [`Param`](./types#param).

```ts
class Flag<T, V extends Defined> extends Param<T, V> {
	readonly kind: 'flag';
	readonly options: FlagOptions;
	required(required?: boolean): Flag<…>;
	multiple(allow?: boolean): Flag<…>;
	default(value: DefaultValue<T, V>): Flag<…>;
}
```

| Method            | Effect                                                                            |
| ----------------- | --------------------------------------------------------------------------------- |
| `.required(on?)`  | Must be provided. Clears any default.                                             |
| `.multiple(on?)`  | Repeatable, collected into an array. Converts any existing default (`v` ↔ `[v]`). |
| `.default(value)` | Used when absent. Clears `required`. Must be a non-empty array when `multiple`.   |

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
