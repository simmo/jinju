import { yellow } from 'yoctocolors';

import { Symbols } from '../Constants/symbols.js';
import { messageHelper } from '../Utils/formatter.js';

export const warn = messageHelper({
	prefix: yellow(Symbols.Warning),
});
