import { green } from 'yoctocolors';

import { Symbols } from '../Constants/symbols.js';
import { messageHelper } from '../Utils/formatter.js';

export const success = messageHelper({
	prefix: green(Symbols.Success),
});
