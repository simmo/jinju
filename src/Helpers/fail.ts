import { stderr } from 'node:process';

import pico from 'picocolors';

import { Symbols } from '../Constants/symbols.js';
import { messageHelper } from '../Utils/formatter.js';

export const fail = messageHelper({
	prefix: pico.red(Symbols.Error),
	stream: stderr,
});
