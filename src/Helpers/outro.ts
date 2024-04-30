import { cursor } from 'sisteransi';

export const outro = (value: string) => {
	process.stdout.write(`\n${value}\n${cursor.show}`);
};
