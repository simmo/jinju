import { isCI } from './isCI.js';

export const isInteractive = () =>
	Boolean(
		process.stdout &&
			process.stdout.isTTY &&
			process.env.TERM !== 'dumb' &&
			!isCI()
	);
