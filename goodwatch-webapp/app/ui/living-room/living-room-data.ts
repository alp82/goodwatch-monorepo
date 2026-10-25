import type { PresentedMedia } from "~/utils/media-presentation"
// What the start page's server HTML holds below the room, shared by the server and the browser.
import type { TitleCard } from "~/server/title-cards.server"

/**
 * A title the start page links to below the living room (#352). The same list for everyone. The GoodWatch score is
 * for the poster card's pill, in whole points (the pill shows it rounded down). No services: they depend on the
 * viewer's country, and the list is the same for everyone; a guest's card shows none anyway.
 */
export type StartTitle = PresentedMedia &
	Pick<
		TitleCard,
		| "media_type"
		| "tmdb_id"
		| "title"
		| "release_year"
		| "poster_path"
		| "goodwatch_overall_score_normalized_percent"
	>
