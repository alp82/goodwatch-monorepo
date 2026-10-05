// PROTOTYPE - throwaway. Shapes for /prototype/rec-explorer-6 (#180, round 6). Round 6 keeps round 5's data as is:
// round 4's map (islands per grouping), round 5's fractal of closer titles per island ("tree") and where a step toward
// a neighboring island lands ("door"), all served read-only by round 5's API.
import type { Arrangement } from "~/ui/prototype-rec-explorer-5/wire5"
import type { SurfaceStyle } from "./sea6"

export type { W, TreeRes, DoorRes, Arrangement } from "~/ui/prototype-rec-explorer-5/wire5"
export { BRANCH, firstCount } from "~/ui/prototype-rec-explorer-5/wire5"

/**
 * How a title comes forward, without ever leaving the map:
 * near    proximity cards: posters near the pointer (or the middle, on touch) get a caption once they're big
 *         enough; the closest one opens into a full card, like a magnifier passing over them;
 * focus   a focus ring: the poster nearest the middle is always the one in focus, with its card beside it, and
 *         the map glides to center it when you let go;
 * drawer  a side drawer (a bottom sheet on phones) that follows the nearest title as you move, joined to its poster
 *         by a thin line of light;
 * peek    hover (or long-press) lifts a poster and shows a peek card anchored to it; a tap pins it;
 * pin     nothing comes forward on its own: the map stays clean and a tap (or Enter) pins a title's card.
 * In every variant a tap pins the card, the map stays live behind it, and Escape or a tap on open water lets go.
 */
export type Activation = "near" | "focus" | "drawer" | "peek" | "pin"

export type Config6 = {
	activation: Activation
	surface: SurfaceStyle
	arr: Arrangement
}
