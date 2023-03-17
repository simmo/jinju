import pico from 'picocolors';
import { Symbols } from '../Constants/symbols.js';
import { messageHelper } from '../Utils/formatter.js';

export const debug = messageHelper({
	prefix: pico.dim(Symbols.Debug),
});
