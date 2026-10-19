import { readFileSync, statSync } from 'node:fs';
import { dirname, join, parse } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ConfigError } from './errors';

/**
 * Reads `version` from the nearest `package.json` at or above `from`: usually the CLI's own
 * `import.meta.url`. Pass the result as `jinju({ version })`.
 */
export const packageVersion = (from: string | URL): string => {
	const path = typeof from === 'string' && !from.startsWith('file:') ? from : fileURLToPath(from);
	const start = statSync(path, { throwIfNoEntry: false })?.isDirectory() ? path : dirname(path);

	for (let dir = start; ; dir = dirname(dir)) {
		const file = join(dir, 'package.json');
		if (statSync(file, { throwIfNoEntry: false })?.isFile()) {
			const { version } = JSON.parse(readFileSync(file, 'utf8')) as { version?: unknown };
			if (typeof version !== 'string') throw new ConfigError(`No version in ${file}`);
			return version;
		}
		if (dir === parse(dir).root) throw new ConfigError(`No package.json found above ${path}`);
	}
};
