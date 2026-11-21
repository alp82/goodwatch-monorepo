// PROTOTYPE - throwaway (prototype/explore-r7, slot "streaming"). Every streaming service of a country, with the few
// numbers that tell services apart without a legend: how much it has, how much came and went in the last 30 days,
// how many of its well-known titles score 80 or more, and whether it costs a subscription or is free with ads. Plus
// every country we have offers for, for the picker.
//
// Read-only: three grouped statements on the streaming tables (cached per country for 30 minutes) and one pass over
// the snapshot's well-known titles against the country's availability index.
import { type FilterState, defaultFilterState, filterQuery } from "~/domain/filter-state"
import { baseService } from "~/domain/newly-available"
import { brandOfService } from "~/domain/new-on-services"
import { availabilityLoaded, countryServices } from "~/server/availability-index.server"
import { getServiceCards } from "~/server/title-cards.server"
import { UNKNOWN_SCORE } from "~/server/title-snapshot/format.server"
import { query } from "~/utils/crate"
import type { Kind } from "../../../../kit/address"
import type { Kit } from "../../../../kit/data.server"
import { base } from "../../../../kit/rows.server"
import type { ShowTitle } from "../../../../kit/types"
import { SHAPE_BY_CODE } from "../../../../kit/world-map/geometry"
import { slim } from "../../cards.server"

/** Offer types that come with a plan (not rent or buy), as everywhere on the site. */
const TYPES = ["flatrate", "free", "ads"] as const
/** A service with fewer titles of the kind than this is a channel, not a place to browse. */
const MIN_TITLES = 40
/** "Scored 80 or more": the GoodWatch score shown on every poster. */
const GREAT = 80
const DAY_MS = 86_400_000

export type Model = "plan" | "ads" | "free"
export type Region = "americas" | "europe" | "asia" | "africa" | "other"

export interface StreamCountry {
	code: string
	name: string
	region: Region
}

export interface StreamService {
	key: string
	name: string
	logo: string | null
	/** A brand with a service page here: its slug. */
	slug: string | null
	/** Any other service: Discover filtered to it. */
	discover: string | null
	model: Model
	titles: number
	arrived: number
	left: number
	/** Well-known titles scoring 80+; null while the country's availability loads. */
	great: number | null
	/**
	 * Round 10: how popular the service is here, as how many of the country's 1,000 most popular titles it carries
	 * (the default sort; never shown as a number). Null while the availability loads.
	 */
	popular: number | null
	/** A few of its best well-known titles. */
	picks: ShowTitle[]
}

