// A profile title (Taste portrait, a member's Wishlist, the compare banner) as the site's poster card: the score pill
// with the GoodWatch score and the viewer's own score, and the title actions. Profile titles carry no availability, so
// the card shows no service logos.
import type { ProfileTitle } from "~/domain/profile"
import { MovieTvCard } from "~/ui/MovieTvCard"
import { POSTER_ROW_SIZES, type PosterProps } from "~/ui/Poster"

/** The width of a card three (phones) or four to a row in a panel (taste groups, the compare banner's picks). */
export const PANEL_CARD_SIZES: PosterProps["sizes"] = [
	["(min-width: 768px)", "130px"],
	[null, "30vw"],
]

export function ProfileCard({
	title,
	skipWant = false,
	posterPriority,
	posterSizes = POSTER_ROW_SIZES,
}: {
	title: ProfileTitle
	posterPriority?: PosterProps["priority"]
	/** The poster's displayed widths; a row's by default. */
	posterSizes?: PosterProps["sizes"]
	/** The list is the viewer's own Wishlist: the pill leaves out the bookmark. */
	skipWant?: boolean
}) {
	return (
		<MovieTvCard
			posterPriority={posterPriority}
			posterPaintBeforeScripts={posterPriority === "high"}
			details={{
				tmdb_id: title.tmdbId,
				title: title.title,
				release_year: title.year,
				poster_path: title.poster,
				goodwatch_overall_score_normalized_percent: title.gw,
			}}
			mediaType={title.mediaType}
			skipWant={skipWant}
			posterSizes={posterSizes}
		/>
	)
}
