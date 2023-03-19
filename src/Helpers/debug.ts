import pico from 'picocolors';

import { Symbols } from '../Constants/symbols.js';
import { messageHelper } from '../Utils/formatter.js';

import { config } from './config.js';

export const debug = (message: string) => {
	const helper = messageHelper({
		prefix: pico.dim(Symbols.Debug),
	});

	if (config.debug) helper(message);
};
