import type { Watchability } from "../../utils/availability-evidence.ts"
import {
	duplicateProviderMapping,
	getStreamingUrl,
} from "../../utils/streaming-links.ts"
import { tmdbImageUrl } from "../../utils/tmdb-image.ts"

const httpUrl = (url: string | null | undefined) => {
	if (!url) return null
	try {
		return ["http:", "https:"].includes(new URL(url).protocol) ? url : null
	} catch {
		return null
	}
}

export const providerFamily = (id: number) => {
	const parent = Object.entries(duplicateProviderMapping).find(
		([root, children]) => Number(root) === id || children.includes(id),
	)
	return parent ? [Number(parent[0]), ...parent[1]] : [id]
}

/** Only eligible evidence offers reach here. A catalog link augments the URL, never the availability claim. */
export function linkedAvailability(
	availability: Watchability,
	title: { media_type: "movie" | "show"; tmdb_id: number },
	country: string,
	names: ReadonlyMap<number, string>,
	links: readonly {
		service_id: number
		offer_type: string
		stream_url: string | null
	}[],
	/** TMDB logo paths by service ID, for the poster cards' Watch button. */
	logos: ReadonlyMap<number, string | null | undefined> = new Map(),
	/** Site provider order: streaming_service.order_by_country, falling back to order_default. */
	priorities: ReadonlyMap<number, number> = new Map(),
) {
	const seen = new Set<string>()
	const offers = availability.offers.flatMap((offer) => {
		const family = providerFamily(offer.service_id)
		const identity = `${family[0]}:${offer.offer_type}`
		if (seen.has(identity)) return []
		seen.add(identity)
		const same = (item: { service_id: number; offer_type: string }) =>
			family.includes(item.service_id) && item.offer_type === offer.offer_type
		const direct =
			httpUrl(offer.stream_url) ??
			availability.offers
				.filter(same)
				.map((item) => httpUrl(item.stream_url))
				.find(Boolean) ??
			links
				.filter(same)
				.map((item) => httpUrl(item.stream_url))
				.find(Boolean) ??
			null
		const name = family.map((id) => names.get(id)).find(Boolean)
		const logo = family.map((id) => logos.get(id)).find(Boolean)
		const url = getStreamingUrl(
			{ stream_url: direct },
			title,
			country,
			title.media_type,
		)
		const label = (name ?? `Service ${offer.service_id}`).replace(
			/[\\[\]]/g,
			"\\$&",
		)
		const stream_link = `[${label}](${url.replace(/\(/g, "%28").replace(/\)/g, "%29")})`
		return [
			{
				...offer,
				stream_url: direct,
				...(name ? { name } : {}),
				...(logo ? { logo_url: tmdbImageUrl(logo, "w92") } : {}),
				url,
				stream_link,
				link_kind: direct ? "provider" : "where_to_watch",
			},
		]
	})
	const rank = (id: number) =>
		providerFamily(id)
			.map((member) => priorities.get(member))
			.find((priority) => priority !== undefined) ?? Number.POSITIVE_INFINITY
	// Stable sorting preserves evidence order for equally ranked or unknown providers.
	offers.sort((a, b) => rank(a.service_id) - rank(b.service_id))
	return { ...availability, country, offers }
}
