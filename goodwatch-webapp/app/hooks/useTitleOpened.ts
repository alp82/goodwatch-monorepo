import { useEffect } from "react"
import { enqueueDemand, observeTitleOpened } from "../utils/title-demand.ts"

/** Mounted title views only: loaders, hover and prefetch never run this effect. */
export function useTitleOpened(mediaType?: "movie" | "show", tmdbId?: number, active = true, selector?: string) {
	useEffect(() => {
		if (!active || !mediaType || !Number.isSafeInteger(tmdbId) || !tmdbId || tmdbId <= 0 || tmdbId > 2_147_483_647) return
		return observeTitleOpened(() => enqueueDemand({ media_type: mediaType, tmdb_id: tmdbId, source_kind: "opened" }), selector)
	}, [mediaType, tmdbId, active, selector])
}
