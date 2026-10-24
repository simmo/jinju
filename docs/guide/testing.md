---
description: Test a CLI in-process by injecting argv, env, stdout, stderr, the exit code and cancellation.
---

# Testing

A program's input and output can all be injected, so a CLI can be tested in-process without spawning Node or touching `process`:

- `run(argv)` takes argv directly
- `stdout` and `stderr` receive output
- `exit` receives the exit code instead of setting `process.exitCode`
- `env` replaces `process.env` for flags' environment variables

```ts twoslash
import { arg, command, jinju } from 'jinju';
import { expect, test } from 'vitest';

const greet = command({
	description: 'Greet someone',
	args: [arg.string({ name: 'name', description: 'Who to greet' }).required()],
	run: ({ args: [name] }) => {
		console.log(`Hello, ${name}!`);
	},
});

const setup = () => {
	const output = { stdout: '', stderr: '' };
	const app = jinju({
		name: 'greet',
		commands: { $: greet },
		env: {},
		stdout: (text) => (output.stdout += text),
		stderr: (text) => (output.stderr += text),
		exit: () => {},
	});
	return { app, output };
};

test('requires a name', async () => {
	const { app, output } = setup();

	expect(await app.run([])).toBe(1);
	expect(output.stderr).toContain('Missing required argument <name>');
});
```

`stdout` only receives Jinju's own output (help and version). Output your `run` handlers write is up to you. For testable handlers, pass dependencies such as a logger in from the outside.

## Testing commands directly

A command's `parse(argv, options?)` method parses input without a program, and resolves to `{ ok: true, value }` or `{ ok: false, errors }`:

```ts twoslash
import { command, flag } from 'jinju';
// ---cut---
const serve = command({
	description: 'Serve',
	flags: { port: flag.number({ description: 'Port' }).default(8080) },
	run: () => {},
});

const result = await serve.parse(['--port', '3000']);
if (result.ok) result.value.flags; // { port: 3000 }
```

## Snapshotting help

`app.help(path?)` returns a help page as a string, which is handy for snapshot tests:

```ts
expect(app.help(['sync'])).toMatchSnapshot();
```

## Cancellation

To test how a command handles [cancellation](./commands#cancellation), pass your own `AbortSignal` to `run` instead of sending a real signal, and abort it once the command has started:

```ts twoslash
import { command, jinju } from 'jinju';
import { expect, test } from 'vitest';

const started = Promise.withResolvers<void>();
const wait = command({
	description: 'Wait until cancelled',
	run: ({ signal }) =>
		new Promise<void>((resolve) => {
			signal.addEventListener('abort', () => resolve());
			started.resolve();
		}),
});

test('stops when cancelled', async () => {
	const app = jinju({ commands: { wait }, signals: [], exit: () => {} });
	const controller = new AbortController();

	const running = app.run(['wait'], { signal: controller.signal });
	await started.promise;
	controller.abort();

	expect(await running).toBe(130);
});
```

> [!TIP]
> Set `signals: []` on programs in tests. Otherwise a running command also listens for the test runner's own `SIGINT` and `SIGTERM`, and stopping the tests could cancel it instead.
