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
	/** The service's logo, a TMDB path, when the catalog has one. */
	logo?: string | null
}

/** The source scores as the title page shows them (ui/details/hero/RatingChips.tsx); null where there is none. */
export type TvSourceScores = {
	imdb: string | null
	mc: string | null
	mcUser: string | null
	rt: string | null
	rtUser: string | null
}

export type TvTitleExtras = {
	country: string
	offers: TvOffer[]
	trailer: string | null
	fingerprint: TitleInput | null
	/** What the title screen tells beyond the card: the synopsis, the genres and every source score. */
	facts?: {
		synopsis: string | null
		genres: string[]
		scores: TvSourceScores
	}
}

/** The source scores of a title's details, as the title page's chips write them. */
export function sourceScores(
	d: Pick<
		MovieResult["details"],
		| "imdb_user_score_original"
		| "metacritic_meta_score_original"
		| "metacritic_user_score_original"
		| "rotten_tomatoes_tomato_score_original"
		| "rotten_tomatoes_audience_score_original"
	>,
): TvSourceScores {
	return {
		imdb: d.imdb_user_score_original ? d.imdb_user_score_original.toFixed(1) : null,
		mc: d.metacritic_meta_score_original
			? String(Math.floor(d.metacritic_meta_score_original))
			: null,
		mcUser: d.metacritic_user_score_original
			? d.metacritic_user_score_original.toFixed(1)
			: null,
		rt: d.rotten_tomatoes_tomato_score_original
			? `${Math.floor(d.rotten_tomatoes_tomato_score_original)}%`
			: null,
		rtUser: d.rotten_tomatoes_audience_score_original
			? `${Math.floor(d.rotten_tomatoes_audience_score_original)}%`
			: null,
	}
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
				logo: service.logo || null,
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

/**
 * The rows of a title screen's Where to watch: the streaming offers, the viewer's own services first, one per
 * service, three of them; with more than three, two and a row to all of them on the title's page (`more`). Rental
 * and purchase are on that page only. Without any, the row to the page alone.
 */
export function whereRows(
	offers: readonly TvOffer[],
	mine: readonly { id: number }[],
): { rows: TvOffer[]; more: boolean } {
	const own = new Set(mine.map((s) => s.id))
	const seen = new Set<string>()
	const streaming = offers
		.filter((o) => ["flatrate", "flatrate_and_buy", "free", "ads"].includes(o.type))
		.sort((a, b) => Number(own.has(b.id)) - Number(own.has(a.id)))
		.filter((o) => {
			if (seen.has(o.name)) return false
			seen.add(o.name)
			return true
		})
	if (streaming.length > 3) return { rows: streaming.slice(0, 2), more: true }
	return { rows: streaming, more: streaming.length === 0 }
}
