import { magenta } from 'yoctocolors';

import { Symbols } from '../Constants/symbols.js';
import { messageHelper } from '../Utils/formatter.js';

export const celebrate = messageHelper({
	prefix: magenta(Symbols.Celebrate),
});
