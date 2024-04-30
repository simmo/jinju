import { State } from '../Constants/State.js';
import { Log, Nested } from '../Renderers';

import { Branch } from './Branch';
import { isCI } from './isCI.js';
import { isInteractive } from './isInteractive.js';
import { Renderer } from './Renderer.js';
import type { Runner, Timestamp } from './types.js';

let rendererInstance: Renderer;

const fallbackRenderer = isInteractive() && !isCI() ? Nested : Log;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type TRenderer = new (...args: any[]) => Renderer;
export type TRendererOptions<T extends TRenderer> = ConstructorParameters<T>[1];

export interface IRunConfig<
	T extends TRenderer,
	O extends TRendererOptions<T>,
> {
	renderer?: T;
	rendererOptions?: O;
}

export class Unit {
	static ABORT = Symbol('ABORT');

	static SKIP = Symbol('SKIP');

	name = '';

	constructor(runner: Runner, name: string) {
		this.#runner = runner;
		this.name = name;
	}

	#id = Symbol();

	#runner: Runner;

	#state: State = State.Idle;

	#stateReason?: string;

	startTime?: Timestamp;

	#duration?: Timestamp;

	#display: string = this.name;

	is(unit: Unit) {
		return this === unit;
	}

	isBranch(): this is Branch {
		return this instanceof Branch;
	}

	get id(): symbol {
		return this.#id;
	}

	get isIdle(): boolean {
		return this.#state === State.Idle;
	}

	get isPending(): boolean {
		return this.#state === State.Pending;
	}

	get isResolved(): boolean {
		return this.#state === State.Resolved;
	}

	get isRejected(): boolean {
		return this.#state === State.Rejected;
	}

	get isAborted(): boolean {
		return this.#state === State.Aborted;
	}

	get isComplete(): boolean {
		return (
			this.#state ===
			(State.Rejected & State.Resolved & State.Skipped & State.Aborted)
		);
	}

	get isSkipped(): boolean {
		return this.#state === State.Skipped;
	}

	get state(): State {
		return this.#state;
	}

	get stateReason(): string | undefined {
		return this.#stateReason;
	}

	get duration(): Timestamp {
		if (this.isIdle) {
			return [0, 0];
		}

		return this.#duration ?? process.hrtime(this.startTime);
	}

	get display(): string {
		return this.#display;
	}

	#skip(message?: string): typeof Unit.SKIP {
		this.#stateReason = message;

		return Unit.SKIP;
	}

	abort(message?: string) {
		this.#state = State.Aborted;
		this.#stateReason = message;

		return Unit.ABORT;
	}

	async run<T extends TRenderer, O extends TRendererOptions<T>>(
		config: IRunConfig<T, O> = {}
	): Promise<void> {
		if (!rendererInstance) {
			rendererInstance = new (config.renderer ?? fallbackRenderer)(
				this,
				config.rendererOptions
			);
		}

		this.#state = State.Pending;
		this.startTime = process.hrtime();
		rendererInstance.update(this);

		return this.#runner({
			abort: this.abort.bind(this),
			skip: this.#skip.bind(this),
		})
			.then(() => {
				if (!this.isSkipped) {
					this.#state = State.Resolved;
				}

				rendererInstance.update(this);
			})
			.catch(error => {
				if (error === Unit.SKIP) {
					this.#state = State.Skipped;
					rendererInstance.update(this);
				} else if (error === Unit.ABORT) {
					this.#state = State.Aborted;
					rendererInstance.update(this);
				} else {
					this.#state = State.Rejected;
					this.#stateReason = error.message;

					rendererInstance.addError(this, error);
					rendererInstance.update(this);

					throw error;
				}
			})
			.finally(() => {
				this.#duration = process.hrtime(this.startTime);
				rendererInstance.stop(this);
			});
	}
}
