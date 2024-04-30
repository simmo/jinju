import chalk from 'chalk';
import prettyHrtime from 'pretty-hrtime';

import { Renderer } from '../Utils/Renderer.js';
import { Unit } from '../Utils/Unit.js';

export class Log extends Renderer {
	#log(...segments: string[]) {
		const now = new Date();
		const timestamp = chalk.dim(
			`[${[now.getHours(), now.getMinutes(), now.getSeconds()]
				.map(seg => seg.toString().padStart(2, '0'))
				.join(':')}]`
		);

		console.log(timestamp, ...segments);
	}

	#logUnit(unit: Unit) {
		if (unit.isPending) {
			this.#log(unit.name, chalk.blue('started'));
		} else if (unit.isResolved) {
			this.#log(
				unit.name,
				`${chalk.green('finished')} in`,
				chalk.cyan(prettyHrtime(unit.duration))
			);
		} else if (unit.isSkipped) {
			this.#log(
				unit.name,
				`${chalk.yellow('skipped')} after`,
				chalk.cyan(prettyHrtime(unit.duration))
			);
		} else if (unit.isRejected) {
			this.#log(
				unit.name,
				`${chalk.red('failed')} after`,
				chalk.cyan(prettyHrtime(unit.duration))
			);
		}
	}

	update(unit: Unit) {
		if (!unit.isBranch() || (unit.isBranch() && unit.isNamed)) {
			this.#logUnit(unit);
		}
	}

	stop(unit: Unit) {
		if (unit.is(this.root)) {
			this.#log('Finished in', chalk.cyan(prettyHrtime(this.root.duration)));

			this.errors.forEach(({ error }) =>
				console.error(error.stack || error.name)
			);
		}
	}
}
