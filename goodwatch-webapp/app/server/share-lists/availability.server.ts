// Where the titles of a share list stream in one country, from the streaming_availability data that title pages use.
// Two queries per list, however many titles it has: the offers, then the services they name.
import type { ListEntry } from "~/server/share-lists/titles.server"
import { type MediaType, titleKey } from "~/ui/share-card/model"
import { AVAILABILITY_MAX_AGE_MS } from "~/utils/availability-evidence"
import { query } from "~/utils/crate"
import {
	brandName,
	getShorterProviderLabel,
	ignoredProviders,
} from "~/utils/streaming-links"

export type OfferKind = "stream" | "rent" | "buy"

export interface ListOffer {
	serviceId: number
	name: string
	logo: string
	url: string | null
	kind: OfferKind
}

export interface TitleAvailability {
	// "current": offers checked in the last 30 days. "unknown": only older checks on record (Unknown availability).
	// "none": no offer on record for this country.
	state: "current" | "unknown" | "none"
	offers: ListOffer[]
}

const KIND: Record<string, OfferKind> = {
	flatrate: "stream",
	flatrate_and_buy: "stream",
	free: "stream",
	ads: "stream",
	rent: "rent",
	buy: "buy",
}
const KIND_ORDER: OfferKind[] = ["stream", "rent", "buy"]

type OfferRow = {
	media_type: MediaType
	media_tmdb_id: number
	streaming_type: string
	streaming_service_id: number
	stream_url: string | null
	tmdb_link: string | null
	updated_at: string | number | Date | null
}
type ServiceRow = {
	tmdb_id: number
	name: string
	logo_path: string | null
	order_by_country: Record<string, number> | null
}

const asCountry = (country: string) =>
	/^[A-Z]{2}$/.test(country) ? country : null

/** Offers per title key ("movie:603"), best first: streaming before rent and buy, then the country's service order. */
export async function getListAvailability(
	entries: ListEntry[],
	rawCountry: string,
): Promise<Record<string, TitleAvailability>> {
	const country = asCountry(rawCountry.toUpperCase())
	const result: Record<string, TitleAvailability> = {}
	for (const e of entries)
		result[titleKey(e.media_type, e.tmdb_id)] = { state: "none", offers: [] }
	if (!country || !entries.length) return result

	const byType = (type: MediaType) => [
		...new Set(
			entries.filter((e) => e.media_type === type).map((e) => e.tmdb_id),
		),
	]
	const clauses: string[] = []
	const params: (string | number)[] = [country]
	for (const type of ["movie", "show"] as const) {
		const ids = byType(type)
		if (!ids.length) continue
		clauses.push(
			`(media_type = '${type}' AND media_tmdb_id IN (${ids.map(() => "?").join(",")}))`,
		)
		params.push(...ids)
	}
	const rows = await query<OfferRow>(
		`SELECT media_type, media_tmdb_id, streaming_type, streaming_service_id, stream_url, tmdb_link, updated_at
		 FROM streaming_availability WHERE country_code = ? AND (${clauses.join(" OR ")}) LIMIT 2000`,
		params,
	)
	const offerRows = rows.filter(
		(r) =>
			KIND[r.streaming_type] &&
			!ignoredProviders.includes(r.streaming_service_id),
	)
	if (!offerRows.length) return result

	const serviceIds = [...new Set(offerRows.map((r) => r.streaming_service_id))]
	// The whole order object: subscripting a country the object has never seen fails the query in Crate.
	const services = await query<ServiceRow>(
		`SELECT tmdb_id, name, logo_path, order_by_country
		 FROM streaming_service WHERE tmdb_id IN (${serviceIds.map(() => "?").join(",")})`,
		serviceIds,
	)
	const serviceById = new Map(services.map((s) => [s.tmdb_id, s]))

	// Only offers checked in the last 30 days count. A title with nothing but older rows has Unknown availability.
	const now = Date.now()
	const offers = new Map<string, (ListOffer & { rank: number })[]>()
	for (const r of offerRows) {
		const key = titleKey(r.media_type, r.media_tmdb_id)
		if (!(key in result)) continue
		const checked =
			r.updated_at == null ? Number.NaN : new Date(r.updated_at).getTime()
		const fresh =
			Number.isFinite(checked) &&
			checked <= now &&
			now - checked < AVAILABILITY_MAX_AGE_MS
		if (!fresh) {
			if (!offers.has(key)) result[key] = { state: "unknown", offers: [] }
			continue
		}
		const service = serviceById.get(r.streaming_service_id)
		if (!service) continue
		const list = offers.get(key) ?? []
		list.push({
			serviceId: r.streaming_service_id,
			name: brandName(getShorterProviderLabel(service.name)),
			logo: service.logo_path
				? `https://image.tmdb.org/t/p/w92${service.logo_path}`
				: "",
			url: r.stream_url || r.tmdb_link,
			kind: KIND[r.streaming_type],
			rank: service.order_by_country?.[country] ?? 999,
		})
		offers.set(key, list)
	}

	for (const [key, list] of offers) {
		const seen = new Set<string>()
		const sorted = list
			.sort(
				(a, b) =>
					KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) ||
					a.rank - b.rank,
			)
			// One offer per brand and kind: JustWatch lists channels and plan tiers separately.
			.filter((o) => {
				const id = `${o.kind}:${o.name}`
				if (seen.has(id)) return false
				seen.add(id)
				return true
			})
			.map(({ rank, ...offer }) => offer)
		result[key] = { state: "current", offers: sorted }
	}
	return result
}
