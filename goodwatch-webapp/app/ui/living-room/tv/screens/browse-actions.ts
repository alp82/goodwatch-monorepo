import { browseQuery } from "../tv-browse"
import { discoverOption } from "../tv-discover"
import type { TvScreen } from "../tv-machine"
export function browseActions(
	screen: Extract<TvScreen, { name: "search" | "discover" }>,
	list: { failed: string | null; next: boolean } | null,
) {
	return [
		{ id: "browse:filters", label: "Filters" },
		...(screen.name === "discover" ? [{ id: "change", label: "Moods" }] : []),
		...(screen.name === "search"
			? [{ id: "browse:edit", label: "Edit search" }]
			: []),
		...((screen.page ?? 1) > 1
			? [{ id: "browse:prev", label: "Previous" }]
			: []),
		...(list?.next ? [{ id: "browse:next", label: "Next" }] : []),
		...(list?.failed ? [{ id: "browse:retry", label: "Retry" }] : []),
	]
}

export function selectionNames(
	screen: Extract<TvScreen, { name: "search" | "discover" }>,
) {
	const p = new URLSearchParams(browseQuery(screen))
	return (["moods", "themes", "styles"] as const)
		.flatMap((tab) => {
			const key = p.get(tab)
			return key ? [discoverOption(tab, key)?.name ?? key] : []
		})
		.join(" + ")
}
