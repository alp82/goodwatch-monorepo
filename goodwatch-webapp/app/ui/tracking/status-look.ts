// The word and pill colors of a tracked show's status. Its own module: the poster card's actions (CardActions.tsx),
// which every page with poster cards loads on the first interaction, use it, and tracking/gate.tsx sits in the title
// page's chunk (vite.config.js, FEATURE_CHUNKS), which those pages must not load for it.
import type { WatchStateEntry } from "~/types/user-data"

export const STATUS_LOOK: Record<
	WatchStateEntry["state"],
	{ word: string; pill: string }
> = {
	watching: { word: "Watching", pill: "bg-sky-500 text-black" },
	on_hold: { word: "On hold", pill: "bg-violet-500 text-white" },
	dropped: { word: "Dropped", pill: "bg-pink-500 text-black" },
	seen: { word: "Seen", pill: "bg-green-500 text-black" },
}
