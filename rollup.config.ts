import typescript from '@rollup/plugin-typescript';
import { defineConfig } from 'rollup';
import { dts } from 'rollup-plugin-dts';

export default defineConfig([
	{
		input: './src/index.ts',
		output: {
			file: 'dist/index.js',
			format: 'esm',
			sourcemap: true,
		},
		plugins: [
			typescript({
				filterRoot: false,
				exclude: ['**/*.{config,test}.ts', 'src/example.ts'],
			}),
		],
		external: [/^node:/],
	},
	{
		input: './src/index.ts',
		output: {
			file: 'dist/index.d.ts',
		},
		plugins: [dts()],
	},
]);
