// The start page's Where to start section (ui/start/browse/): its rails, from the site's own cached reads.
//
// - Top 10: the best-of lists (best-lists.server.ts), the same for every country.
// - New on streaming: the country's arrivals on the big services (new-on-services.server.ts, the read /new uses).
// - Moods and genres: the mood and genre pages' own filters through Discover's cached read (discover.server.ts),
//   the most popular first. They don't depend on the country.
// - Services: the big services in the country's order (streaming-providers.server.ts), each with its most popular
//   titles there. A service is in the rail only when it has a page to link to.
//
// The section is part of the guest's HTML, which the page cache keeps per country, so it is the same for every guest
// of a country. Its parts are kept in this process for 30 minutes (the country's part per country). After that the
// kept part still serves while it is read again, so no request waits for a read once a part was read. A part read with
// a failed source is kept for a minute only and marks the page incomplete. The first request of a part waits at most
// BROWSE_BUDGET_MS; the page renders without the rails meanwhile, and as incomplete.
import { type Brand, BRANDS, servicePath } from "~/domain/new-on-services"
import { getRankedList, type ListTitle } from "~/server/best-lists.server"
import {
	type DiscoverParams,
	type DiscoverResult,
	getDiscoverResults,
	type StreamingPreset,
	type WatchedType,
} from "~/server/discover.server"
import type {
	ArrivalTitle,
	CountryArrivals,
} from "~/server/new-on-services-page.server"
import { getCountryArrivals } from "~/server/new-on-services.server"
import { getStreamingProviders } from "~/server/streaming-providers.server"
import { exploreAddressExists } from "~/ui/explore/address"
import { genres as genrePages } from "~/ui/explore/category/genres"
import { moods as moodPages } from "~/ui/explore/category/moods"
import type { PageData } from "~/ui/explore/config"
import type { StartTitle } from "~/ui/living-room/living-room-data"
import {
	BROWSE_GENRES,
	BROWSE_LIMITS,
	BROWSE_MOODS,
	DISCOVER_BROWSE_MOODS,
	type BrowseGenre,
	type BrowseKind,
	type BrowseMood,
	type BrowsePoster,
	type BrowseService,
	type StartBrowseData,
} from "~/ui/start/browse/browse-data"

export const BROWSE_TTL_MS = 30 * 60_000
/** How long a part read with a failed source is kept. */
export const BROWSE_RETRY_MS = 60_000
/** How long the first request of a part waits for it. */
export const BROWSE_BUDGET_MS = 1500

/** Posters drawn as decoration are titles people know: at least this many votes, while there are enough. */
const KNOWN_VOTES = 20_000

type Provider = {
	id: number
	logo_path: string | null
	order_by_country?: Record<string, number>
}

/** The reads the section is made of; tests pass their own. */
export type BrowseReaders = {
	ranked: (kind: BrowseKind) => Promise<readonly ListTitle[]>
	arrivals: (country: string) => Promise<CountryArrivals>
	providers: (country: string) => Promise<readonly Provider[]>
	discover: (params: DiscoverParams) => Promise<readonly DiscoverResult[]>
}

export const browseReaders: BrowseReaders = {
	ranked: async (kind) => (await getRankedList(kind)).titles,
	arrivals: (country) => getCountryArrivals({ country, now: Date.now() }),
	providers: (country) => getStreamingProviders({ country }),
	discover: getDiscoverResults,
}

/** A part of the section, and whether every source of it answered. */
type Part<T> = { value: T; complete: boolean }

// ---------------------------------------------------------------------------------------------------------
// Titles

/** Whole points: what the card shows, in fewer bytes of the HTML's loader data. */
const wholeScore = (score: number | null | undefined) =>
	score == null ? null : Math.floor(score)

const fromRanked = (title: ListTitle): StartTitle => ({
	media_type: title.media_type,
	tmdb_id: title.tmdb_id,
	title: title.title,
	release_year: title.release_year,
	poster_path: title.poster_path,
	goodwatch_overall_score_normalized_percent: wholeScore(
		title.goodwatch_overall_score_normalized_percent,
	),
})

