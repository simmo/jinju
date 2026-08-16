import { custom } from './custom.js';

export const boolean = custom({
	parse: (value) => {
		if (value === 'true') return true;
		if (value === 'false') return false;

		throw new Error(`Value '${value}' must be 'true' or 'false'`);
	},
});
