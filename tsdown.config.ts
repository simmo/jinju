import { defineConfig } from 'tsdown';

export default defineConfig({
	entry: ['./src/index.ts'],
	format: 'esm',
	platform: 'node',
	// Declaration maps would point into `src`, which isn't published.
	dts: { sourcemap: false },
	// The JS map embeds the source, so stack traces stay readable without `src`.
	sourcemap: true,
	// Keep `.js` / `.d.ts` (the package is `"type": "module"`), matching `exports`.
	fixedExtension: false,
});
