import { Runner } from './types.js';
import { Unit } from './Unit.js';

export class Branch extends Unit {
	isNamed: boolean;

	constructor(
		runner: Runner,
		public tasks: Unit[],
		name?: string
	) {
		super(runner, name ?? '<branch>');

		this.isNamed = typeof name === 'string';
	}
}
