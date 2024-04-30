import { stdout } from 'node:process';
import { WriteStream } from 'node:tty';

import pico from 'picocolors';

import { spinner } from '../Helpers/spinner.js';

interface Options {
	prefix?: string;
	stream?: WriteStream;
}

export const header = (value: string) =>
	pico.bold(pico.white(pico.bgBlack(value)));

export const messageHelper =
	({ prefix, stream = stdout }: Options = {}) =>
	(message: string, context?: string) => {
		const text: string[] = [message];

		if (prefix) text.unshift(prefix);

		if (context) text.push(pico.dim(context));

		spinner.clear();

		stream.write(`${text.join(' ')}\n`);

		spinner.render();
	};
