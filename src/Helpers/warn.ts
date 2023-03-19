import pico from 'picocolors';

import { Symbols } from '../Constants/symbols.js';
import { messageHelper } from '../Utils/formatter.js';

export const warn = messageHelper({
	prefix: pico.yellow(Symbols.Warning),
});
