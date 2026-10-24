import { fileURLToPath } from 'node:url';

import { transformerTwoslash } from '@shikijs/vitepress-twoslash';
import { defineConfig } from 'vitepress';

// Every version of the docs is built from its own tag with these variables, so keep them
// stable (see AGENTS.md). `DOCS_SITE_BASE` is where the site lives (`/jinju/` on GitHub
// Pages) and `DOCS_VERSION` is the folder for this build: empty for the latest release,
// `x.y.z` for a release or `next` for the newest prerelease.
const siteBase = process.env.DOCS_SITE_BASE || '/';
const version = process.env.DOCS_VERSION || '';
const base = version ? `${siteBase}${version}/` : siteBase;

const repo = 'https://github.com/simmo/jinju';

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
	},
	markdown: {
		codeTransformers: [
			transformerTwoslash({
				// `^?` results as a line under the code (styled as a comment in `style.css`), not a
				// popup that's always open.
				queryRendering: 'line',
				twoslashOptions: {
					compilerOptions: {
						// Examples import the source, so they're checked against the current API.
						paths: { jinju: [fileURLToPath(new URL('../../src/index.ts', import.meta.url))] },
					},
				},
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
