---
layout: home

# The hero's code example comes from `docs/parts/showcase.md` (see `HeroShowcase.vue`).
hero:
  name: Jinju
  text: Type-safe CLIs for Node
  tagline: Define flags, args and commands separately, compose them, and get fully typed input. Help, errors and exit codes are handled for you.
  actions:
    - theme: brand
      text: Get started
      link: /guide/getting-started
    - theme: alt
      text: API reference
      link: /api/flag
    - theme: alt
      text: GitHub
      link: https://github.com/simmo/jinju

features:
  - title: Typed from your definitions
    details: Flags and args resolve to exact types, such as 'fast' | 'safe' or URL[] | undefined. There are no interfaces to keep in sync.
  - title: Composable and immutable
    details: Define a flag once, then derive .required(), .multiple() and .default() variants. Scopes share flags and args across commands.
  - title: Command trees
    details: Nested subcommands, aliases, variadic args and dynamic segments like app my-site deploy, with mistakes caught at compile time.
  - title: Validation built in
    details: Numbers, URLs, emails, paths, choices, environment variables, custom parsers and any Standard Schema (zod, valibot, arktype).
  - title: Help and errors
    details: Generated --help pages, and every input error reported at once. Customise both by extending a template class.
  - title: Small and testable
    details: No runtime dependencies. Inject argv, env, stdout, stderr and the exit code to test in-process.
---
