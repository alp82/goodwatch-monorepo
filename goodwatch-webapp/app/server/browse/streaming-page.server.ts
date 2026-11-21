// What Browse's two streaming pages show. Read-only.
//
// - The streaming index (`/movies/streaming/us`): every service of the country with the few numbers that tell services
//   apart without a legend (streaming-stats.server), plus every country with offers for the picker.
// - A service's page (`/movies/streaming/us/netflix`): the whole library of the service in the country, what it's
//   strong and thinner on (in moods, which carry their colors), a teaser of what just arrived, its best titles, the
//   ingredients that go well with it, the people and awards behind it, the other services, and the full list.
//
// Order matters on the service page: the place data hands every title out once per page, so the part of the page a
// viewer meets first asks first.
import { type Address, type Ingredient, type Kind, ing, kindSeg } from "~/domain/browse/address"
import { copyFor } from "~/domain/browse/copy"
import type {
	AwardWin,
	Copy,
	Neighbor,
	Person,
	PlaceRef,
	ShowTitle,
	TitleCard,
	TitleList,
	TraitWord,
	Viewer,
} from "~/domain/browse/types"
import type { ServiceSort } from "~/domain/browse/streaming-stats"
import { type FilterState, defaultFilterState, filterQuery } from "~/domain/filter-state"
import { getCountryArrivals } from "~/server/new-on-services.server"
import { SHAPE_BY_CODE } from "~/ui/browse/world-map/geometry"
import type { Places } from "./places.server"
import { base } from "./rows.server"
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

/** A title for decoration inside a card that is one link: the poster and its name only. */
const slim = (t: ShowTitle): ShowTitle => ({
	to: t.to,
	card: {
		key: t.card.key,
		media_type: t.card.media_type,
		tmdb_id: t.card.tmdb_id,
		title: t.card.title,
		poster_path: t.card.poster_path,
		release_year: t.card.release_year,
	} as TitleCard,
})

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
			picks: s.picks.length ? (await places.titlesOf(s.picks)).map(slim) : [],
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
// A service's page

export interface KindLink {
	id: string
	name: string
	titles: ShowTitle[]
}

export interface ServiceGoodAt {
	place: PlaceRef
	/** How a person would say the service with it: "Romantic movies on Netflix". */
	line: string
}

export interface ServicePageData {
	title: string
	service: PlaceRef
	copy: Copy | null
	essentials: ShowTitle[]
	kinds: KindLink[]
	activeKind: string | null
	goesWith: { place: PlaceRef; name: string; titles: ShowTitle[] }[]
	neighbors: Neighbor[]
	people: Person[]
	awards: AwardWin[]
	more: TraitWord[]
	list: TitleList
	goodAt: ServiceGoodAt[]
	thinOn: PlaceRef[]
	others: PlaceRef[]
	newHref: string
	countryName: string
	ready: boolean
	/** "week": this week's arrivals; "newest": none known, so the service's newest well-known titles. */
	fresh: "week" | "newest"
	arrivals: { key: string; title: string; poster_path: string | null; to: string }[]
}

const newHref = (country: string, slug: string) => `/new/${country}/${slug}`

/** This week's arrivals on a service in the country, of the kind: the New page's own read. */
async function arrivalsOn(places: Places, slug: string) {
	try {
		const { brands } = await getCountryArrivals({ country: places.country, now: Date.now() })
		const want = places.kind === "all" ? null : places.kind
		return (brands[slug] ?? [])
			.filter((t) => t.poster_path && (!want || t.media_type === want))
			.slice(0, 10)
			.map((t) => ({ key: String(t.key), title: t.title, poster_path: t.poster_path, to: t.path }))
	} catch {
		return []
	}
}

