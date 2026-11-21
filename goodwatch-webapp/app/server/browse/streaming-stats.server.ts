// A country's streaming services with the numbers that tell them apart, for Browse's streaming index:
//
// - From Crate, three grouped statements per country (well under a second each): what each service carries, and what
//   arrived (not backfilled) and left in the last 30 days. They sit in the shared Redis cache for six hours, so the
//   fleet reads Crate four times a day per country and a fresh process reads one key.
// - From memory, one pass over the well-known titles against the country's availability index: how many of the
//   country's 1,000 most popular titles each service carries (the default sort), how many score 80 or more, and a few
//   of its best titles. Memoized per title snapshot and availability load, so it runs once per refresh and process.
//
// The caller passes the well-known rows (the Browse lists' own rows, most popular first) so that "well-known" means
// the same here as on every Browse list. Names and logos come from the service cards.
import {
	MIN_SERVICE_TITLES,
	PLAN_TYPES,
	type ServiceCountRow,
	type ServiceNumbers,
	type ServiceSort,
	type StreamKind,
	type StreamModel,
	countPerGroup,
	foldTiers,
	groupsOf,
	serviceGroupOf,
	sortServices,
} from "~/domain/browse/streaming-stats"
import { brandOfService } from "~/domain/new-on-services"
import {
	availabilityLoaded,
	availabilityLoadedAt,
	countryServices,
} from "~/server/availability-index.server"
import { getServiceCards } from "~/server/title-cards.server"
import { getTitleSnapshot } from "~/server/title-snapshot/index.server"
import { UNKNOWN_SCORE } from "~/server/title-snapshot/format.server"
import { cached } from "~/utils/cache"
import { query } from "~/utils/crate"
import type { TitleKey } from "~/utils/title-key"
import { createVersionMemo } from "./version-memo"

const DAY_MS = 86_400_000
const GREAT = 80
const POPULAR_TOP = 1000
const PICKS = 4
const marks = PLAN_TYPES.map(() => "?").join(", ")

// ---------------------------------------------------------------------------------------------------------
// Crate reads (shared cache)

export type CountryOffers = {
	code: string
	/** Plan offers in the country (for ordering the picker). */
	offers: number
}

async function readCountries(): Promise<{ countries: CountryOffers[] }> {
	const rows = await query<{ country_code: string; n: number }>(
		`SELECT country_code, count(*) AS n FROM streaming_availability
		  WHERE streaming_type IN (${marks}) GROUP BY country_code ORDER BY n DESC LIMIT 400`,
		[...PLAN_TYPES],
		{ timeoutMs: 10_000 },
	)
	return {
		countries: rows
			.filter((r) => /^[A-Z]{2}$/.test(r.country_code))
			.map((r) => ({ code: r.country_code, offers: Number(r.n) })),
	}
}

/** Every country with plan offers, most offers first. */
export async function streamingCountries(): Promise<CountryOffers[]> {
	const { countries } = await cached({
		name: "browse-streaming-countries-v1",
		params: {},
		ttlMinutes: 12 * 60,
		staleMinutes: 24 * 60,
		target: readCountries,
	})
	return countries
}

export type CountryCounts = {
	catalog: ServiceCountRow[]
	arrived: ServiceCountRow[]
	left: ServiceCountRow[]
}

async function readCounts({ country }: { country: string }): Promise<CountryCounts> {
	const since = Date.now() - 30 * DAY_MS
	const [catalog, arrived, left] = await Promise.all([
		query<ServiceCountRow>(
			`SELECT streaming_service_id, media_type, streaming_type, count(DISTINCT media_tmdb_id) AS n
			   FROM streaming_availability WHERE country_code = ? AND streaming_type IN (${marks})
			  GROUP BY streaming_service_id, media_type, streaming_type LIMIT 20000`,
			[country, ...PLAN_TYPES],
			{ timeoutMs: 10_000 },
		),
		query<ServiceCountRow>(
			`SELECT streaming_service_id, media_type, count(DISTINCT media_tmdb_id) AS n FROM availability_history
			  WHERE country_code = ? AND streaming_type IN (${marks}) AND appeared_source <> 'backfill'
			    AND appeared_on >= ? GROUP BY streaming_service_id, media_type LIMIT 20000`,
			[country, ...PLAN_TYPES, since],
			{ timeoutMs: 10_000 },
		),
		query<ServiceCountRow>(
			`SELECT streaming_service_id, media_type, count(DISTINCT media_tmdb_id) AS n FROM availability_history
			  WHERE country_code = ? AND streaming_type IN (${marks}) AND dropped_on >= ?
			  GROUP BY streaming_service_id, media_type LIMIT 20000`,
			[country, ...PLAN_TYPES, since],
			{ timeoutMs: 10_000 },
		),
	])
	const plain = (rows: ServiceCountRow[]) =>
		rows.map((r) => ({
			streaming_service_id: Number(r.streaming_service_id),
			media_type: r.media_type,
			...(r.streaming_type ? { streaming_type: r.streaming_type } : {}),
			n: Number(r.n),
		}))
	return { catalog: plain(catalog), arrived: plain(arrived), left: plain(left) }
}

/** What each service carries in a country, and what came and went in the last 30 days (grouped rows). */
export const streamingCounts = (country: string): Promise<CountryCounts> =>
	cached({
		name: "browse-streaming-counts-v1",
		params: { country: country.toUpperCase() },
		ttlMinutes: 6 * 60,
		staleMinutes: 24 * 60,
		target: readCounts,
	})

// ---------------------------------------------------------------------------------------------------------
// Reach over the well-known titles (memory)