const fromArrival = (title: ArrivalTitle): StartTitle => ({
	media_type: title.media_type,
	tmdb_id: title.tmdb_id,
	title: title.title,
	release_year: title.release_year,
	poster_path: title.poster_path,
	goodwatch_overall_score_normalized_percent: wholeScore(title.score),
})

/**
 * Up to `count` posters of the results, known titles first (in the results' order), none twice in a rail: `used`
 * holds the rail's titles so far.
 */
export function pickPosters(
	results: readonly DiscoverResult[],
	count: number,
	used: Set<string>,
): BrowsePoster[] {
	const fresh = results.filter(
		(result) =>
			result.poster_path && !used.has(`${result.media_type}-${result.tmdb_id}`),
	)
	const known = fresh.filter(
		(result) =>
			(result.goodwatch_overall_score_voting_count ?? 0) >= KNOWN_VOTES,
	)
	const picked = [
		...known,
		...fresh.filter((result) => !known.includes(result)),
	].slice(0, count)
	for (const result of picked)
		used.add(`${result.media_type}-${result.tmdb_id}`)
	return picked.map((result) => ({
		title: result.title,
		poster_path: result.poster_path,
	}))
}

// ---------------------------------------------------------------------------------------------------------
// Discover's read with a page's filters

/** Discover's read of the most popular titles of one type, with a page's filters on top. */
export function browseParams(
	type: "movie" | "show" | "all",
	country: string,
	filters: Partial<DiscoverParams>,
): DiscoverParams {
	return {
		type,
		country,
		language: "en",
		watchedType: "" as WatchedType,
		minAgeRating: "",
		maxAgeRating: "",
		minYear: "",
		maxYear: "",
		minScore: "60",
		maxScore: "",
		withCast: "",
		withCastCombinationType: "all",
		withoutCast: "",
		withCrew: "",
		withCrewCombinationType: "all",
		withoutCrew: "",
		withGenres: "",
		withoutGenres: "",
		withKeywords: "",
		withoutKeywords: "",
		streamingPreset: "everywhere" as StreamingPreset,
		withStreamingProviders: "",
		withStreamingTypes: "free,flatrate",
		similarTitles: "",
		fingerprintPillars: "",
		fingerprintPillarMinTier: "",
		fingerprintConditions: "",
		suitabilityFilters: "",
		contextFilters: "",
		sortBy: "popularity",
		sortDirection: "desc",
		page: 1,
		...filters,
	}
}

/** Each item's read, in order; a failed read gives null and marks the part incomplete. */
async function settle<T>(reads: Promise<T>[]): Promise<Part<(T | null)[]>> {
	const results = await Promise.allSettled(reads)
	for (const result of results)
		if (result.status === "rejected")
			console.error("Start page: a browse read failed", result.reason)
	return {
		value: results.map((result) =>
			result.status === "fulfilled" ? result.value : null,
		),
		complete: results.every((result) => result.status === "fulfilled"),
	}
}

// ---------------------------------------------------------------------------------------------------------
// The parts

type SharedPart = Pick<StartBrowseData, "top" | "moods" | "genres">
type CountryPart = Pick<StartBrowseData, "arrivals" | "services">

// The legacy browse reader takes fingerprint conditions, rather than mood keys.
// Keep these at the fixed domain/moods.ts thresholds; the rail links to those real Discover filters.
const BROWSE_MOOD_FIELDS: Record<string, string> = {
	dark: "bleakness",
	deep: "philosophical",
	magical: "wonder",
	quirky: "eccentricity",
}

