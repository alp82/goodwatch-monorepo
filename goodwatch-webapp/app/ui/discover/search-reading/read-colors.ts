// The meter colors of the read parts, for the page's meter and the Matches rows alike (kept apart from the strip's
// components, which load only while searching).
import { filterColor } from "~/ui/discover-bar/PanelFooter"
import type { ReadItem } from "./read-items"

/** A read filter's meter color: the same one Discover gives that filter group's segment. */
export function readColor(item: Pick<ReadItem, "group">) {
	return filterColor(item.group ?? "")
}

/** The search's scope segment. */
export const SCOPE_COLOR = "bg-slate-400"
