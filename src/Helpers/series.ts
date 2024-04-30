import { Branch } from '../Utils/Branch.js';
import { Runner } from '../Utils/types.js';
import { Unit } from '../Utils/Unit.js';

/**
 * Runs each task in the order they are provided.
 * If a task fails, the remaining tasks are aborted and series group is marked as aborted.
 */

export function series(...tasks: Unit[]): Branch;
export function series(name: string, ...tasks: Unit[]): Branch;
export function series(name: string, ...tasks: Unit[]): Branch;
export function series(first: string | Unit, ...rest: Unit[]): Branch {
	const [name, tasks] =
		typeof first === 'string' ? [first, rest] : [undefined, [first, ...rest]];

	let hasError = false;

	const runner: Runner = async ({ abort }) => {
		await tasks
			.reduce(async (previousTask, nextUnit) => {
				await previousTask.catch(() => {
					hasError = true;
				});

				if (hasError) {
					nextUnit.abort();

					return Promise.resolve();
				}

				return nextUnit.run();
			}, Promise.resolve())
			.finally(() => {
				if (hasError) {
					throw abort();
				}
			});
	};

	return new Branch(runner, tasks, name);
}
