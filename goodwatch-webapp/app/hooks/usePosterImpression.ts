import { useEffect, useRef } from "react"
import { observePosterImpression } from "~/utils/observe-poster-impression"
import { enqueueDemand } from "~/utils/title-demand"

export function usePosterImpression(mediaType?: "movie" | "show", tmdbId?: number) {
	const ref = useRef<HTMLImageElement>(null)
	useEffect(() => {
		const element = ref.current
		if (
			!element ||
			!mediaType ||
			!Number.isSafeInteger(tmdbId) ||
			!tmdbId ||
			tmdbId <= 0 ||
			tmdbId > 2_147_483_647 ||
			typeof IntersectionObserver === "undefined"
		)
			return
		return observePosterImpression(element, () =>
			enqueueDemand({ media_type: mediaType, tmdb_id: tmdbId, source_kind: "poster" }),
		)
	}, [mediaType, tmdbId])
	return ref
}
