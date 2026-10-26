// The picture of a category tile on the movie and show hubs (routes/$type._index.tsx), behind its dark veil.
// An image, not a CSS background: a browser starts every background as soon as the page renders, and the hub has about
// 40 tiles. Their full-width files (40 to 120 KB each) kept a phone's connection busy for seconds, and the next page
// change's data waited behind them (#753). Tiles on the first screen load at once (tilePriority), the rest lazily.
import { TmdbImage } from "~/ui/TmdbImage"
import {
	type ImagePriority,
	type SizeRule,
	imageLoadingProps,
} from "~/utils/tmdb-image"

// The hub's grid: inside `max-w-7xl` (1280 px) and `p-4` (16 px a side), four columns from 1024 px, three from
// 768 px, two from 640 px, one below, with 24 px gaps.
const TILE_SIZES: SizeRule[] = [
	["(min-width: 1280px)", "294px"],
	["(min-width: 1024px)", "calc((100vw - 104px) / 4)"],
	["(min-width: 768px)", "calc((100vw - 80px) / 3)"],
	["(min-width: 640px)", "calc((100vw - 56px) / 2)"],
	[null, "calc(100vw - 32px)"],
]
const COVER = "absolute inset-0 h-full w-full object-cover object-center"

/**
 * How a tile's picture loads. The first section's first two rows are on the first screen of a wide window: at once.
 * Every other tile waits until it comes near. None is fetched ahead of the rest: the hubs' largest content is their
 * intro text (Lighthouse, phone and desktop, October 26, 2026).
 */
export function tilePriority(section: number, index: number): ImagePriority {
	return section === 0 && index < 8 ? "eager" : "lazy"
}

/** `path` is a TMDB backdrop file, or a site image's address (the streaming tiles, `/images/...`). */
export function TileBackdrop({
	path,
	priority,
}: { path: string; priority: ImagePriority }) {
	if (path.startsWith("/images/"))
		return (
			<img
				{...imageLoadingProps(priority)}
				src={path}
				alt=""
				aria-hidden
				className={COVER}
			/>
		)
	return (
		<TmdbImage
			kind="backdrop"
			path={path}
			sizes={TILE_SIZES}
			maxWidth={608}
			minWidth={229}
			priority={priority}
			alt=""
			aria-hidden
			className={COVER}
		/>
	)
}
