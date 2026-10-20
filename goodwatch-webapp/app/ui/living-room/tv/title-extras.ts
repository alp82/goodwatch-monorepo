import type { MovieResult, ShowResult } from "~/server/types/details-types"
import type { TitleInput } from "~/ui/fingerprint/fingerprintText"
import {
	brandName,
	getShorterProviderLabel,
	ignoredProviders,
} from "~/utils/streaming-links"

export type TvOffer = {
	id: number
	name: string
	type: string
	url: string
}

export type TvTitleExtras = {
	country: string
	offers: TvOffer[]
	trailer: string | null
	fingerprint: TitleInput | null
}

/** Only catalog offer URLs may claim to open a provider. Missing links remain on Where to watch. */
export function directOffers(
	media: Pick<
		MovieResult | ShowResult,
		"streaming_availabilities" | "streaming_services"
	>,
): TvOffer[] {
	return (media.streaming_availabilities ?? []).flatMap((offer) => {
		const service = media.streaming_services?.find(
			(s) => s.tmdb_id === offer.streaming_service_id,
		)
		if (
			!service ||
			ignoredProviders.includes(service.tmdb_id) ||
			!offer.stream_url
		)
			return []
		try {
			const url = new URL(offer.stream_url)
			if (url.protocol !== "https:" && url.protocol !== "http:") return []
		} catch {
			return []
		}
		return [
			{
				id: service.tmdb_id,
				name: brandName(getShorterProviderLabel(service.name)),
				type: offer.streaming_type,
				url: offer.stream_url,
			},
		]
	})
}

/** Prefer the viewer's subscription/free offers. Rental and purchase never masquerade as subscriptions. */
export function primaryOffer(
	offers: readonly TvOffer[],
	mine: readonly { id: number }[],
): TvOffer | null {
	const own = new Set(mine.map((s) => s.id))
	const streaming = offers.filter((o) =>
		["flatrate", "flatrate_and_buy", "free", "ads"].includes(o.type),
	)
	return streaming.find((o) => own.has(o.id)) ?? streaming[0] ?? null
}
