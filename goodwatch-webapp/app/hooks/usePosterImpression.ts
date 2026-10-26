import { useEffect, useRef } from "react"

import { enqueueDemand } from "~/utils/title-demand"

/** Count a poster after one continuous second with at least half visible. */
export function usePosterImpression(mediaType?: "movie" | "show", tmdbId?: number) {
	const ref = useRef<HTMLImageElement>(null)
	useEffect(() => {
		const element = ref.current
		if (!element || !mediaType || !Number.isSafeInteger(tmdbId) || !tmdbId || tmdbId <= 0 || tmdbId > 2_147_483_647 || typeof IntersectionObserver === "undefined") return
		let timer: ReturnType<typeof setTimeout> | undefined
		let visible = false
		const schedule = () => {
			clearTimeout(timer)
			if (visible && document.visibilityState === "visible") {
				timer = setTimeout(() => {
					enqueueDemand({ media_type: mediaType, tmdb_id: tmdbId, source_kind: "poster" })
					observer.disconnect()
				}, 1000)
			}
		}
		const observer = new IntersectionObserver(([entry]) => {
			visible = entry.isIntersecting && entry.intersectionRatio >= 0.5
			schedule()
		}, { threshold: 0.5 })
		observer.observe(element)
		document.addEventListener("visibilitychange", schedule)
		return () => {
			observer.disconnect()
			clearTimeout(timer)
			document.removeEventListener("visibilitychange", schedule)
		}
	}, [mediaType, tmdbId])
	return ref
}
