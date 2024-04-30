import { Branch } from '../Utils/Branch.js';
import { Runner } from '../Utils/types.js';
import { Unit } from '../Utils/Unit.js';

export function race(...tasks: Unit[]): Branch;
export function race(name: string, ...tasks: Unit[]): Branch;
export function race(first: string | Unit, ...rest: Unit[]): Branch {
	const [name, tasks] =
		typeof first === 'string' ? [first, rest] : [undefined, [first, ...rest]];

	const runner: Runner = async () => {
		await Promise.race(tasks.map(task => task.run()));
	};

	return new Branch(runner, tasks, name);
}
