import isUnicodeSupported from 'is-unicode-supported';

const unicode = isUnicodeSupported();

type TSymbolTypes =
	| 'Celebrate'
	| 'Debug'
	| 'Error'
	| 'Info'
	| 'Question'
	| 'Success'
	| 'Warning';
type TSymbols = Record<TSymbolTypes, string>;

const standard: TSymbols = {
	Celebrate: '★',
	Debug: '•',
	Error: '✖',
	Info: 'ℹ',
	Question: '◆',
	Success: '✔',
	Warning: '⚠',
};

const fallback: TSymbols = {
	Celebrate: '*',
	Debug: '•',
	Error: '×',
	Info: 'i',
	Question: '?',
	Success: '√',
	Warning: '‼',
};

export const Symbols = unicode ? standard : fallback;
