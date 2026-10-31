import type { TitleCard } from "~/server/title-cards.server"
import { type ActionsPlacement, MovieTvCard } from "~/ui/MovieTvCard"
import type { ImagePriority } from "~/utils/tmdb-image"

// The poster card for a title card from getTitleCards: its services (the card shows the viewer's own), and its rating
// badge while an age limit is on.
export function TitlePosterCard({
	card,
	prefetch,
	posterPriority,
	skipOffscreen,
	actions,
	newOn,
	onOpen,
}: {
	card: TitleCard
	prefetch?: boolean
	/** Set by a page for the cards it shows without scrolling. Every other poster loads lazily. */
	posterPriority?: ImagePriority
	/** For a card far down a long grid, see MovieTvCard. */
	skipOffscreen?: boolean
	/** Where the title actions sit on the poster, see MovieTvCard. */
	actions?: ActionsPlacement | false
	/** The service the title is new on for the viewer (#489), by id, see MovieTvCard. */
	newOn?: number | null
	/** The page's own view of the title, opened in place of the title page, see MovieTvCard. */
	onOpen?: () => void
}) {
	const details = {
		...card,
		streaming_links: card.services?.map((service) => ({
			provider_id: service.id,
			provider_name: service.name,
			provider_logo_path: service.logo_path,
		})),
	}
	return (
		<MovieTvCard
			details={details}
			mediaType={card.media_type}
			prefetch={prefetch}
			posterPriority={posterPriority}
			skipOffscreen={skipOffscreen}
			actions={actions}
			newOn={newOn}
			onOpen={onOpen}
			rating={card.rating}
		/>
	)
}
