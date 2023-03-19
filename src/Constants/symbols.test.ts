import isUnicodeSupported from 'is-unicode-supported';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('is-unicode-supported');

describe('symbols', () => {
	beforeEach(() => {
		vi.resetModules();
	});

	it('returns an object of standard symbols', async () => {
		vi.mocked(isUnicodeSupported).mockReturnValue(true);

		const { Symbols } = await import('./symbols');

		expect(Symbols).toMatchSnapshot();
	});

	it('returns an object of fallback symbols', async () => {
		vi.mocked(isUnicodeSupported).mockReturnValue(false);

		const { Symbols } = await import('./symbols');

		expect(Symbols).toMatchSnapshot();
	});
});
