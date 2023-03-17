import pico from 'picocolors';
import { Symbols } from '../Constants/symbols.js';
import { messageHelper } from '../Utils/formatter.js';

export const celebrate = messageHelper({
	prefix: pico.magenta(Symbols.Celebrate),
});
