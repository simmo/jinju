import { describe, expectTypeOf, test } from 'vitest';

import { arg } from './arg';
import { command } from './command';
import type { CheckTree, CommandTree } from './tree';

const d = { description: 'd' };
const noop = () => {};
const project = arg.string({ name: 'project', ...d }).required();
const env = arg.string({ name: 'env', ...d }).required();
const ok = command({ ...d, args: [project, env], run: noop });

describe('CheckTree', () => {
	test('valid trees resolve to unknown', () => {
		expectTypeOf<CheckTree<{ list: typeof ok }>>().toBeUnknown();
		expectTypeOf<CheckTree<{ ':project': { ':env': { ok: typeof ok } } }>>().toBeUnknown();
		expectTypeOf<CheckTree<{ ':project': { $: typeof ok } }>>().toBeUnknown();
	});

	test('trees without known keys are not checked', () => {
		expectTypeOf<CheckTree<CommandTree>>().toBeUnknown();
	});

	test('errors name the command and segment', () => {
		const none = command({ ...d, run: noop });
		expectTypeOf<CheckTree<{ ':project': { none: typeof none } }>>().toEqualTypeOf<{
			'~error': "Command '<project> none' must have an arg named 'project' at position 1 for segment ':project'";
		}>();
		expectTypeOf<CheckTree<{ ':env': { ':project': { ok: typeof ok } } }>>().toEqualTypeOf<{
			'~error': "Command '<env> <project> ok' must have an arg named 'env' at position 1 for segment ':env'";
		}>();
		const unnamed = command({ ...d, args: [arg.string(d)], run: noop });
		expectTypeOf<CheckTree<{ ':project': { $: typeof unnamed } }>>().toEqualTypeOf<{
			'~error': "Command '<project>' must name arg 1 'project' for segment ':project'";
		}>();
	});

	test('a segment arg cannot be multiple', () => {
		const many = command({
			...d,
			args: [arg.string({ name: 'files', ...d }).multiple()],
			run: noop,
		});
		expectTypeOf<CheckTree<{ ':files': { many: typeof many } }>>().toEqualTypeOf<{
			'~error': "Command '<files> many': segment ':files' can't be a .multiple() arg";
		}>();
	});
});
