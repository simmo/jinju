import chalk from 'chalk';
import logUpdate from 'log-update';
import prettyHrtime from 'pretty-hrtime';
import { getBorderCharacters, table } from 'table';

import { isUnicodeSupported } from '../Utils/isUnicodeSupported.js';
import { IRendererOptions, Renderer } from '../Utils/Renderer.js';
import { Unit } from '../Utils/Unit.js';

const supportsUnicode = isUnicodeSupported();
const ARROW_DOWN = '↓';
const CROSS = supportsUnicode ? '✖' : '×';
const TICK = supportsUnicode ? '✔' : '√';
const POINTER = '›';
const BOLT = supportsUnicode ? '⚡️' : '≈';

interface INestedRendererOptions extends IRendererOptions {
	readonly compress: boolean;
	readonly progressInterval: number;
	readonly showDuration: boolean;
}

/**
 * Renders the task tree in a nested list, ith status indicators.
 */

export class Nested extends Renderer<INestedRendererOptions> {
	constructor(root: Unit, options: Partial<INestedRendererOptions> = {}) {
		super(root, {
			compress: false,
			progressInterval: 80,
			showDuration: true,
			...options,
		});

		this.#spinnerIntervalId = setInterval(() => {
			this.#spinnerFrameIndex =
				++this.#spinnerFrameIndex % this.#spinnerFrames.length;
			this.update();
		}, this.options.progressInterval);
	}

	#spinnerIntervalId?: ReturnType<typeof setInterval>;

	#spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

	#spinnerFrameIndex = 0;

	#getIndicator(unit: Unit) {
		if (unit.isPending) {
			return chalk.cyan(
				unit.isBranch() ? POINTER : this.#spinnerFrames[this.#spinnerFrameIndex]
			);
		} else if (unit.isResolved) {
			return chalk.green(TICK);
		} else if (unit.isRejected) {
			return chalk.red(CROSS);
		} else if (unit.isAborted) {
			return chalk.dim(CROSS);
		} else if (unit.isSkipped) {
			return chalk.yellowBright(ARROW_DOWN);
		}

		return chalk.dim(
			unit.isBranch() ? POINTER : this.#spinnerFrames[this.#spinnerFrameIndex]
		);
	}

	#generateOutput(unit: Unit, depth = 0): string[][] {
		const indicator = this.#getIndicator(unit);
		const tab = '  '.repeat(1 * depth);
		const items = [
			[
				`${tab}${indicator} ${unit.isSkipped ? chalk.dim(unit.name) : unit.name} ${unit.state}`,
				this.options.showDuration
					? `${chalk.dim(prettyHrtime(unit.duration))}`
					: '',
			],
		];

		if ((unit.isSkipped || unit.isRejected) && unit.stateReason) {
			items.push([`${tab}  ${chalk.dim(unit.stateReason)}`, '']);
		}

		if (unit.isBranch()) {
			const output = [];
			const hasHeader = !unit.is(this.root) && unit.isNamed;

			if (hasHeader) {
				output.push(...items);
			}

			if (
				!unit.isNamed ||
				!unit.isResolved ||
				unit.tasks.some(task => !task.isResolved) ||
				!this.options.compress
			) {
				output.push(
					...unit.tasks.flatMap(task =>
						this.#generateOutput(task, hasHeader ? depth + 1 : depth)
					)
				);
			}

			return output;
		}

		return items;
	}

	update() {
		const output = this.#generateOutput(this.root);

		logUpdate(
			output.length
				? table(output, {
						border: getBorderCharacters('void'),
						columnDefault: {
							paddingLeft: 0,
							paddingRight: 2,
						},
						drawHorizontalLine: () => false,
					})
				: 'nothing'
		);
	}

	stop(unit: Unit) {
		if (unit.is(this.root)) {
			if (this.#spinnerIntervalId) {
				clearInterval(this.#spinnerIntervalId);

				this.#spinnerIntervalId = undefined;
			}

			const duration = ` ${prettyHrtime(this.root.duration)}`;
			const errorCount = this.errors.length;
			const overview = [`${chalk.yellow(BOLT)} Done in${chalk.cyan(duration)}`];

			if (errorCount) {
				overview.push(
					` with ${chalk.red(
						`${errorCount} issue${errorCount === 1 ? '' : 's'}`
					)}`
				);
			}

			console.log(overview.join('') + '\n');

			this.errors.forEach(({ unit, error }) =>
				console.error(
					chalk.red.bold(`Task: ${unit.name}\n`) +
						chalk.dim(error.message) +
						'\n'
				)
			);
		}
	}
}
