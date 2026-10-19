import { arg, flag, jinju, packageVersion, scope } from './index';

// Shared by every command: accepted before or after the command name.
const app = scope({
	flags: { verbose: flag.count({ alias: 'v', description: 'Increase verbosity' }) },
});

// A nested scope: these commands all start with a <files> arg.
const files = app.scope({
	args: [arg.directory({ name: 'files', description: 'Path to the files' }).required()],
});

const repeat = flag.boolean({ alias: 'r', description: 'Repeat the operation' });

const sync = files.command({
	description: 'Sync files',
	flags: {
		repeat,
		mode: flag.string({ description: 'Sync mode', choices: ['fast', 'safe'] }).default('safe'),
	},
	run: ({ args: [path], flags }) => {
		console.log('sync', { path, ...flags });
	},
});

const repeatSync = files.command({
	description: 'Sync files repeatedly',
	flags: {
		repeat: repeat.default(true),
		times: flag.number({ description: 'Times', min: 1, integer: true }).required(),
	},
	run: ({ args: [path], flags }) => {
		console.log('repeat-sync', { path, ...flags });
	},
});

const copy = app.command({
	description: 'Copy sources into a destination',
	args: [
		arg.file({ name: 'source', description: 'Files to copy' }).multiple(),
		arg.directory({ name: 'dest', description: 'Destination' }).required(),
	],
	run: ({ args: [sources, dest], flags }) => {
		console.log('copy', { sources, dest, ...flags });
	},
});

// A dynamic segment: `example my-site deploy staging` captures `my-site` into <project>.
const project = app.scope({
	args: [arg.string({ name: 'project', description: 'Project to work on' }).required()],
});

const deploy = project.command({
	description: 'Deploy a project',
	args: [arg.string({ name: 'env', description: 'Environment', choices: ['staging', 'prod'] })],
	run: ({ args: [name, env], flags }) => {
		console.log('deploy', { name, env, ...flags });
	},
});

await jinju({
	name: 'example',
	version: packageVersion(import.meta.url),
	description: 'jinju example program',
	commands: { sync: { $: sync, repeat: repeatSync }, copy, ':project': { deploy } },
}).run();