/** A service's page. `kindId` narrows the list to one of the service's kinds (`?kind=`). */
export async function loadServicePage(
	places: Places,
	address: Address,
	kindId: string | null,
): Promise<ServicePageData> {
	const parts = address.parts
	const lead = places.ref(parts[0])
	const slug = lead.slug
	// A service is known by its best.
	const essentials = await places.showcase(parts, 5, { lines: true, by: "best" })
	const kinds = (await places.kinds(parts, 4)).map((k) => ({
		id: k.id,
		name: k.name,
		titles: k.titles.map(slim),
	}))
	// One more ingredient, never from streaming (it changes by country). A small or very recent catalog fills the row
	// with decades that count as twins of each other, so a second ask without the families already shown tops it up.
	const families = ["mood", "genre", "theme", "style", "decade", "country"] as const
	const blend = await places.blend(parts, { suggestions: 6, titles: 3, families: [...families] })
	const suggestions = [...blend.suggestions]
	if (suggestions.filter((s) => s.place.slug !== "tv-movie").length < 4) {
		const shown = new Set(suggestions.map((s) => s.place.family))
		const wider = await places.blend(parts, {
			suggestions: 6,
			titles: 3,
			families: families.filter((f) => !shown.has(f)),
		})
		for (const s of wider.suggestions)
			if (
				!suggestions.some((x) => x.place.family === s.place.family && x.place.slug === s.place.slug)
			)
				suggestions.push(s)
	}
	const neighbors = (await places.neighbors(parts[0], { n: 5, titles: 0 }))
		.filter((n) => n.place.slug !== "tv-movie")
		.slice(0, 4)
	const [people, awards, list] = await Promise.all([
		places.people(parts, 8),
		places.awards(parts, 6),
		places.list(parts, {
			sort: address.sort,
			page: address.page,
			mine: address.mine,
			unseen: address.unseen,
			kindId: kindId ?? undefined,
		}),
	])
	const { more } = places.traits(parts, { n: 5, less: 2 })
	const profile = places.serviceProfile(slug)
	// What it's strong and thin on, said in moods (each carries its color); genres where no mood stands out.
	const feel = places.serviceProfile(slug, places.country, "mood")
	let arrivals = await arrivalsOn(places, slug)
	let fresh: "week" | "newest" = "week"
	if (arrivals.length < 3) {
		const newest = await places.list([lead], { sort: "newest", size: 10 }).catch(() => null)
		const shown = (newest?.titles ?? []).filter((t) => t.card.poster_path)
		if (shown.length >= 3) {
			fresh = "newest"
			arrivals = shown.map((t) => ({
				key: String(t.card.key),
				title: t.card.title,
				poster_path: t.card.poster_path,
				to: t.to,
			}))
		}
	}
	const strong = feel?.goodAt.length ? feel : profile
	const goodAt = (strong?.goodAt ?? []).slice(0, 3).map((g) => ({
		place: g.place,
		line: places.name([parts[0], ing(g.place.family, g.place.slug)]),
	}))
	return {
		title: places.name(parts),
		service: lead,
		copy: copyFor(kindSeg(places.kind), "services", slug),
		essentials,
		kinds,
		activeKind: kinds.find((k) => k.id === kindId)?.name ?? null,
		goesWith: suggestions.map((s) => ({
			place: s.place,
			name: places.name([...parts, ing(s.place.family, s.place.slug)] as Ingredient[]),
			titles: s.titles.map(slim),
		})),
		neighbors,
		people,
		awards,
		more,
		list,
		goodAt,
		thinOn: (strong?.thinOn ?? []).slice(0, 2).map((t) => t.place),
		others: profile?.others ?? [],
		newHref: newHref(places.country, slug),
		countryName: profile?.countryName ?? "the United States",
		ready: places.streamingReady,
		fresh,
		arrivals,
	}
}

// ---------------------------------------------------------------------------------------------------------
// The route's part

export type StreamingRoute =
	| { page: "streaming"; address: Address; index: StreamingIndexData }
	| {
			page: "service"
			address: Address
			service: ServicePageData
			viewer: Viewer
			kindId: string | null
	  }

/** Whether an address is one of the streaming pages: a country's index, or one service alone. */
export const isStreamingAddress = (a: Address) =>
	(a.view === "family" && a.family === "service") ||
	(a.view === "place" && a.parts.length === 1 && a.parts[0].family === "service")

/**
 * The streaming page of an address, or null when it isn't one. Throws a 404 for a country without plan offers (once
 * the list of countries is known) and for a service without titles there.
 */
export async function streamingRoute(
	places: Places,
	address: Address,
	search: URLSearchParams,
	notFound: () => Response,
): Promise<StreamingRoute | null> {
	if (!isStreamingAddress(address)) return null
	if (address.view === "family") {
		const index = await loadStreamingIndex(places, address)
		if (index.countries.length && !index.countries.some((c) => c.code === index.country.code))
			throw notFound()
		return { page: "streaming", address, index }
	}
	if (places.streamingReady && places.count(address.parts) === 0) throw notFound()
	const kindId = search.get("kind")
	const service = await loadServicePage(places, address, kindId)
	return { page: "service", address, service, viewer: places.viewer, kindId }
}
