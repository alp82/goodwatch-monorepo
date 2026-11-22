// What Browse's streaming index shows. Read-only.
//
// - The streaming index (`/movies/streaming/us`): every service of the country with the few numbers that tell services
//   apart without a legend (streaming-stats.server), plus every country with offers for the picker.
// - A service's page (`/movies/streaming/us/netflix`) is a room page like a decade or a country: place-data.server.ts
//   and ui/browse/room/RoomPage.tsx.
import type { Address, Kind } from "~/domain/browse/address"
import type { ShowTitle } from "~/domain/browse/types"
import type { ServiceSort } from "~/domain/browse/streaming-stats"
import { type FilterState, defaultFilterState, filterQuery } from "~/domain/filter-state"
import { SHAPE_BY_CODE } from "~/ui/browse/world-map/geometry"
import type { Places } from "./places.server"
import { base } from "./rows.server"
import { slim } from "./cards.server"
import { streamingCountries, streamingDirectory } from "./streaming-stats.server"

// ---------------------------------------------------------------------------------------------------------
// The streaming index

export type StreamModel = "plan" | "ads" | "free"
export type StreamRegion = "americas" | "europe" | "asia" | "africa" | "other"

export interface StreamCountry {
	code: string
	name: string
	region: StreamRegion
}

export interface StreamService {
	key: string
	name: string
	logo: string | null
	/** A brand with a service page here: its slug. */
	slug: string | null
	/** Any other service: Discover filtered to it. */
	discover: string | null
	model: StreamModel
	titles: number
	arrived: number
	left: number
	/** Well-known titles scoring 80+; null while the country's availability loads. */
	great: number | null
	/** How many of the country's 1,000 most popular titles it carries (the default order; never shown). */
	popular: number | null
	/** A few of its best well-known titles. */
	picks: ShowTitle[]
}

export interface StreamingIndexData {
	country: StreamCountry
	countries: StreamCountry[]
	services: StreamService[]
	/** False while the country's availability index loads (no scores or picks yet). */
	ready: boolean
}

const names = new Intl.DisplayNames(["en"], { type: "region" })
const nameOf = (code: string) => {
	try {
		return names.of(code) ?? code
	} catch {
		return code
	}
}
const regionOf = (code: string): StreamRegion => SHAPE_BY_CODE.get(code)?.region || "other"
const countryOf = (code: string): StreamCountry => ({
	code,
	name: code === "HK" ? "Hong Kong" : nameOf(code),
	region: regionOf(code),
})

/** Discover filtered to a service that has no page of its own. */
function discoverHref(kind: Kind, country: string, ids: number[]): string {
	const plain = { onMyServices: false, notSeenYet: false }
	const state: FilterState = defaultFilterState(plain)
	state.type = kind
	state.services = ids
	state.streamingCountry = country
	return `/discover?${filterQuery(state, "popular", plain)}`
}

export async function loadStreamingIndex(
	places: Places,
	address: Address,
	sort: ServiceSort = "popular",
): Promise<StreamingIndexData> {
	const code = address.country.toUpperCase()
	const rows = base(places.kind)?.rows ?? []
	const [countries, dir] = await Promise.all([
		streamingCountries().catch(() => []),
		streamingDirectory({ country: code, kind: places.kind, wellKnownRows: rows, sort }),
	])
	// A title may appear on several services. Fetch the picks together through the atlas's batched card reader.
	const picks = [...new Set(dir.services.flatMap((s) => s.picks))]
	const titles = new Map((await places.titlesOf(picks)).map((t) => [t.card.key, slim(t)]))
	const services: StreamService[] = []
	for (const s of dir.services)
		services.push({
			key: s.key,
			name: s.name,
			logo: s.logoPath,
			slug: s.brandSlug,
			discover: s.brandSlug ? null : discoverHref(places.kind, code, s.serviceIds),
			model: s.model,
			titles: s.titles,
			arrived: s.arrived,
			left: s.left,
			great: dir.ready ? s.great : null,
			popular: dir.ready ? s.popular : null,
			picks: s.picks.flatMap((key) => titles.get(key) ?? []),
		})
	const all = countries.map((c) => countryOf(c.code))
	return {
		country: all.find((c) => c.code === code) ?? countryOf(code),
		countries: all,
		services,
		ready: dir.ready,
	}
}

// ---------------------------------------------------------------------------------------------------------
// The route's part

export type StreamingRoute = { page: "streaming"; address: Address; index: StreamingIndexData }

/**
 * Whether an address is the streaming index of a country. One service alone is a room page like a decade or a country
 * (index-pages.server.ts).
 */
export const isStreamingAddress = (a: Address) => a.view === "family" && a.family === "service"

/**
 * The streaming page of an address, or null when it isn't one. Throws a 404 for a country without plan offers (once
 * the list of countries is known).
 */
export async function streamingRoute(
	places: Places,
	address: Address,
	notFound: () => Response,
): Promise<StreamingRoute | null> {
	if (!isStreamingAddress(address)) return null
	const index = await loadStreamingIndex(places, address)
	if (index.countries.length && !index.countries.some((c) => c.code === index.country.code))
		throw notFound()
	return { page: "streaming", address, index }
}
