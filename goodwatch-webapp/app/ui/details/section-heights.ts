// Estimated heights of the title page sections below the fold, in pixels. The browser reserves them for a section
// it hasn't laid out yet (see below-fold.tsx). An estimate only has to be close: a section gets its real height
// before it scrolls into view, and the browser remembers it from then on.
//
// The numbers are measured on phones (412 px wide) and desktops (1,440 px wide) across titles with and without a
// poster, cast, trailer, collection, and streaming offers. Keep them in step with the sections' markup.
import type { EpisodeGrid } from "~/server/episode-grid.server"
import type { MovieResult, ShowResult } from "~/server/types/details-types"

type Media = MovieResult | ShowResult

export interface ReservedHeight {
	/** Below the md breakpoint. */
	phone: number
	/** From the md breakpoint up. */
	desktop: number
}

const same = (height: number): ReservedHeight => ({
	phone: height,
	desktop: height,
})

// Synopsis, tagline, and tags. The text length moves it by about 100 px either way.
export const aboutHeight = (): ReservedHeight => ({ phone: 540, desktop: 390 })

// One carousel row of round photos, or nothing without a cast.
export const actorsHeight = (media: Media): ReservedHeight =>
	same(media.cast.length ? 236 : 0)

// The heading and up to four crew lines. A line stacks its label above the names on a phone.
export function crewHeight(media: Media): ReservedHeight {
	const { directors, writers, producers, composers } = media.crew
	const lines = [directors, writers, producers, composers].filter(
		(people) => people.length,
	).length
	const gaps = Math.max(lines - 1, 0) * 24
	return { phone: 64 + lines * 52 + gaps, desktop: 64 + lines * 24 + gaps }
}

// The tab row, the panel's description, and two carousel rows. Without a fingerprint the section is empty.
export const relatedHeight = (media: Media): ReservedHeight =>
	media.fingerprint ? { phone: 660, desktop: 764 } : same(0)

// The related titles as a map (ui/related-map). Its height is fixed by its style: the same for every title.
export const relatedMapHeight = (): ReservedHeight => ({
	phone: 602,
	desktop: 576,
})

// A grid of the collection's posters, two per row on a phone and six on a desktop, or one line of text.
export function sequelsHeight(media: Media): ReservedHeight {
	const count =
		media.mediaType === "movie"
			? (media.movie_series?.movie_ids?.length ?? 0)
			: 0
	if (!count) return same(112)
	const rows = (perRow: number, card: number) => {
		const n = Math.ceil(count / perRow)
		return 104 + n * card + (n - 1) * 16
	}
	return { phone: rows(2, 269), desktop: rows(6, 280) }
}

// The tabs and one video at 16:9 across the content width. The section opens on the trailers (see Media.tsx), so
// without a trailer it is the heading and the tabs.
export const mediaHeight = (media: Media): ReservedHeight =>
	media.videos?.trailers?.length ? { phone: 360, desktop: 840 } : same(130)

// One card per question, in one column on a phone and two on a desktop.
export const questionsHeight = (count: number): ReservedHeight =>
	count ? { phone: 60 + count * 250, desktop: 60 + count * 135 } : same(0)

// The episode grid shows seasons as rows when its box fits every episode column, and as columns otherwise
// (see EpisodeGrid.tsx): up to 6 episode columns fit on a phone, and up to 26 on a desktop.
export function episodeGridHeight(grid: EpisodeGrid): ReservedHeight {
	const columns = grid.maxEpisodeNumber - (grid.hasEpisodeZero ? 0 : 1) + 1
	const asRows =
		100 + grid.seasons.length * 35 + (grid.specials.length ? 48 : 0)
	const asColumns = 121 + Math.max(columns, grid.specials.length) * 31
	return {
		phone: columns <= 6 ? asRows : asColumns,
		desktop: columns <= 26 ? asRows : asColumns,
	}
}
