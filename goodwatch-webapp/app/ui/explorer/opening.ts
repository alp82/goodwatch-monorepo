// Where a link opens the Explorer's map: on a grouping's region (`grouping=decade`, as older links have it), or
// inside one of its islands (`grouping=mood&island=funny`, as the TV's Expand key has it from an island's
// screen). The page reads it once, when its world first shows; picked islands (`mix=`) come before it.
import { type Grouping, isGrouping } from "../../domain/explorer.ts"

export type Opening = {
	grouping: Grouping
	/** The island's id in its grouping, or null for the region. */
	island: string | null
}

/** What the address asks the map to open on, or null for the whole world. An island needs its grouping. */
export function openingOf(params: URLSearchParams): Opening | null {
	const grouping = params.get("grouping")
	if (!isGrouping(grouping)) return null
	return { grouping, island: params.get("island") || null }
}
