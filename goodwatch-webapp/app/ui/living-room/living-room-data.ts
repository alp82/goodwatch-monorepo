import type { PresentedMedia } from "~/utils/media-presentation"
// What the start page's server HTML holds below the room, shared by the server and the browser.
import type { TitleCard } from "~/server/title-cards.server"

/** A title the start page links to below the living room (#352). The same list for everyone. */
export type StartTitle = PresentedMedia & Pick<
	TitleCard,
	"media_type" | "tmdb_id" | "title" | "release_year" | "poster_path"
>
