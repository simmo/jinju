import pico from 'picocolors';
import { stdout } from 'node:process';
import { spinner } from '../Helpers/spinner.js';
import { WriteStream } from 'node:tty';

interface Options {
	prefix?: string;
	stream?: WriteStream;
}

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
