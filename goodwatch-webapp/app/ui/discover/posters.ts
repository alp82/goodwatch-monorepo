import { POSTER_CARD_MAX_WIDTH, POSTER_CARD_MIN_WIDTH } from "~/utils/poster-thumbnail"
import { type SizeRule, tmdbFluidImage } from "~/utils/tmdb-image"

// The results occupy a padded max-w-7xl container, with three to six columns.
export const DISCOVER_POSTER_SIZES: SizeRule[] = [
	["(min-width: 1280px)", "191px"],
	["(min-width: 1024px)", "calc((100vw - 112px) / 5)"],
	["(min-width: 768px)", "calc((100vw - 80px) / 4)"],
	["(min-width: 640px)", "calc((100vw - 64px) / 3)"],
	[null, "calc((100vw - 48px) / 3)"],
]

/** Start the grid's two high-priority posters in the head, using the source set the cards draw. */
export function discoverPosterPreloads(cards: readonly { poster_path?: string | null }[]) {
	const links: Record<string, string>[] = []
	for (const path of new Set(cards.slice(0, 2).map((card) => card.poster_path))) {
		if (!path) continue
		const image = tmdbFluidImage("poster", path, DISCOVER_POSTER_SIZES, {
			fallbackWidth: POSTER_CARD_MAX_WIDTH,
			minWidth: POSTER_CARD_MIN_WIDTH,
			maxWidth: POSTER_CARD_MAX_WIDTH,
		})
		links.push({
			tagName: "link",
			rel: "preload",
			as: "image",
			fetchpriority: "high",
			...(image.srcSet && image.sizes
				? { imageSrcSet: image.srcSet, imageSizes: image.sizes }
				: { href: image.src }),
		})
	}
	return links
}
