import { assetUrl } from "~/utils/asset-url"
import React from "react"
import { usePosterImpression } from "~/hooks/usePosterImpression"
import placeholder from "~/img/poster-placeholder.png"
import { TmdbImage, type TmdbImageProps } from "~/ui/TmdbImage"
import type { SizeRule } from "~/utils/tmdb-image"

export interface PosterProps {
	path?: string
	title?: string
	loading?: boolean
	mediaType?: "movie" | "show"
	tmdbId?: number
	/** The displayed widths per viewport. The default fits the card grid and the card rows. */
	sizes?: SizeRule[]
	/** "lazy" by default. A page sets "eager" or "high" on the posters it shows without scrolling. */
	priority?: TmdbImageProps["priority"]
}

// A card in the grid (2 to 6 columns) or in a row (3 to 8 slides) is at most this wide.
export const POSTER_CARD_MIN_WIDTH = 100
export const POSTER_CARD_MAX_WIDTH = 230

/** The width of a card in MovieTvGrid and MovieSeries: 2 columns on a phone, 6 on a wide screen. */
export const POSTER_GRID_SIZES: SizeRule[] = [
	["(min-width: 1280px)", "180px"],
	["(min-width: 1024px)", "18vw"],
	["(min-width: 768px)", "23vw"],
	["(min-width: 475px)", "31vw"],
	[null, "42vw"],
]

/** The width of a slide in ListSwiper: 3 slides on a phone, 8 on a wide screen. */
export const POSTER_ROW_SIZES: SizeRule[] = [
	["(min-width: 1024px)", "150px"],
	["(min-width: 640px)", "19vw"],
	[null, "31vw"],
]

const CLASS_NAME =
	"block w-full h-auto aspect-[2/3] rounded-md pointer-events-none"

export function Poster({
	path,
	title,
	loading = false,
	mediaType,
	tmdbId,
	sizes = POSTER_GRID_SIZES,
	priority = "lazy",
}: PosterProps) {
	const impressionRef = usePosterImpression(
		loading ? undefined : mediaType,
		tmdbId,
	)
	const alt = title && `Poster for ${title}`
	// Every poster is 2:3. The ratio reserves the height before the image arrives.
	const className = `${CLASS_NAME} ${loading ? "animate-pulse brightness-50" : ""}`

	if (!path) {
		return (
			<img
				ref={impressionRef}
				className={className}
				src={assetUrl(placeholder)}
				alt={alt}
				draggable="false"
			/>
		)
	}
	return (
		<TmdbImage
			imgRef={impressionRef}
			kind="poster"
			path={path}
			sizes={sizes}
			minWidth={POSTER_CARD_MIN_WIDTH}
			maxWidth={POSTER_CARD_MAX_WIDTH}
			priority={priority}
			className={className}
			alt={alt}
			draggable="false"
		/>
	)
}
