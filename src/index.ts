import { boolean } from './boolean.js';
import { custom } from './custom.js';
import { number } from './number.js';
import { string } from './string.js';
import { url } from './url.js';

export const flag = { boolean, custom, number, string, url };
export type { InferTypeOfFlag } from './InferTypeOfFlag.js';
