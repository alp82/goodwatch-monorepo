import { type DialSpec, type PoolItem, type Settings, rank } from "../../../domain/browse/tune.ts"
import {
	PHONE_THUMBNAIL_MEDIA,
	POSTER_CARD_MIN_WIDTH,
	POSTER_CARD_MAX_WIDTH,
	phonePosterSrcSet,
} from "../../../utils/poster-thumbnail.ts"
import { type SizeRule, tmdbFluidImage } from "../../../utils/tmdb-image.ts"

export const STAGE_LEAD_POSTERS = 3
export const STAGE_SIZES: SizeRule[] = [
	["(min-width: 1024px)", "155px"],
	["(min-width: 640px)", "calc((100vw - 84px) / 4)"],
	[null, "calc((100vw - 48px) / 3)"],
]

export function rankedStageTitles<T>(
	pool: (Pick<PoolItem, "s" | "m"> & { t: T })[],
	dials: DialSpec[],
	settings: Settings,
) {
	return rank(pool, dials, settings, 72).map((item) => item.t)
}

/** The first stage row is in the initial viewport. Use the same responsive selection as its picture. */
export function stagePosterPreloads(titles: readonly { card: { poster_path?: string | null } }[]) {
	const paths = new Set(titles.slice(0, STAGE_LEAD_POSTERS).map((t) => t.card.poster_path))
	const links: Record<string, string>[] = []
	const preload = { tagName: "link", rel: "preload", as: "image", fetchpriority: "high" }
	for (const path of paths) {
		if (!path) continue
		const { src, srcSet, sizes } = tmdbFluidImage("poster", path, STAGE_SIZES, {
			fallbackWidth: POSTER_CARD_MAX_WIDTH,
			minWidth: POSTER_CARD_MIN_WIDTH,
			maxWidth: POSTER_CARD_MAX_WIDTH,
		})
		if (!srcSet || !sizes) {
			links.push({ ...preload, href: src })
			continue
		}
		links.push(
			{
				...preload,
				media: PHONE_THUMBNAIL_MEDIA,
				imageSrcSet: phonePosterSrcSet(path),
				imageSizes: sizes,
			},
			{
				...preload,
				media: `not all and ${PHONE_THUMBNAIL_MEDIA}`,
				imageSrcSet: srcSet,
				imageSizes: sizes,
			},
		)
	}
	return links
}
