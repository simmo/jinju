import pico from 'picocolors';
import { Symbols } from '../Constants/symbols.js';
import { messageHelper } from '../Utils/formatter.js';

export const success = messageHelper({
	prefix: pico.green(Symbols.Success),
});
