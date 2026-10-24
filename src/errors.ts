/** Base class for every error Jinju produces. User `run` handlers may throw these too. */
export class JinjuError extends Error {
	override name = 'JinjuError';
}

/** Thrown synchronously when flags, args or commands are defined in a conflicting way. */
export class ConfigError extends JinjuError {
	override name = 'ConfigError';
}

export class UnknownCommandError extends JinjuError {
	override name = 'UnknownCommandError';

	constructor(readonly command: string) {
		super(`Unknown command '${command}'`);
	}
}

export class UnknownFlagError extends JinjuError {
	override name = 'UnknownFlagError';

	constructor(readonly flag: string) {
		super(`Unknown flag '${flag}'`);
	}
}

export class UnexpectedArgError extends JinjuError {
	override name = 'UnexpectedArgError';

	constructor(readonly arg: string) {
		super(`Unexpected argument '${arg}'`);
	}
}

export class MissingRequiredError extends JinjuError {
	override name = 'MissingRequiredError';

	constructor(readonly label: string) {
		super(`Missing required ${label}`);
	}
}

export class MissingValueError extends JinjuError {
	override name = 'MissingValueError';

	constructor(readonly label: string) {
		super(`${label} requires a value`);
	}
}

export class DuplicateFlagError extends JinjuError {
	override name = 'DuplicateFlagError';

	constructor(readonly label: string) {
		super(`${label} can only be provided once`);
	}
}

export class InvalidValueError extends JinjuError {
	override name = 'InvalidValueError';

	constructor(
		readonly label: string,
		readonly input: string,
		readonly reason: string,
	) {
		super(`Invalid value '${input}' for ${label}: ${reason}`);
	}
}
