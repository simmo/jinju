import { Unit } from './Unit.js';

export type Runner = (task: {
	abort: (message?: string) => typeof Unit.ABORT;
	skip: (message?: string) => typeof Unit.SKIP;
}) => Promise<void>;

export type Timestamp = [seconds: number, nanoseconds: number];