/** The rails that are the same in every country: Top 10, moods, and genres. */
export async function readSharedBrowse(
	readers: BrowseReaders,
): Promise<Part<SharedPart>> {
	const moods = BROWSE_MOODS.map(({ path }) => ({
		path,
		discoverParams: DISCOVER_BROWSE_MOODS.some((key) => key === path)
			? {
					fingerprintConditions: JSON.stringify([
						{
							logic: "AND",
							conditions:
								path === "tense"
									? [
											{ field: "tension", operator: ">=", value: 8 },
											{ field: "adrenaline", operator: "<=", value: 6 },
											{ field: "scare", operator: "<=", value: 6 },
										]
									: [
											{
												field: BROWSE_MOOD_FIELDS[path],
												operator: ">=",
												value: 8,
											},
										],
						},
					]),
				}
			: (moodPages[path] as PageData).discoverParams,
	}))
	const genres = (["movie", "show"] as const).flatMap((kind) =>
		BROWSE_GENRES[kind].map((path) => ({
			kind,
			page: genrePages[path] as PageData,
		})),
	)
	const [top, moodResults, genreResults] = await Promise.all([
		settle([readers.ranked("movie"), readers.ranked("show")]),
		// The country only filters by service; these reads have none, so one country's read serves all.
		settle(
			moods.map((page) =>
				readers.discover(browseParams("movie", "US", page.discoverParams)),
			),
		),
		settle(
			genres.map(({ kind, page }) =>
				readers.discover(browseParams(kind, "US", page.discoverParams)),
			),
		),
	])

	const usedByMoods = new Set<string>()
	const moodRail: BrowseMood[] = moods.flatMap((page, i) => {
		const posters = pickPosters(
			moodResults.value[i] ?? [],
			BROWSE_LIMITS.moodPosters,
			usedByMoods,
		)
		return posters.length === BROWSE_LIMITS.moodPosters
			? [
					{
						path: page.path,
						posters: posters.map((poster) => poster.poster_path),
					},
				]
			: []
	})

	const genreCloud: Record<BrowseKind, BrowseGenre[]> = { movie: [], show: [] }
	const usedByGenres = { movie: new Set<string>(), show: new Set<string>() }
	genres.forEach(({ kind, page }, i) => {
		const titles = pickPosters(
			genreResults.value[i] ?? [],
			BROWSE_LIMITS.genreTitles,
			usedByGenres[kind],
		)
		if (titles.length === BROWSE_LIMITS.genreTitles)
			genreCloud[kind].push({ name: page.label, path: page.path, titles })
	})

	const [movies, shows] = top.value
	return {
		value: {
			top: {
				movie: (movies ?? []).slice(0, BROWSE_LIMITS.top).map(fromRanked),
				show: (shows ?? []).slice(0, BROWSE_LIMITS.top).map(fromRanked),
			},
			moods: moodRail,
			genres: genreCloud,
		},
		complete: top.complete && moodResults.complete && genreResults.complete,
	}
}

/** A service's page: its streaming hub page, else its New on page in the country while it has arrivals there. */
export function serviceHref(
	brand: Brand,
	country: string,
	arrivals: CountryArrivals,
): string | null {
	if (
		exploreAddressExists({
			type: "shows",
			category: "streaming",
			page: brand.slug,
		})
	)
		return `/shows/streaming/${brand.slug}`
	return arrivals.brands[brand.slug]?.length
		? servicePath(country, brand)
		: null
}

/** The rails of one country: what arrived on the big services, and the services themselves. */
export async function readCountryBrowse(
	country: string,
	readers: BrowseReaders,
): Promise<Part<CountryPart>> {
	const [arrivalsRead, providersRead] = await Promise.all([
		settle([readers.arrivals(country)]),
		settle([readers.providers(country)]),
	])
	const arrivals = arrivalsRead.value[0] ?? { brands: {}, all: [] }
	const providers = providersRead.value[0] ?? []

	// The big services, in the order the country's viewers see services; one the country hasn't is left out.
	const rank = new Map(providers.map((provider, i) => [provider.id, i]))
	const logo = new Map(
		providers.map((provider) => [provider.id, provider.logo_path]),
	)
	const brands = BRANDS.filter((brand) => rank.has(brand.logo))
		.sort((a, b) => (rank.get(a.logo) ?? 0) - (rank.get(b.logo) ?? 0))
		.flatMap((brand) => {
			const href = serviceHref(brand, country, arrivals)
			return href ? [{ brand, href }] : []
		})
		.slice(0, BROWSE_LIMITS.services)
	const titles = await settle(
		brands.map(({ brand }) =>
			readers.discover(
				browseParams("all", country, {
					streamingPreset: "custom" as StreamingPreset,
					withStreamingProviders: brand.ids.join(","),
				}),
			),
		),
	)
	const used = new Set<string>()
	const services: BrowseService[] = brands.flatMap(({ brand, href }, i) => {
		const posters = pickPosters(
			titles.value[i] ?? [],
			BROWSE_LIMITS.servicePosters,
			used,
		)
		return posters.length >= 3
			? [
					{
						name: brand.name,
						href,
						logo: logo.get(brand.logo) ?? null,
						posters: posters.map((poster) => poster.poster_path),
					},
				]
			: []
	})

	return {
		value: {
			arrivals: arrivals.all
				.filter((title) => title.poster_path)
				.slice(0, BROWSE_LIMITS.arrivals)
				.map(fromArrival),
			services,
		},
		complete:
			arrivalsRead.complete && providersRead.complete && titles.complete,
	}
}

