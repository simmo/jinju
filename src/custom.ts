import { Flag } from './Flag.js';

interface Config<TMultiple extends boolean = boolean> {
	allowMultiple?: TMultiple;
	alias?: string;
	description?: string;
}

export const custom = <TOptions extends object, TOutput>(config: {
	parse: (value: string, options: TOptions) => TOutput;
}) => {
	return <TMultiple extends boolean = false>(
		options?: TOptions & Config<TMultiple>,
	): Flag<TOutput, TMultiple, true> => {
		const {
			allowMultiple = false,
			alias,
			description,
			...customOptions
		} = (options ?? {}) as Config<boolean> & TOptions;

		const parseSingle = (value: string) => config.parse(value, customOptions as TOptions);

		return new Flag<TOutput, TMultiple, true>({
			parseSingle,
			allowMultiple,
			required: false,
			defaultValue: undefined,
			alias,
			description,
		});
	};
};
