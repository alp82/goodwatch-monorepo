import type { TitleCard } from "~/server/title-cards.server"
import { MovieTvCard } from "~/ui/MovieTvCard"
import type { ActionsPlacement } from "~/ui/title-actions/TitleActionsFrame"
import type { ImagePriority } from "~/utils/tmdb-image"

// The existing poster card for a title card from getTitleCards: its services as streaming badges, its taste match as
// the pill under the GoodWatch score, and its rating badge above the title while an age limit is on.
export function TitlePosterCard({
	card,
	prefetch,
	posterPriority,
	skipOffscreen,
	actions,
}: {
	card: TitleCard
	prefetch?: boolean
	/** Set by a page for the cards it shows without scrolling. Every other poster loads lazily. */
	posterPriority?: ImagePriority
	/** For a card far down a long grid, see MovieTvCard. */
	skipOffscreen?: boolean
	/** Where the title actions sit on the poster, see MovieTvCard. */
	actions?: ActionsPlacement | false
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
			taste={{ match: card.match, reasons: card.reasons }}
			rating={card.rating}
		/>
	)
}
