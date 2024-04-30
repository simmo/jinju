import { setTimeout } from 'timers/promises';

import { intro, parallel, series, task } from './index.js';

// import { Log } from './Renderers/Log.js';
import { Nested } from './Renderers/Nested.js';

const validateNode = task('Validate Node', async ({ skip }) => {
	if (Math.random() > 0.5) {
		throw skip('Skipping validation of Node');
	}

	await setTimeout(1000);
});

const validateAuth = task('Validate Authentication', async () => {
	await setTimeout(1000);
});

intro('FABRiC');

await series(
	parallel('Prepare', validateNode, validateAuth),
	parallel(
		series(
			'Test Content',
			task('Authenticate with AWS', async () => {
				await setTimeout(1000);
				throw new Error('Failed to synchronise content');
			}),
			task('Synchronising content', async () => {
				await setTimeout(1000);
			})
		),
		series(
			'Services',
			task('Stop existing services', async () => {
				await setTimeout(1000);
			}),
			parallel(
				'File Server',
				task('HTTP', async () => {
					await setTimeout(1000);
				}),
				task('HTTPS', async () => {
					await setTimeout(1000);
					throw new Error('Failed to start HTTPS server');
				})
			),
			task('Runner', async () => {
				await setTimeout(1000);
			}),
			task('Proxy', async () => {
				await setTimeout(1000);
			})
		)
	)
).run({ renderer: Nested, rendererOptions: { exitOnError: true } });
