import { custom } from './custom.js';

export const url = custom({
	parse: (value) => {
		try {
			return new URL(value);
		} catch {
			throw new Error(`Value '${value}' is not a valid URL`);
		}
	},
});
