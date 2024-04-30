<br/>

<div align="center">

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="./.github/assets/logo-dark.svg">
	<img alt="Jinju logo" src="./.github/assets/logo-light.svg" width="100">
</picture>

<small>Opinionated Node CLI Toolkit</small>

![npm (latest)](https://img.shields.io/npm/v/jinju/latest?color=00b894&label=latest&style=flat) ![npm (beta)](https://img.shields.io/npm/v/jinju/beta?color=0984e3&label=beta&style=flat) ![GitHub Workflow Status](https://img.shields.io/github/actions/workflow/status/simmo/jinju/ci.yml?style=flat)

</div>

---

## API

Jump to:

- [`celebrate`](#celebrate)
- [`debug`](#debug)
- [`fail`](#fail)
- [`spinner`](#spinner)
- [`success`](#success)
- [`warn`](#warn)

### Task Running

#### task

A task represents a single unit of work. It accepts a `name` and a `callback` function. The `callback` function can be synchronous or asynchronous.

#### series

Branches and runs the provided tasks one by one. If a task fails, the series stops, preventing the next tasks in sequence from starting.

#### parallel

Branches and runs the provided tasks concurrently. If a task fails, the parallel stops, but the other tasks continue to run.

#### race

Branches and runs the provided tasks concurrently. The branch completes when the first task has completed. Other tasks may continue to run, but do not impact the running of the branch.

### Celebrate

```ts
celebrate(message: string, context?: string)
```

Renders a celebration `message`, with optional `context`. If `context` is provided it is rendered dimmer than the `message`.

> 💡
> Much like [`success`](#success), it can be used as a different type of positive message, like completing the process.

#### Example

```ts
import { celebrate } from 'jinju';

celebrate('Complete!');

celebrate('Complete!', 'On server A');
```

### Debug

```ts
debug(message: string)
```

Renders a debug `message`.

> 💡
> Provides additional information without distracting from the core message output.

#### Example

Debug is enabled by default.

```ts
import { debug } from 'jinju';

debug('Found record');
```

You can disable debug message by setting the `config`'s `debug` value to `false`. In the example below the debug message will not be output.

```ts
import { config, debug } from 'jinju';

config.debug = false;

debug('Found record');
```

### Fail

```ts
fail(message: string, context?: string)
```

Renders a failure `message`, with optional `context`. If `context` is provided it is rendered dimmer than the `message`.

> 💡
> Can be used to indicate a failure or error.

#### Example

```ts
import { fail } from 'jinju';

fail('Could not read file');

fail('Could not read file', './config.json');
```

### Spinner

Returns a spinner instance.

> 💡
> Showing feedback during asynchronous processes.

#### `spinner.start(message: string)`

Starts the spinner with the provided message.

#### `spinner.text`

Can be used to update the spinner's message.

#### `spinner.stop()`

Stops the spinner and removes it from the output.

> **Note**
> If you don't call `spinner.stop()`, the process will not end until explicitly exited.

#### Example

```ts
import { spinner } from 'jinju';

spinner.start('Running some process');

await someProcess();

spinner.text = 'Running another process';

await anotherProcess();

spinner.stop();
```

### Success

```ts
success(message: string, context?: string)
```

Renders a success `message`, with optional `context`. If `context` is provided it is rendered dimmer than the `message`.

> 💡
> Can be used to indicate an action has resolved as expected.

#### Example

```ts
import { success } from 'jinju';

success('Connected to server');

success('Connected to server', 'https://a.server.com');
```

### Warn

```ts
warn(message: string, context?: string)
```

Renders a warning `message`, with optional `context`. If `context` is provided it is rendered dimmer than the `message`.

> 💡
> Can be used to provide awareness to a non-ideal resolution.

#### Example

```ts
import { success } from 'jinju';

success('Connected to server');

success('Connected to server', 'https://a.server.com');
```
