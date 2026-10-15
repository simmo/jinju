import { describe, expect, test } from 'vitest';

import { arg } from './arg';
import { toParam } from './param';

const d = { description: 'd' };

describe('creators', () => {
	test.each([
		['string', arg.string(d)],
		['number', arg.number(d)],
		['url', arg.url(d)],
		['email', arg.email(d)],
		['directory', arg.directory(d)],
		['file', arg.file(d)],
	])('%s is an optional arg', (name, created) => {
		const param = toParam(created);
		expect(param.kind).toBe('arg');
		expect(param.value.name).toBe(name);
		expect(param.state).toEqual({ required: false, multiple: false, hasDefault: false });
	});

	test('keeps the display name', () => {
		expect(toParam(arg.file({ ...d, name: 'source' })).options.name).toBe('source');
	});

	test('passes creator options to the parser', async () => {
		const param = toParam(arg.string({ ...d, choices: ['a', 'b'] }));
		expect(await param.resolve(['a'], '<x>')).toEqual({ ok: true, value: 'a' });
		expect(await param.resolve(['c'], '<x>')).toMatchObject({ ok: false });
	});
});

describe('modifiers', () => {
	test('return args', () => {
		const base = arg.number(d);
		for (const modified of [base.required(), base.multiple(), base.default(1)]) {
			expect(toParam(modified).kind).toBe('arg');
		}
	});

	test('multiple resolves to arrays', async () => {
		const param = toParam(arg.number(d).multiple().required());
		expect(await param.resolve(['1', '2'], '<x>')).toEqual({ ok: true, value: [1, 2] });
	});
});

test('custom', async () => {
	const upper = arg.custom((input) => input.toUpperCase(), 'word');
	const param = toParam(upper(d));
	expect(param.value.name).toBe('word');
	expect(await param.resolve(['a'], '<x>')).toEqual({ ok: true, value: 'A' });
});
