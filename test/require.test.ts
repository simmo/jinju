import { createRequire } from 'node:module';

import { describe, expect, test } from 'vitest';

// Types come from `src`: `dist` doesn't exist when `npm run typecheck` runs.
import type * as Jinju from '../src/index';

// Node's own `require()`, not vitest's module loader, so this exercises Node loading the
// ESM build into CommonJS (Node >= 22.12) and resolving `jinju` through `exports`.
const require = createRequire(import.meta.url);

const load = () => require('jinju') as typeof Jinju;

describe("require('jinju')", () => {
	test('loads the built package', () => {
		expect(require.resolve('jinju')).toMatch(/[/\\]dist[/\\]index\.js$/);
		const { HelpTemplate, jinju } = load();
		expect(typeof jinju).toBe('function');
		expect(new HelpTemplate()).toBeInstanceOf(HelpTemplate);
	});

	test('runs a command', async () => {
		const { jinju, arg, command, flag } = load();
		let received: unknown;
		const program = jinju({
			name: 'app',
			exit: () => {},
			commands: {
				add: command({
					description: 'Add numbers',
					args: [arg.number({ name: 'n', description: 'Numbers' }).multiple().required()],
					flags: { verbose: flag.boolean({ alias: 'v', description: 'Verbose' }) },
					run: ({ args: [numbers], flags }) => {
						received = { sum: numbers.reduce((a, b) => a + b, 0), verbose: flags.verbose };
					},
				}),
			},
		});

		expect(await program.run(['add', '1', '2', '3', '-v'])).toBe(0);
		expect(received).toEqual({ sum: 6, verbose: true });
	});
});
