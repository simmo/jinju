import { Branch } from '../Utils/Branch.js';
import { Runner } from '../Utils/types.js';
import { Unit } from '../Utils/Unit.js';

/**
 * Runs all tasks at the same time.
 * If a task fails, the remaining tasks are not impacted and will continue to execute.
 */

export function parallel(...tasks: Unit[]): Branch;
export function parallel(name: string, ...tasks: Unit[]): Branch;
export function parallel(first: string | Unit, ...rest: Unit[]): Branch {
	const [name, tasks] =
		typeof first === 'string' ? [first, rest] : [undefined, [first, ...rest]];

	const runner: Runner = async () => {
		await Promise.all(tasks.map(task => task.run().catch((): null => null)));
	};

	return new Branch(runner, tasks, name);
}
