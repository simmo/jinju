import { isCI } from './isCI.js';

export const isUnicodeSupported = () => {
	if (process.platform !== 'win32') return process.env.TERM !== 'linux';

	return isCI || process.env.TERM_PROGRAM === 'vscode';
};
