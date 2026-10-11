import type { MovieResult, ShowResult } from "~/server/types/details-types"
import { regionName } from "~/utils/display-names"
import {
	OFFER_TABS,
	type OfferTab,
	brandName,
	getShorterProviderLabel,
} from "~/utils/streaming-links"

type Media = MovieResult | ShowResult

/** "Not streaming in Germany", "Also for rent in 3 other countries". */
export const OFFER_VERB: Record<OfferTab, string> = {
	flatrate: "streaming",
	rent: "for rent",
	buy: "for sale",
}

export interface CountryCount {
	code: string
	name: string
	/** How many services the country has for the tab. */
	count: number
}

export type CountryService = { id: number; name: string; logoPath: string }

/** The countries that have the title for the tab, most services first, then by name. */
export function countriesWithOffers(
	media: Media,
	tab: OfferTab,
): CountryCount[] {
	const index = OFFER_TABS.indexOf(tab)
	return Object.entries(media.streaming_countries?.counts ?? {})
		.map(([code, counts]) => ({
			code,
			name: regionName(code),
			count: counts[index] ?? 0,
		}))
		.filter((c) => c.count > 0)
		.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
}

/** The three countries besides the current one with most services for the tab, with their services. */
export function topCountries(
	media: Media,
	tab: OfferTab,
	current: string,
): (CountryCount & { services: CountryService[] })[] {
	const catalog = new Map(
		(media.streaming_services ?? []).map((s) => [s.tmdb_id, s]),
	)
	return (media.streaming_countries?.top[tab] ?? [])
		.filter((c) => c.country_code !== current)
		.slice(0, 3)
		.map((c) => ({
			code: c.country_code,
			name: regionName(c.country_code),
			count: c.ids.length,
			services: toServices(c.ids, catalog),
		}))
}

/** The services of these ids that a catalog names, for their logos. */
export function toServices(
	ids: number[],
	catalog: ReadonlyMap<number, { name: string; logo: string }>,
): CountryService[] {
	return ids.flatMap((id) => {
		const s = catalog.get(id)
		return s
			? [
					{
						id,
						name: brandName(getShorterProviderLabel(s.name)),
						logoPath: s.logo,
					},
				]
			: []
	})
}

export const plural = (count: number, word: string, words: string) =>
	`${count} ${count === 1 ? word : words}`
