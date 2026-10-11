// The related map as one piece: the engine with its form and the traits it reads. The server draws the section's
// first picture with it (`win` is null), and the browser starts it once per page.
import { relatedMapEngine } from "./engine"
import { trailForm } from "./trail"
import { mapMeta, traitWords } from "./traits"

// biome-ignore lint/suspicious/noExplicitAny: the browser's window, or null on the server.
export const relatedMap = (win: any) =>
	relatedMapEngine(mapMeta(), win, (core) => trailForm(core, traitWords()))