// ---------------------------------------------------------------------------------------------------------
// Kept in this process

type Kept<T> = {
	value: Part<T> | null
	at: number
	reading: Promise<Part<T>> | null
}

/**
 * A part kept by key: fresh for `ttl` (`retry` when incomplete), then still served while it is read again. A read
 * that fails keeps what was there.
 */
export function keptParts<T>(
	read: (key: string) => Promise<Part<T>>,
	{ ttl = BROWSE_TTL_MS, retry = BROWSE_RETRY_MS, now = Date.now } = {},
) {
	const kept = new Map<string, Kept<T>>()
	const refresh = (key: string, entry: Kept<T>) => {
		if (entry.reading) return entry.reading
		const reading = read(key)
		entry.reading = reading
		reading
			.then((value) => {
				entry.value = value
				entry.at = now()
			})
			.catch((error) =>
				console.error("Start page: reading the browse section failed", error),
			)
			.finally(() => {
				entry.reading = null
			})
		return reading
	}
	/** The part: at once when kept, else the read (null when it fails). */
	return async (key: string): Promise<Part<T> | null> => {
		let entry = kept.get(key)
		if (!entry) {
			entry = { value: null, at: 0, reading: null }
			kept.set(key, entry)
		}
		const age = now() - entry.at
		if (entry.value) {
			if (age > (entry.value.complete ? ttl : retry))
				void refresh(key, entry).catch(() => {})
			return entry.value
		}
		return refresh(key, entry).catch(() => null)
	}
}

const sharedPart = keptParts(() => readSharedBrowse(browseReaders))
const countryPart = keptParts((country) =>
	readCountryBrowse(country, browseReaders),
)

/** Resolves to null after `ms`, so a slow read doesn't hold the page. */
function within<T>(work: Promise<T>, ms: number): Promise<T | null> {
	let timer: NodeJS.Timeout | undefined
	const late = new Promise<null>((resolve) => {
		timer = setTimeout(() => resolve(null), ms)
	})
	return Promise.race([work, late]).finally(() => clearTimeout(timer))
}

/** Joins the two parts; a missing part leaves its rails empty and the section incomplete. */
export function joinBrowse(
	shared: Part<SharedPart> | null,
	country: Part<CountryPart> | null,
): Part<StartBrowseData> {
	return {
		value: {
			top: shared?.value.top ?? { movie: [], show: [] },
			moods: shared?.value.moods ?? [],
			genres: shared?.value.genres ?? { movie: [], show: [] },
			arrivals: country?.value.arrivals ?? [],
			services: country?.value.services ?? [],
		},
		complete: Boolean(shared?.complete && country?.complete),
	}
}

/** The section for a guest of the country. Never fails; `complete` is false when a rail is missing. */
export async function loadStartBrowse(
	country: string,
	budgetMs = BROWSE_BUDGET_MS,
): Promise<Part<StartBrowseData>> {
	const [shared, local] = await Promise.all([
		within(sharedPart("all"), budgetMs),
		within(countryPart(country), budgetMs),
	])
	return joinBrowse(shared, local)
}
