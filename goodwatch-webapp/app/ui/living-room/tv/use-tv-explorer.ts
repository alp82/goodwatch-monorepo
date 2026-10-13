// The mini Explorer's data: the real mood map, read once for the whole app, and what its two screens show of it.
//
// One request, `/api/explorer/map?grouping=mood` (members GET, guests POST what the Explorer's page posts of
// their browser's progress; the answer is never stored by a cache). Every island carries its top titles, so an
// island's screen asks for nothing more. The filters are the Explorer's defaults, so the counts and the titles
// are the ones the page behind the Expand key starts with.
//
// The request is written here and not taken from ui/explorer/api.ts: that module is small, and with a second
// importer the build moves it into the shell of every page (vite.config.js, rule 3 of the client chunks). The
// Explorer's page reads its whole world in one request of its own, so there is no answer to share with it.
//
// None of this is in the page's first view: the hook runs in `ExplorerData` (screens/Explorer.tsx), which arrives
// with the Explorer's chunk and reports up to the scene (`TvExplorerReport`). The scene imports this file's types
// only.
import { useQuery } from "@tanstack/react-query"
import { useCallback, useMemo } from "react"
import type { ExplorerMap } from "~/domain/explorer"
import { useUser } from "~/utils/auth"
import { snapshotGuestProgress } from "~/utils/guest-progress"
import {
	TV_MAP_GROUPING,
	type TvExplorerView,
	explorerContext,
	explorerView,
	explorerWaiting,
	knownOnMap,
} from "./tv-explorer"
import type { TvContext, TvScreen } from "./tv-machine"
import type { TvKnownTitle } from "./tv-title"

/** What the Explorer's data component reports up to the scene. */
export type TvExplorerReport = {
	/** What the map and an island's screen draw. */
	view: TvExplorerView
	/** The machine's context while the Explorer is on screen: its islands, and an island's titles and hops. */
	context: Partial<Pick<TvContext, "islands" | "titles" | "hops">>
	/** What the map knows of a title, by its key on the TV, for the title screen until its card is there. */
	known: (key: string) => TvKnownTitle | null
}

const NOTHING: TvExplorerReport["context"] = {}

async function fetchMap(member: boolean): Promise<ExplorerMap> {
	const url = `/api/explorer/map?grouping=${TV_MAP_GROUPING}`
	let response: Response
	if (member) response = await fetch(url)
	else {
		const { interactions, country, services } = snapshotGuestProgress()
		response = await fetch(url, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ guest: { interactions, country, services } }),
		})
	}
	if (!response.ok) throw new Error(`The Explorer's map: ${response.status}`)
	return response.json()
}

export function useTvExplorer({
	screen,
	member,
}: {
	screen: TvScreen
	member: boolean
}): TvExplorerReport {
	// The query is a viewer's own, as on the Explorer's page: signing in or out never shows another person's map.
	const { user } = useUser()
	const viewer = user?.id ?? (member ? "member" : "guest")
	const { data: map, isError } = useQuery({
		queryKey: ["tv-explorer-map", viewer, TV_MAP_GROUPING],
		queryFn: () => fetchMap(member),
	})

	const on = screen.name === "explorer"
	const island = on ? screen.island : null
	const view = useMemo(
		() => (map ? explorerView(map, island) : explorerWaiting(isError)),
		[map, island, isError],
	)
	// Off the Explorer the context is another screen's: a title opened from an island keeps what the map knows of
	// it, and nothing else of the map counts.
	const context = useMemo(
		() => (on ? explorerContext(view) : NOTHING),
		[on, view],
	)
	const known = useCallback(
		(key: string) => (map ? knownOnMap(map, key) : null),
		[map],
	)
	// The same object while nothing changed: every new one is another render of the scene (`useReport`).
	return useMemo(() => ({ view, context, known }), [view, context, known])
}
