import { stdout } from 'node:process';
import { cursorTo } from 'node:readline';
import { clearInterval, setInterval } from 'node:timers';

import pico from 'picocolors';
import { cursor } from 'sisteransi';

class Spinner {
	#frames = stdout.isTTY
		? ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
		: ['-'];
	#isSpinning = false;
	#interval = 80;
	#text?: string;
	#frameIndex = 0;
	#tick?: ReturnType<typeof setInterval>;

	get #frame() {
		const frame = this.#frames.at(this.#frameIndex);

		return `${pico.blue(frame)} ${this.#text}`;
	}

	clear() {
		if (!this.#isSpinning) return;

		cursorTo(stdout, 0);

		stdout.clearLine(1);
	}

	render() {
		if (!this.#isSpinning) return;

		this.clear();

		this.#frameIndex = ++this.#frameIndex % this.#frames.length;

		stdout.write(this.#frame);
	}

	get isSpinning() {
		return this.#isSpinning;
	}

	set text(message: string) {
		this.#text = message;

		this.render();
	}

	/**
	 * Starts the spinner and adds to output
	 */

	start(message: string) {
		this.#frameIndex = 0;
		this.text = message;
		this.#isSpinning = true;

		stdout.write(cursor.hide);

		this.render();

		this.#tick = setInterval(this.render.bind(this), this.#interval);
	}

	stop() {
		clearInterval(this.#tick);

		this.clear();

		stdout.write(cursor.show);

		this.#isSpinning = false;
	}
}

export const spinner = new Spinner();
