import { Renderer } from '../Utils/Renderer.js';

/**
 * A silent renderer that does nothing.
 */

export class Silent extends Renderer {
	update() {}

	stop() {}
}
