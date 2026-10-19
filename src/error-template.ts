import type { JinjuError } from './errors';
import type { HelpData, HelpPathPart, HelpProgram } from './help';

/** Everything known about a failed run. */
export interface ErrorData {
	program: HelpProgram;
	/** The errors, in the order found. Each is a `JinjuError` subclass with its own details. */
	errors: readonly JinjuError[];
	/** The matched command path, e.g. `<project> deploy`. Empty at the root. */
	path: readonly HelpPathPart[];
	/** The command path as typed, e.g. `['my-site', 'deploy']`. */
	words: readonly string[];
	/** The help page for the matched command, e.g. to show its usage or suggest names. */
	help: HelpData;
}

export interface ErrorTemplateOptions {
	/** Add a "Run '… --help' for usage." line. Defaults to `true`. */
	hint?: boolean;
}

/**
 * Renders error output (printed to stderr) from `ErrorData`. This is the built-in layout;
 * extend it and override any method to change part of it, or `render` to replace it.
 */
export class ErrorTemplate {
	readonly options: Readonly<Required<ErrorTemplateOptions>>;

	constructor(options: ErrorTemplateOptions = {}) {
		this.options = { hint: true, ...options };
	}

	/** The full output. Printed as-is, so it should end with a newline. */
	render(data: ErrorData): string {
		return `${this.sections(data).join('\n\n')}\n`;
	}

	/** The output's sections, in order. Empty strings are left out. */
	sections(data: ErrorData): string[] {
		return [this.formatErrors(data), this.options.hint ? this.formatHint(data) : ''].filter(
			Boolean,
		);
	}

	formatErrors(data: ErrorData): string {
		return data.errors.map((error) => this.formatError(error)).join('\n');
	}

	formatError(error: JinjuError): string {
		return `error: ${error.message}`;
	}

	formatHint(data: ErrorData): string {
		return `Run '${this.formatCommand(data)} --help' for usage.`;
	}

	/** The command as typed, e.g. `app my-site deploy`. */
	formatCommand(data: ErrorData): string {
		return [data.program.name, ...data.words].join(' ');
	}
}
