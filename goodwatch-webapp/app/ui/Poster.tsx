import React from "react"
import { usePosterImpression } from "~/hooks/usePosterImpression"
import placeholder from "~/img/poster-placeholder.png"

export interface PosterProps {
	path?: string
	title?: string
	loading?: boolean
	mediaType?: "movie" | "show"
	tmdbId?: number
}

export function Poster({ path, title, loading = false, mediaType, tmdbId }: PosterProps) {
	const impressionRef = usePosterImpression(loading ? undefined : mediaType, tmdbId)
	const url = path
		? `https://www.themoviedb.org/t/p/w300_and_h450_bestv2${path}`
		: placeholder

	return (
		<img
			ref={impressionRef}
			className={`block w-full rounded-md pointer-events-none ${loading ? "animate-pulse brightness-50" : ""}`}
			src={url}
			alt={title && `Poster for ${title}`}
			draggable="false"
		/>
	)
}
