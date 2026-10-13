// The New episodes signal for a member's shows on the TV: what home's My shows tile and the My shows screen say
// is new. It is the site's own signal, the one the Browse button, the dock's key and the hub's My shows tile
// show: the navigation asks for it on every page (`useWhatsNew`), so the TV adds no request. Shows that are newly
// on one of the member's services join it, each show counted once (`showsWords`).
//
// The TV's My shows is not a My shows visit: it lists six shows of the member's, not all of them, so opening it
// clears nothing. The page behind the Expand key records the visit, and a show leaves the signal when its new
// episode is watched, which the Seen it key of its title screen does (use-tv-episode.ts).
//
// None of this is in the page's first view: the hook runs in `ShowsData` (screens/Shows.tsx), which arrives with
// the My shows screen's chunk and reports up to the scene. The scene imports this file's types only.
import { useMemo } from "react"
import { showsWords } from "~/domain/newly-available-words"
import { useWhatsNew } from "~/ui/navigation/useWhatsNew"
import type { TvShowsSignal } from "./tv-shows"

/** What My shows' data component reports up to the scene. */
export type TvShowsReport = TvShowsSignal

export function useTvShows(): TvShowsReport {
	const { episodes, landed } = useWhatsNew()
	// The same object while nothing changed: every new one is another render of the scene (`useReport`).
	return useMemo(() => {
		const words = showsWords(episodes, landed?.shows ?? null)
		return {
			words: words && {
				badge: words.badge,
				tile: words.tile,
				door: words.door,
			},
			aired: episodes?.ids ?? [],
			landed: landed?.shows.ids ?? [],
		}
	}, [episodes, landed])
}
