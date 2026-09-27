import type { TitleCard } from "~/server/title-cards.server"
import { MovieTvCard } from "~/ui/MovieTvCard"

// The existing poster card for a title card from getTitleCards: its services as streaming badges and its taste match
// as the pill under the GoodWatch score.
export function TitlePosterCard({
	card,
	prefetch,
}: {
	card: TitleCard
	prefetch?: boolean
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
			taste={{ match: card.match, reasons: card.reasons }}
		/>
	)
}
