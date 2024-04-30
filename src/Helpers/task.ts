import type { Runner } from '../Utils/types.js';
import { Unit } from '../Utils/Unit.js';

export const task = (name: string, action: Runner): Unit => {
	return new Unit(action, name);
};
