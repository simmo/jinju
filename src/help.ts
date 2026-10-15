import { kebabCase } from './case';
import { argLabel, type Command } from './command';
import type { FlagRecord } from './flag';
import { type Param, toParam } from './param';

export interface HelpEntry {
	name: string;
	description: string;
}

export interface HelpContext {
	/** Program name plus command path, e.g. `app sync`. */
	usage: string;
	description?: string;
	command?: Command;
	subcommands: readonly HelpEntry[];
	/** Shared and built-in flags at this level; listed alongside the command's own. */
	globals: FlagRecord;
}

const formatValue = (value: unknown): string =>
	Array.isArray(value) ? value.map(formatValue).join(', ') : String(value);

const tags = (param: Param): string => {
	const { defaultValue, kind, state } = param;
	const result: string[] = [];
	if (state.required) result.push('required');
	if (state.multiple) result.push('multiple');
	if (param.options.choices) result.push(`choices: ${param.options.choices.join(', ')}`);
	if (state.hasDefault && kind !== 'switch') result.push(`default: ${formatValue(defaultValue)}`);
	return result.length > 0 ? ` (${result.join('; ')})` : '';
};

const flagLabel = (key: string, param: Param): string => {
	const { alias } = param.options;
	const names = [`--${kebabCase(key)}`];
	// Defaulting to true, the useful form is `--no-x`; the alias still turns it on.
	if (param.kind === 'switch' && param.defaultValue === true) names[0] = `--[no-]${kebabCase(key)}`;
	if (alias !== undefined) names.unshift(alias.length === 1 ? `-${alias}` : `--${alias}`);
	const value = param.kind === 'switch' ? '' : ` <${param.value.name}>`;
	return names.join(', ') + value;
};

const table = (rows: readonly (readonly [string, string])[]): string => {
	const width = Math.max(...rows.map(([left]) => left.length));
	return rows.map(([left, right]) => `  ${left.padEnd(width)}  ${right}`.trimEnd()).join('\n');
};

/** Visible flags, sorted by long name. */
const flagRows = (flags: FlagRecord) =>
	Object.entries(flags)
		.map(([key, flag]) => [key, toParam(flag)] as const)
		.filter(([, param]) => !param.options.hidden)
		.sort(([a], [b]) => kebabCase(a).localeCompare(kebabCase(b)))
		.map(
			([key, param]) => [flagLabel(key, param), param.options.description + tags(param)] as const,
		);

const usageArg = (param: Param): string => {
	const label = argLabel(param) + (param.state.multiple ? '...' : '');
	return param.state.required ? label : `[${label}]`;
};

export const renderHelp = ({
	command,
	description,
	globals,
	subcommands,
	usage,
}: HelpContext): string => {
	const sections: string[] = [];
	const params = command?.params ?? [];
	const flags = flagRows({ ...globals, ...command?.flags });

	if (description) sections.push(description);

	const lines: string[] = [];
	if (command) {
		const parts = [usage];
		if (flags.length > 0) parts.push('[flags]');
		parts.push(...params.map(usageArg));
		lines.push(parts.join(' '));
	}
	if (subcommands.length > 0) lines.push(`${usage} <command>`);
	sections.push(`Usage:\n${lines.map((line) => `  ${line}`).join('\n')}`);

	if (subcommands.length > 0) {
		sections.push(
			`Commands:\n${table(subcommands.map(({ description, name }) => [name, description]))}`,
		);
	}
	if (params.length > 0) {
		const rows = params.map(
			(param) => [argLabel(param), param.options.description + tags(param)] as const,
		);
		sections.push(`Arguments:\n${table(rows)}`);
	}
	if (flags.length > 0) sections.push(`Flags:\n${table(flags)}`);

	return `${sections.join('\n\n')}\n`;
};
