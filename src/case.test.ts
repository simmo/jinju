import { expect, test } from 'vitest';

import { kebabCase } from './case';

test.each([
	['name', 'name'],
	['dryRun', 'dry-run'],
	['repeatSyncAll', 'repeat-sync-all'],
	['v2Api', 'v2-api'],
	['already-kebab', 'already-kebab'],
	['URL', 'url'],
])('%s → %s', (input, expected) => {
	expect(kebabCase(input)).toBe(expected);
});
