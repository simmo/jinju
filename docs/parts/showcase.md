<!-- The home page hero's code example, rendered by `HeroShowcase.vue`. Keep it short. -->

```ts twoslash
import { arg, command, flag, jinju } from 'jinju';
// ---cut---
const deploy = command({
	description: 'Deploy a site',
	args: [arg.string({ name: 'site', description: 'Site' }).required()],
	flags: {
		env: flag.string({ description: 'Env', choices: ['dev', 'prod'] }),
		force: flag.boolean({ alias: 'f', description: 'Skip checks' }),
	},
	run: ({ args: [site], flags: { env, force } }) => {
		//                            ^?
	},
});

const app = jinju({ commands: { ':site': { deploy } } });

await app.run();

// $ app my-site deploy --env prod -f
```