export interface ServiceReach {
	popular: number
	great: number
	/** Up to four of its best well-known titles: scored 80+ first, then its most popular. */
	picks: TitleKey[]
}

const reachMemo = createVersionMemo<Map<string, ServiceReach> | null>(64)

/**
 * Per service group: how many of the country's 1,000 most popular well-known titles it carries, how many of its
 * well-known titles score 80+, and a few picks. Null while the country's availability or the snapshot loads.
 */
export function serviceReach(
	country: string,
	rowsKey: string,
	wellKnownRows: readonly number[],
): Map<string, ServiceReach> | null {
	const code = country.toUpperCase()
	const index = countryServices(code)
	const snap = getTitleSnapshot()
	if (!index || !snap) return null
	const version = `${snap.version}|${availabilityLoadedAt(code) ?? 0}`
	return reachMemo.get(version, `${code}|${rowsKey}`, () => {
		const c = snap.columns
		const groupAt = index.services.map(serviceGroupOf)
		const out = new Map<string, ServiceReach>()
		const backup = new Map<string, TitleKey[]>()
		const entry = (g: string) => {
			let r = out.get(g)
			if (!r) out.set(g, (r = { popular: 0, great: 0, picks: [] }))
			return r
		}
		let streamed = 0
		for (const row of wellKnownRows) {
			const key = c.pointIds[row]
			const sr = index.rowOf(key)
			if (sr < 0) continue
			const top = streamed++ < POPULAR_TOP
			const score = c.scores[row]
			const seen = new Set<string>()
			for (let i = index.offsets[sr]; i < index.offsets[sr + 1]; i++) {
				const g = groupAt[index.entries[i]]
				if (seen.has(g)) continue
				seen.add(g)
				const r = entry(g)
				if (top) r.popular++
				if (score !== UNKNOWN_SCORE && score >= GREAT) {
					r.great++
					if (r.picks.length < PICKS) r.picks.push(key)
				} else {
					const spare = backup.get(g) ?? []
					if (spare.length < PICKS) backup.set(g, [...spare, key])
				}
			}
		}
		for (const [g, r] of out)
			if (r.picks.length < PICKS)
				r.picks.push(...(backup.get(g) ?? []).slice(0, PICKS - r.picks.length))
		return out
	})
}

// ---------------------------------------------------------------------------------------------------------
// The directory

export interface StreamingService extends ServiceNumbers {
	/** `brand:<slug>` or `id:<service id>`. */
	key: string
	name: string
	logoPath: string | null
	/** A brand with a service page: its slug. */
	brandSlug: string | null
	/** Its service ids (for a Discover link when it has no page). */
	serviceIds: number[]
	model: StreamModel
	picks: TitleKey[]
}

export interface StreamingDirectory {
	country: string
	kind: StreamKind
	services: StreamingService[]
	/** False while the country's availability index or the snapshot loads: popular, great and picks are 0 or empty. */
	ready: boolean
}

/**
 * Every service of a country with enough titles of the kind, tiers folded into their brand, in the given order
 * (default: most popular). `wellKnownRows` are the Browse lists' well-known snapshot rows of the kind, most popular
 * first; `rowsKey` names them for the memo (for example the kind).
 */
export async function streamingDirectory({
	country,
	kind,
	wellKnownRows,
	rowsKey = kind,
	sort = "popular",
	waitMs = 6000,
}: {
	country: string
	kind: StreamKind
	wellKnownRows: readonly number[]
	rowsKey?: string
	sort?: ServiceSort
	waitMs?: number
}): Promise<StreamingDirectory> {
	const code = country.toUpperCase()
	// Asking for the index starts its load; a country's first request waits a few seconds for it.
	if (!countryServices(code)) await availabilityLoaded(code, waitMs)
	const counts = await streamingCounts(code)
	const titles = countPerGroup(counts.catalog, kind)
	const arrived = countPerGroup(counts.arrived, kind)
	const left = countPerGroup(counts.left, kind)
	const groups = groupsOf(counts.catalog, kind)
	const reach = serviceReach(code, rowsKey, wellKnownRows)

	const shown = [...titles].filter(([, n]) => n >= MIN_SERVICE_TITLES).map(([g]) => g)
	// Names and logos: a brand by its logo id, any other service by its own ids.
	const leadIds = (g: string) => {
		const ids = groups.get(g)?.ids ?? []
		const brand = g.startsWith("brand:") ? brandOfService(ids[0]) : null
		return brand ? [brand.logo, ...ids] : ids
	}
	const cards = await getServiceCards([...new Set(shown.flatMap(leadIds))]).catch(() => [])
	const card = new Map(cards.map((s) => [s.id, s]))

	const services: StreamingService[] = []
	for (const g of shown) {
		const named = leadIds(g)
			.map((id) => card.get(id))
			.find(Boolean)
		if (!named) continue
		const ids = groups.get(g)?.ids ?? []
		const brand = g.startsWith("brand:") ? brandOfService(ids[0]) : null
		const r = reach?.get(g)
		services.push({
			key: g,
			name: brand?.name ?? named.name,
			logoPath: named.logo_path ?? null,
			brandSlug: brand?.slug ?? null,
			serviceIds: ids,
			model: groups.get(g)?.model ?? "plan",
			titles: titles.get(g) ?? 0,
			arrived: arrived.get(g) ?? 0,
			left: left.get(g) ?? 0,
			popular: r?.popular ?? 0,
			great: r?.great ?? 0,
			picks: r?.picks ?? [],
		})
	}
	return {
		country: code,
		kind,
		services: sortServices(foldTiers(services), sort),
		ready: reach !== null,
	}
}
