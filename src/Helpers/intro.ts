import { cursor } from 'sisteransi';

import { header } from '../Utils/formatter.js';

export const intro = (value: string) => {
	process.stdout.write(`${cursor.hide}${header(` ${value} `)}\n\n`);
};
