import { stdout } from 'node:process';
import { WriteStream } from 'node:tty';

import { dim } from 'yoctocolors';

import { spinner } from '../Helpers/spinner.js';

interface Options {
	prefix?: string;
	stream?: WriteStream;
}

export const messageHelper =
	({ prefix, stream = stdout }: Options = {}) =>
	(message: string, context?: string) => {
		const text: string[] = [message];

		if (prefix) text.unshift(prefix);

		if (context) text.push(dim(context));

		spinner.clear();

		stream.write(`${text.join(' ')}\n`);

		spinner.render();
	};
