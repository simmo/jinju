import { Unit } from './Unit.js';

export interface IRendererOptions {
	exitOnError: boolean;
}

export abstract class Renderer<
	TOptions extends IRendererOptions = IRendererOptions,
> {
	errors: { unit: Unit; error: Error }[] = [];

	public readonly options: TOptions;

	constructor(
		public root: Unit,
		options: Partial<TOptions> = {}
	) {
		this.options = { exitOnError: true, ...options } as TOptions;
	}

	addError(unit: Unit, error: Error) {
		this.errors.push({ unit, error });
	}

	abstract update(unit?: Unit): void;

	abstract stop(unit: Unit): void;
}
