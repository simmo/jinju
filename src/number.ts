import { custom } from './custom.js';

export const number = custom({
	parse: (value, options: { min?: number; max?: number }) => {
		const n = Number(value);

		if (options.min !== undefined && n < options.min)
			throw new Error(`Value '${n}' must be at least ${options.min}`);

		if (options.max !== undefined && n > options.max)
			throw new Error(`Value '${n}' must be at most ${options.max}`);

		return n;
	},
});
