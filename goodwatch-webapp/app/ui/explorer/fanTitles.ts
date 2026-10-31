// Which posters the hover fan shows (hoverFan.ts): pure, so the map's filters can be checked without a canvas.
import type { ExplorerTitle } from "~/domain/explorer"
import type { MapIsland } from "./island"

const FAN_COUNT = 6

/** The posters an island's fan shows: its top titles that the map's filters keep, best first. */
export function fanTitles(
	island: Pick<MapIsland, "top" | "titles">,
	visible: (title: ExplorerTitle) => boolean,
): ExplorerTitle[] {
	const out: ExplorerTitle[] = []
	for (const t of island.top.length ? island.top : island.titles) {
		if (!visible(t)) continue
		out.push(t)
		if (out.length === FAN_COUNT) break
	}
	return out
}
