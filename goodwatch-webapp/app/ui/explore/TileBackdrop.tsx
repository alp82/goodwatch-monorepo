// The picture of a category tile on the movie and show hubs (routes/$type._index.tsx), behind its dark veil.
// A lazy image, not a CSS background: a browser starts every background as soon as the page renders, and the hub
// has about 40 tiles. Their full-width files (40 to 120 KB each) kept a phone's connection busy for seconds, and the
// next page change's data waited behind them (#753). The tile is drawn 25 to 100 percent of the window wide.
import { TmdbImage } from "~/ui/TmdbImage"
import type { SizeRule } from "~/utils/tmdb-image"

const TILE_SIZES: SizeRule[] = [
	["(min-width: 1024px)", "25vw"],
	["(min-width: 768px)", "33vw"],
	["(min-width: 640px)", "50vw"],
	[null, "100vw"],
]
const COVER = "absolute inset-0 h-full w-full object-cover object-center"

/** `path` is a TMDB backdrop file, or a site image's address (the streaming tiles, `/images/...`). */
export function TileBackdrop({ path }: { path: string }) {
	if (path.startsWith("/images/"))
		return (
			<img
				loading="lazy"
				decoding="async"
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
			maxWidth={640}
			minWidth={300}
			alt=""
			aria-hidden
			className={COVER}
		/>
	)
}
