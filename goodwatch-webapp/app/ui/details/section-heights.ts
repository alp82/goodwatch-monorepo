// Estimated heights of the title page's sections, in pixels. The browser reserves them for a section it hasn't laid
// out yet (see below-fold.tsx). An estimate only has to be close: a section gets its real height before it scrolls
// into view, and the browser remembers it from then on.
//
// Measured on phones (390 px wide) and desktops (1,440 px wide) on the saved titles. Keep them in step with the
// sections' markup (title-sections.tsx).
import type { EpisodeGrid } from "~/server/episode-grid.server"
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import type { TitleQuestion } from "~/ui/details/titleQuestions"

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
	{
		episodeGrid,
		questions,
	}: { episodeGrid: EpisodeGrid | null; questions: TitleQuestion[] },
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
			// The drawing, the dials, and the results; the same height on every saved title (1,128-1,184 px on a phone).
			return { phone: 1058, desktop: 691 }
		case "episodes":
			return episodeGrid ? episodeGridHeight(episodeGrid) : same(0)
		case "story":
			return { phone: 400, desktop: 320 }
		case "cast": {
			// Search and tiers, then 24 people: 12 rows of two on a phone, 8 rows of three on a desktop.
			const rows = (perRow: number) =>
				Math.ceil(Math.min(24, media.cast.length) / perRow)
			return { phone: 200 + rows(2) * 52, desktop: 160 + rows(3) * 52 }
		}
		case "crew":
			return { phone: 520, desktop: 320 }
		case "related": {
			// The related map and the genre row, and a movie's series as a list.
			const films =
				media.mediaType === "movie"
					? (media.movie_series?.movie_ids?.length ?? 0)
					: 0
			const series = films ? 80 + films * 81 : 0
			return { phone: 974 + series, desktop: 858 + series }
		}
		case "facts":
			return { phone: 330, desktop: 300 }
		case "tropes":
			return { phone: 280, desktop: 115 }
		case "faq":
			return {
				phone: 60 + questions.length * 290,
				desktop: 60 + questions.length * 160,
			}
	}
	return same(0)
}

/** The reserved height of the section `id`, frame included. */
export function sectionHeight(
	id: string,
	media: Media,
	data: { episodeGrid: EpisodeGrid | null; questions: TitleQuestion[] },
): ReservedHeight {
	return add(FRAME, bodyHeight(id, media, data))
}
