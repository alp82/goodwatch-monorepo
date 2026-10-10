// The related map's engine as a lazy chunk, for a server without the built script file (the development server): the
// section loads it after hydration. A production build serves the engine as its own script (inline.ts).
import { relatedMap } from "./map"

export function start() {
	if (!(window as { __gwRelatedMap?: unknown }).__gwRelatedMap)
		relatedMap(window)
}