export interface StreamDir {
	country: StreamCountry
	countries: StreamCountry[]
	kind: Kind
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
const regionOf = (code: string): Region => SHAPE_BY_CODE.get(code)?.region || "other"

// ---------------------------------------------------------------------------------------------------------
// Statements (cached)

const cache = new Map<string, { at: number; value: Promise<unknown> }>()
function cached<T>(id: string, run: () => Promise<T>, ttl = 30 * 60 * 1000): Promise<T> {
	const hit = cache.get(id)
	if (hit && Date.now() - hit.at < ttl) return hit.value as Promise<T>
	const value = run().catch((error) => {
		cache.delete(id)
		throw error
	})
	cache.set(id, { at: Date.now(), value })
	return value
}

const marks = TYPES.map(() => "?").join(", ")

/** Every country with plan offers, most offers first. */
const countriesWithOffers = () =>
	cached("countries", async () => {
		const rows = await query<{ country_code: string; n: number }>(
			`SELECT country_code, count(*) AS n FROM streaming_availability
			  WHERE streaming_type IN (${marks}) GROUP BY country_code ORDER BY n DESC LIMIT 400`,
			[...TYPES],
		)
		return rows
			.filter((r) => /^[A-Z]{2}$/.test(r.country_code))
			.map((r) => ({
				code: r.country_code,
				name: nameOf(r.country_code),
				region: regionOf(r.country_code),
			}))
	})

interface Row {
	streaming_service_id: number
	media_type: string
	n: number
}
interface TypeRow extends Row {
	streaming_type: string
}

const catalog = (country: string) =>
	cached(`catalog|${country}`, () =>
		query<TypeRow>(
			`SELECT streaming_service_id, media_type, streaming_type, count(DISTINCT media_tmdb_id) AS n
			   FROM streaming_availability WHERE country_code = ? AND streaming_type IN (${marks})
			  GROUP BY streaming_service_id, media_type, streaming_type LIMIT 20000`,
			[country, ...TYPES],
		),
	)

/** What landed (not backfilled) or dropped in the last 30 days, per service and kind. */
const changes = (country: string) =>
	cached(`changes|${country}`, async () => {
		const since = Date.now() - 30 * DAY_MS
		const [arrived, left] = await Promise.all([
			query<Row>(
				`SELECT streaming_service_id, media_type, count(DISTINCT media_tmdb_id) AS n FROM availability_history
				  WHERE country_code = ? AND streaming_type IN (${marks}) AND appeared_source <> 'backfill'
				    AND appeared_on >= ? GROUP BY streaming_service_id, media_type LIMIT 20000`,
				[country, ...TYPES, since],
			),
			query<Row>(
				`SELECT streaming_service_id, media_type, count(DISTINCT media_tmdb_id) AS n FROM availability_history
				  WHERE country_code = ? AND streaming_type IN (${marks}) AND dropped_on >= ?
				  GROUP BY streaming_service_id, media_type LIMIT 20000`,
				[country, ...TYPES, since],
			),
		])
		return { arrived, left }
	})

// ---------------------------------------------------------------------------------------------------------
// Grouping: a brand's tiers are one service ("Netflix", "Netflix Standard with Ads"), a duplicate id counts as its
// base service. Tiers carry nearly the same catalog, so a group's number is its largest member's, not their sum.

const groupOf = (id: number) => {
	const brand = brandOfService(id)
	return brand ? `brand:${brand.slug}` : `id:${baseService(id)}`
}
const kindOk = (kind: Kind, mediaType: string) =>
	kind === "all" ||
	(kind === "show" ? mediaType === "tv" || mediaType === "show" : mediaType === "movie")

/** Per group: the largest member's count of the kind (movies and shows add up within a member under /all). */
function perGroup(rows: Row[], kind: Kind): Map<string, number> {
	const byId = new Map<number, number>()
	for (const r of rows)
		if (kindOk(kind, r.media_type))
			byId.set(r.streaming_service_id, (byId.get(r.streaming_service_id) ?? 0) + Number(r.n))
	const out = new Map<string, number>()
	for (const [id, n] of byId) {
		const g = groupOf(id)
		out.set(g, Math.max(out.get(g) ?? 0, n))
	}
	return out
}

function discoverHref(kind: Kind, country: string, ids: number[]): string {
	const plain = { onMyServices: false, notSeenYet: false }
	const state: FilterState = defaultFilterState(plain)
	state.type = kind
	state.services = ids
	state.streamingCountry = country
	return `/discover?${filterQuery(state, "popular", plain)}`
}

// ---------------------------------------------------------------------------------------------------------

const POPULAR_TOP = 1000

export async function streamDir(kit: Kit): Promise<StreamDir> {
	const kind = kit.kind
	const code = kit.country.toUpperCase()
	// Asking for the index starts its load; a country that isn't loaded yet gets a few seconds.
	if (!countryServices(code)) await availabilityLoaded(code, 6000)
	const [countries, rows, moved] = await Promise.all([
		countriesWithOffers().catch(() => [] as StreamCountry[]),
		catalog(code),
		changes(code).catch(() => ({ arrived: [] as Row[], left: [] as Row[] })),
	])

	const titles = perGroup(rows, kind)
	const arrived = perGroup(moved.arrived, kind)
	const left = perGroup(moved.left, kind)
	// What it costs: the offer type that carries most of its titles (Tubi lists a few titles as "flatrate", but it's free).
	const types = new Map<string, Map<string, number>>()
	const members = new Map<string, Set<number>>()
	for (const r of rows) {
		if (!kindOk(kind, r.media_type)) continue
		const g = groupOf(r.streaming_service_id)
		const t = types.get(g) ?? new Map<string, number>()
		t.set(r.streaming_type, (t.get(r.streaming_type) ?? 0) + Number(r.n))
		types.set(g, t)
		members.set(g, (members.get(g) ?? new Set()).add(r.streaming_service_id))
	}
	const modelOf = (g: string): Model => {
		const t = types.get(g) ?? new Map<string, number>()
		const plan = t.get("flatrate") ?? 0
		const ads = t.get("ads") ?? 0
		const free = t.get("free") ?? 0
		return plan >= ads && plan >= free ? "plan" : ads >= free ? "ads" : "free"
	}

	// Scores and picks: one pass over the well-known titles, most popular first.
	const index = countryServices(code)
	const b = base(kind)
	const great = new Map<string, number>()
	const picks = new Map<string, number[]>()
	// Round 9: a small service may have few titles scored 80+, so its fan fills up with its most popular ones.
	const backup = new Map<string, number[]>()
	const popular = new Map<string, number>()
	if (index && b) {
		const c = b.snap.columns
		const groupAt = index.services.map(groupOf)
		// The well-known rows run most popular first; the first 1,000 that stream here count toward "popular".
		let streamed = 0
		for (const r of b.rows) {
			const sr = index.rowOf(c.pointIds[r])
			if (sr < 0) continue
			const top = streamed++ < POPULAR_TOP
			const score = c.scores[r]
			const seen = new Set<string>()
			for (let i = index.offsets[sr]; i < index.offsets[sr + 1]; i++) {
				const g = groupAt[index.entries[i]]
				if (seen.has(g)) continue
				seen.add(g)
				if (top) popular.set(g, (popular.get(g) ?? 0) + 1)
				if (score !== UNKNOWN_SCORE && score >= GREAT) {
					great.set(g, (great.get(g) ?? 0) + 1)
					const mine = picks.get(g) ?? []
					if (mine.length < 4) picks.set(g, [...mine, c.pointIds[r]])
				} else {
					const spare = backup.get(g) ?? []
					if (spare.length < 4) backup.set(g, [...spare, c.pointIds[r]])
				}
			}
		}
	}

	const groups = [...titles].filter(([, n]) => n >= MIN_TITLES).map(([g]) => g)
	// Names and logos: a brand by its logo id, any other service by its own id (the card list drops channels it ignores).
	const lead = (g: string) => {
		const ids = [...(members.get(g) ?? [])]
		if (g.startsWith("brand:")) {
			const brand = brandOfService(ids[0])
			return brand ? [brand.logo, ...ids] : ids
		}
		return ids
	}
	const cards = await getServiceCards([...new Set(groups.flatMap(lead))]).catch(() => [])
	const card = new Map(cards.map((s) => [s.id, s]))

	const services: StreamService[] = []
	for (const g of groups) {
		const ids = lead(g)
		const named = ids.map((id) => card.get(id)).find(Boolean)
		if (!named) continue
		const brand = g.startsWith("brand:") ? brandOfService(ids[0]) : null
		const keys = [...(picks.get(g) ?? []), ...(backup.get(g) ?? [])].slice(0, 4)
		services.push({
			key: g,
			name: brand?.name ?? named.name,
			logo: named.logo_path ?? null,
			slug: brand?.slug ?? null,
			discover: brand ? null : discoverHref(kind, code, [...(members.get(g) ?? [])]),
			model: modelOf(g),
			titles: titles.get(g) ?? 0,
			arrived: arrived.get(g) ?? 0,
			left: left.get(g) ?? 0,
			great: index && b ? (great.get(g) ?? 0) : null,
			popular: index && b ? (popular.get(g) ?? 0) : null,
			picks: keys.length ? (await kit.titlesOf(keys)).map(slim) : [],
		})
	}
	// A tier or channel that carries a bigger service's name ("Amazon Prime Video with Ads", "HBO Max Amazon Channel")
	// folds into it: the same catalog under another label is not another place to browse. Shorter names go first, so the
	// plain brand is always the host, whatever the order of popularity.
	const folded: StreamService[] = []
	for (const s of [...services].sort((x, y) => x.name.length - y.name.length)) {
		const host = folded.find((h) => s.name.toLowerCase().startsWith(`${h.name.toLowerCase()} `))
		if (host) {
			host.arrived = Math.max(host.arrived, s.arrived)
			host.left = Math.max(host.left, s.left)
			host.popular = Math.max(host.popular ?? 0, s.popular ?? 0)
		} else folded.push(s)
	}
	folded.sort((x, y) => (y.popular ?? 0) - (x.popular ?? 0) || y.titles - x.titles)

	const known = countries.find((c) => c.code === code)
	return {
		country: known ?? { code, name: nameOf(code), region: regionOf(code) },
		countries,
		kind,
		services: folded,
		ready: Boolean(index),
	}
}
