/** `dryRun` → `dry-run` */
export const kebabCase = (value: string): string =>
	value.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
