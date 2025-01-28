import { stderr } from 'node:process';

import { red } from 'yoctocolors';

import { Symbols } from '../Constants/symbols.js';
import { messageHelper } from '../Utils/formatter.js';

export const fail = messageHelper({
	prefix: red(Symbols.Error),
	stream: stderr,
});
