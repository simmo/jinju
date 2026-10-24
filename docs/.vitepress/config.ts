import { fileURLToPath } from 'node:url';

import { transformerTwoslash } from '@shikijs/vitepress-twoslash';
import { defineConfig } from 'vitepress';
import llmstxt, { copyOrDownloadAsMarkdownButtons } from 'vitepress-plugin-llms';

import { inlineTwoslash } from './llms';

// Every version of the docs is built from its own tag with these variables, so keep them
// stable (see AGENTS.md). `DOCS_SITE_ORIGIN` is the site's scheme and host
// (`https://simmo.github.io`), `DOCS_SITE_BASE` is the path it's served from (`/jinju/` on
// GitHub Pages) and `DOCS_VERSION` is the folder for this build: empty for the latest
// release, `x.y.z` for a release or `next` for the newest prerelease.
const siteOrigin = process.env.DOCS_SITE_ORIGIN || undefined;
const siteBase = process.env.DOCS_SITE_BASE || '/';
const version = process.env.DOCS_VERSION || '';
const base = version ? `${siteBase}${version}/` : siteBase;

const repo = 'https://github.com/simmo/jinju';

// Examples import the source, so they're checked against the current API.
const twoslashCompilerOptions = {
	paths: { jinju: [fileURLToPath(new URL('../../src/index.ts', import.meta.url))] },
};

/** The parts of a HAST node this file reads. */
interface HastNode {
	type: string;
	value?: string;
	properties?: Record<string, unknown>;
	children?: HastNode[];
}

const hasClass = (node: HastNode, name: string) =>
	String(node.properties?.class ?? '')
		.split(/[\s,]+/)
		.includes(name);

const text = (node: HastNode): string => node.value ?? (node.children ?? []).map(text).join('');

/**
 * Twoslash indents each `^?` result with spaces, counting a tab as one column. Examples are
 * indented with tabs, so swap the leading spaces for the code line's tabs to keep the result
 * under the token it describes.
 */
const alignQueries = (node: HastNode) => {
	let line: HastNode | undefined;
	for (const child of node.children ?? []) {
		if (child.type !== 'element') continue;
		if (hasClass(child, 'line')) line = child;
		const first = child.children?.[0];
		if (hasClass(child, 'twoslash-query-line') && line && first?.type === 'text' && first.value) {
			const tabs = /^\t*/.exec(text(line))![0];
			first.value = tabs + first.value.slice(tabs.length);
		}
		alignQueries(child);
	}
};

export default defineConfig({
	title: 'Jinju',
	description: 'Composable, type-safe toolkit for building Node command-line apps',
	base,
	// Partials imported by the theme (e.g. the home page's showcase), not pages.
	srcExclude: ['parts/**'],
	cleanUrls: true,
	lastUpdated: true,
	head: [
		['link', { rel: 'icon', type: 'image/svg+xml', href: `${base}favicon.svg` }],
		['meta', { name: 'theme-color', content: '#e84393' }],
	],
	vite: {
		define: {
			__DOCS_SITE_BASE__: JSON.stringify(siteBase),
			__DOCS_VERSION__: JSON.stringify(version),
		},
		plugins: [
			// `llms.txt`, `llms-full.txt` and a Markdown copy of each page, for agents. With an
			// origin, links are absolute, so they work wherever the file is read; without one (local
			// builds), they're root-relative.
			llmstxt({
				domain: siteOrigin,
				ignoreFiles: ['parts/**'],
				title: 'Jinju',
				description: 'Composable, type-safe toolkit for building Node command-line apps',
				details: [
					'Use Jinju to build a Node command-line app in TypeScript. Flags, args and commands are defined as separate values and composed into a program, and each command gets fully typed input, with help pages, error reporting and exit codes handled.',
					'Install it with `npm install jinju`. It needs Node 22.12 or newer and has no runtime dependencies. Its types (`node_modules/jinju/dist/index.d.ts`) are the most reliable reference for the installed version.',
					'In the examples, comments under a line show the types TypeScript infers for it, and `error TS…` comments show an intended type error.',
				].join('\n\n'),
			}),
		],
	},
	// Write the types that examples show on hover into those Markdown files.
	buildEnd: ({ outDir }) => inlineTwoslash(outDir, twoslashCompilerOptions),
	markdown: {
		// A "Copy page" menu on each page: copy or view its Markdown, or open it in an AI chat.
		config: (md) => {
			md.use(copyOrDownloadAsMarkdownButtons);
		},
		codeTransformers: [
			transformerTwoslash({
				// `^?` results as a line under the code (styled as a comment in `style.css`), not a
				// popup that's always open.
				queryRendering: 'line',
				twoslashOptions: { compilerOptions: twoslashCompilerOptions },
			}),
			{ name: 'align-twoslash-queries', enforce: 'post', root: alignQueries },
		],
	},
	themeConfig: {
		logo: { light: '/logo-light.svg', dark: '/logo-dark.svg', alt: 'Jinju' },
		siteTitle: false,
		nav: [
			{ text: 'Guide', link: '/guide/getting-started', activeMatch: '/guide/' },
			{ text: 'API', link: '/api/flag', activeMatch: '/api/' },
			{ text: 'Changelog', link: '/changelog' },
			{ component: 'VersionSwitcher' },
		],
		sidebar: {
			'/guide/': [
				{
					text: 'Introduction',
					items: [{ text: 'Getting started', link: '/guide/getting-started' }],
				},
				{
					text: 'Essentials',
					items: [
						{ text: 'Flags', link: '/guide/flags' },
						{ text: 'Args', link: '/guide/args' },
						{ text: 'Commands', link: '/guide/commands' },
						{ text: 'Program', link: '/guide/program' },
					],
				},
				{
					text: 'Structure',
					items: [
						{ text: 'Scopes', link: '/guide/scopes' },
						{ text: 'Dynamic segments', link: '/guide/dynamic-segments' },
					],
				},
				{
					text: 'Values',
					items: [
						{ text: 'Standard Schema', link: '/guide/schemas' },
						{ text: 'Environment variables', link: '/guide/environment-variables' },
					],
				},
				{
					text: 'Output',
					items: [
						{ text: 'Help', link: '/guide/help' },
						{ text: 'Errors', link: '/guide/errors' },
					],
				},
				{
					text: 'Going further',
					items: [
						{ text: 'Testing', link: '/guide/testing' },
						{ text: 'TypeScript', link: '/guide/typescript' },
					],
				},
			],
			'/api/': [
				{
					text: 'API reference',
					items: [
						{ text: 'flag', link: '/api/flag' },
						{ text: 'arg', link: '/api/arg' },
						{ text: 'command & scope', link: '/api/command' },
						{ text: 'jinju', link: '/api/program' },
						{ text: 'Help', link: '/api/help' },
						{ text: 'Errors', link: '/api/errors' },
						{ text: 'Types', link: '/api/types' },
					],
				},
			],
		},
		search: { provider: 'local' },
		editLink: { pattern: `${repo}/edit/main/docs/:path`, text: 'Edit this page on GitHub' },
		socialLinks: [
			{ icon: 'github', link: repo },
			{ icon: 'npm', link: 'https://www.npmjs.com/package/jinju' },
		],
		footer: {
			message: 'Released under the MIT License.',
			copyright: '© 2026 <a href="https://mike.id">Mike Simmonds</a>',
		},
	},
});
