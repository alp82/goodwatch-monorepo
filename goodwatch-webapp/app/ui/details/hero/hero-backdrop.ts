import { type SizeRule, tmdbFluidImage } from "~/utils/tmdb-image"

// The backdrop is the hero's banner, as wide as the page's column, and the page's largest image.
export const HERO_BACKDROP_SIZES: SizeRule[] = [
	["(min-width: 1280px)", "1216px"],
	[null, "100vw"],
]

// `maxWidth` stays at 780: it names the file that `src` holds, which the render path budget looks for, and every
// larger step is in the srcSet for the wide banner all the same.
export const HERO_BACKDROP_MAX_WIDTH = 780

/** The hero image's src, srcSet, and sizes, as `HeroBackdropImage` renders them. */
export function heroBackdropSource(path: string) {
	return tmdbFluidImage("backdrop", path, HERO_BACKDROP_SIZES, {
		fallbackWidth: HERO_BACKDROP_MAX_WIDTH,
		maxWidth: HERO_BACKDROP_MAX_WIDTH,
	})
}

const started = new Set<string>()

/**
 * Starts loading a title page's hero picture before the page renders, after a press or hover prefetch of its data.
 * An image with the hero's srcset and sizes picks the same file the hero will, and it asks without credentials as
 * the hero does, so the hero finds it in the cache.
 */
export function preloadHeroBackdrop(path: string): void {
	if (started.has(path) || started.size > 50) return
	started.add(path)
	const source = heroBackdropSource(path)
	const image = new Image()
	image.crossOrigin = "anonymous"
	image.decoding = "async"
	if (source.sizes) image.sizes = source.sizes
	if (source.srcSet) image.srcset = source.srcSet
	image.src = source.src
}
