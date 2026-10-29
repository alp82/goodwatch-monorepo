// The title's offers in a country as links, the member's own services first and marked, for where to watch, the
// "You" block, find in title, and the questions.
import { useUserStreamingProviders } from "~/routes/api.user-settings.get"
import type {
	MovieResult,
	ShowResult,
	StreamingType,
} from "~/server/types/details-types"
import {
	duplicateProviderMapping,
	streamingLinks,
} from "~/utils/streaming-links"

type Media = MovieResult | ShowResult

/** The ids of the member's services, with the ids of the same brand's other entries. */
export function useOwnedProviderIds() {
	return useUserStreamingProviders().flatMap((p) =>
		p.id in duplicateProviderMapping
			? [p.id, ...duplicateProviderMapping[p.id]]
			: [p.id],
	)
}

export function useStreamingLinks(
	media: Media,
	country: string,
	types: StreamingType[],
) {
	return streamingLinks(media, country, types, useOwnedProviderIds())
}

const STREAM_TYPES: StreamingType[] = [
	"flatrate",
	"free",
	"ads",
	"flatrate_and_buy",
]
const RENT_BUY_TYPES: StreamingType[] = ["rent", "buy"]

/** The services that stream the title in the country, and those that rent or sell it. */
export function useStreamNames(media: Media, country: string) {
	const stream = useStreamingLinks(media, country, STREAM_TYPES)
	const rentBuy = useStreamingLinks(media, country, RENT_BUY_TYPES)
	return { stream, rentBuy }
}
