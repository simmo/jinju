import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		coverage: {
			include: ['src/**/*.ts'],
			exclude: ['src/example.ts', 'src/**/*.test.ts'],
			reporter: ['text'],
		},
		typecheck: {
			enabled: true,
			include: ['src/**/*.test.ts'],
		},
	},
});
