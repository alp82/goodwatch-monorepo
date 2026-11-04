// Estimated heights of the title page's sections, in pixels. The browser reserves them for a section it hasn't laid
// out yet (see below-fold.tsx). An estimate only has to be close: a section gets its real height before it scrolls
// into view, and the browser remembers it from then on.
//
// Measured on phones (390 px wide) and desktops (1,440 px wide) on Dune: Part Two, Severance, Breaking Bad and Past
// Lives. Keep them in step with the sections' markup (title-sections.tsx).
import type { EpisodeGrid } from "~/server/episode-grid.server"
import type { MovieResult, ShowResult } from "~/server/types/details-types"

type Media = MovieResult | ShowResult

export interface ReservedHeight {
	/** Below the md breakpoint. */
	phone: number
	/** From the md breakpoint up. */
	desktop: number
}

/** Offer types that count as streaming (where to watch opens on them). */
const STREAM_TYPES = new Set(["flatrate", "free", "ads", "flatrate_and_buy"])

const same = (height: number): ReservedHeight => ({
	phone: height,
	desktop: height,
})
const add = (a: ReservedHeight, b: ReservedHeight): ReservedHeight => ({
	phone: a.phone + b.phone,
	desktop: a.desktop + b.desktop,
})

/** A section's frame: its top padding, the header, and the gap to the body. */
const FRAME: ReservedHeight = { phone: 92, desktop: 108 }

// The shared grid wraps long seasons.
function episodeGridHeight(grid: EpisodeGrid): ReservedHeight {
	const height = (columns: number) =>
		84 +
		(grid.window ? 40 : 0) +
		grid.seasons.reduce(
			(sum, season) =>
				sum +
				Math.max(40, Math.ceil(season.episodes.length / columns) * 33) +
				3,
			0,
		) +
		(grid.specials.length ? 48 : 0)
	return { phone: height(8), desktop: height(26) }
}

function bodyHeight(
	id: string,
	media: Media,
	{ episodeGrid }: { episodeGrid: EpisodeGrid | null },
): ReservedHeight {
	switch (id) {
		case "watch": {
			// The toolbar, a row per service (five at most before "All N services"), the rows under them.
			const services = new Set(
				media.streaming_availabilities
					.filter((a) => STREAM_TYPES.has(a.streaming_type))
					.map((a) => a.streaming_service_id),
			).size
			return same(70 + Math.min(5, Math.max(1, services)) * 64 + 60)
		}
		case "fingerprint":
			// The effect lines and the print (beside them from md up); the same on every saved title.
			return { phone: 548, desktop: 387 }
		case "at-a-glance":
			// Four closed rows: Facts, Content, Starring, Made by.
			return { phone: 500, desktop: 282 }
		case "tropes":
			// Two trope cards and the way to every trope.
			return { phone: 420, desktop: 242 }
		case "episodes":
			return episodeGrid ? episodeGridHeight(episodeGrid) : same(0)
		case "more-like-this": {
			// A row of posters a shelf (Feels the same, Most like it, the people, the genre), a movie's series first.
			const series = media.mediaType === "movie" && media.movie_series ? 300 : 0
			return { phone: 4 * 330 + series, desktop: 4 * 345 + series }
		}
	}
	return same(0)
}

/** The reserved height of the section `id`, frame included. */
export function sectionHeight(
	id: string,
	media: Media,
	data: { episodeGrid: EpisodeGrid | null },
): ReservedHeight {
	return add(FRAME, bodyHeight(id, media, data))
}
