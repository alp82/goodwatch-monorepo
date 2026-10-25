// "New on your services" (#489 Part C): the reads behind the pages at /new (new-on-services-page.server.ts).
//
// - A country's arrivals: one read of every brand's stays in availability_history (new-on-services-read.server.ts),
//   each brand's list and the country's list (domain countryArrivalsOf), with display fields, adult titles and
//   titles the catalog lacks left out. Cached in Valkey per country and UTC day for 30 minutes.
// - The links: every page with titles, built from the same country entries, so a linked page or a page the sitemap
//   lists has titles. Cached per UTC day for an hour. A page waits LINKS_BUDGET_MS for them; past that it renders
//   without them and is not stored, while the computation goes on and fills the cache.
// - A member's titles: the same read for their own services, which can include services outside the brands.
// - The meta: when the brands' history last changed (the info icon) and the brands' logos.
// - The viewer: the member's saved country, services and the titles they wait for, or the visitor's country.
// docs/implementation/new-on-services/README.md
import {
	BRANDS,
	type Arrival,
	countryArrivalsOf,
	familyOf,
	rankByScore,
	utcDay,
	waitsOf,
	windowStart,
} from "~/domain/new-on-services"
import { LANDED_DAY, launchTime } from "~/server/availability-first-seen.server"
import { cacheIdentity } from "~/server/cache-identity.server"
import { getCountries } from "~/server/countries.server"
import {
	type ArrivalTitle,
	type CountryArrivals,
	type NewDeps,
	type NewLinks,
	type NewMeta,
	type Viewer,
	linksOf,
} from "~/server/new-on-services-page.server"
import {
	readArrivalStays,
	readArrivals,
} from "~/server/new-on-services-read.server"
import {
	MAX_KEYS,
	getDisplayFields,
	getServiceCards,
} from "~/server/title-cards.server"
import { getUserSettings } from "~/server/user-settings.server"
import { getUserData } from "~/server/userData.server"
import { getMemberViewerContext } from "~/server/viewer.server"
import { getUserIdFromRequest } from "~/utils/auth"
import { cached } from "~/utils/cache"
import { execute, query } from "~/utils/crate"
import { titlePath } from "~/utils/helpers"
import { brandName, getShorterProviderLabel } from "~/utils/streaming-links"
import { parseTitleKey, titleKey } from "~/utils/title-key"

const COUNTRY_TTL_MINUTES = 30
const MEMBER_TTL_MINUTES = 30
const LINKS_TTL_MINUTES = 60
const META_TTL_MINUTES = 60
/** How long a page waits for the links before it renders without them. */
const LINKS_BUDGET_MS = 300
/** Countries read at once while the links are built. */
const LINKS_CONCURRENCY = 4
const BRAND_FAMILIES = BRANDS.map((brand) => brand.ids[0])
const BRAND_IDS = BRANDS.flatMap((brand) => brand.ids)

// ---------------------------------------------------------------------------------------------------------
// Titles: display fields, with adult titles and titles the catalog lacks left out

async function adultKeys(keys: readonly number[]): Promise<Set<number>> {
	const movies: number[] = []
	const shows: number[] = []
	for (const key of keys) {
		const { mediaType, tmdbId } = parseTitleKey(key)
		;(mediaType === "movie" ? movies : shows).push(tmdbId)
	}
	const rows = await query<{ media_type: "movie" | "show"; tmdb_id: number }>(
		`SELECT 'movie' AS media_type, tmdb_id FROM movie WHERE tmdb_id = ANY(?) AND adult = true
		 UNION ALL
		 SELECT 'show' AS media_type, tmdb_id FROM show WHERE tmdb_id = ANY(?) AND adult = true`,
		// node-crate sends arrays as JSON arrays; its parameter type only names scalars.
		[movies as never, shows as never],
	)
	return new Set(
		rows.map(({ media_type, tmdb_id }) => titleKey(media_type, tmdb_id)),
	)
}

/** Each list of arrivals as titles, best first, from one read of display fields and adult flags for them all. */
async function titlesFor(lists: readonly Arrival[][]): Promise<ArrivalTitle[][]> {
	const keys = [...new Set(lists.flat().map(({ key }) => key))]
	if (!keys.length) return lists.map(() => [])
	const chunks: number[][] = []
	for (let i = 0; i < keys.length; i += MAX_KEYS)
		chunks.push(keys.slice(i, i + MAX_KEYS))
	const [displays, adult] = await Promise.all([
		Promise.all(chunks.map((chunk) => getDisplayFields(chunk))),
		adultKeys(keys),
	])
	const byKey = new Map(displays.flatMap((map) => [...map]))
	return lists.map((arrivals) =>
		rankByScore(
			arrivals.flatMap((arrival): ArrivalTitle[] => {
				const display = byKey.get(arrival.key)
				if (!display || adult.has(arrival.key)) return []
				return [
					{
						key: arrival.key,
						tmdb_id: display.tmdb_id,
						media_type: display.media_type,
						title: display.title,
						release_year: display.release_year,
						runtime: display.runtime,
						poster_path: display.poster_path,
						backdrop_path: display.backdrop_path,
						// The catalog keeps the score as a fraction; it is shown, and ranked, as a whole number.
						score:
							display.goodwatch_overall_score_normalized_percent === null
								? null
								: Math.round(display.goodwatch_overall_score_normalized_percent),
						path: titlePath(display.media_type, display.tmdb_id, display.title),
						service: arrival.service,
						at: arrival.at,
						exact: arrival.exact,
					},
				]
			}),
		),
	)
}

// The day is part of each cache key, so the window moves at midnight (UTC); within the day, now is when the read runs.
const nowIn = (day: number) => Math.max(day, Date.now())

// ---------------------------------------------------------------------------------------------------------
// A country's arrivals

type CountryParams = { country: string; day: number }

async function readCountry({
	country,
	day,
}: CountryParams): Promise<CountryArrivals> {
	const now = nowIn(day)
	const since = windowStart(now, launchTime())
	const stays = await readArrivalStays(
		{ country, services: BRAND_FAMILIES, since },
		execute,
	)
	const { brands, all } = countryArrivalsOf(stays, { since, until: now })
	const slugs = Object.keys(brands)
	const titles = await titlesFor([...slugs.map((slug) => brands[slug]), all])
	const result: CountryArrivals = { brands: {}, all: titles[slugs.length] }
	slugs.forEach((slug, i) => {
		if (titles[i].length) result.brands[slug] = titles[i]
	})
	return result
}

export function getCountryArrivals({
	country,
	now,
}: {
	country: string
	now: number
}): Promise<CountryArrivals> {
	return cached<CountryParams, CountryArrivals>({
		name: "new-on-services-country-v1",
		target: readCountry,
		params: { country, day: utcDay(now) },
		ttlMinutes: COUNTRY_TTL_MINUTES,
	})
}

// ---------------------------------------------------------------------------------------------------------
// A member's titles

type MemberParams = { country: string; families: number[]; day: number }

async function readMember({
	country,
	families,
	day,
}: MemberParams): Promise<ArrivalTitle[]> {
	const arrivals = await readArrivals(
		{ country, services: families, now: nowIn(day), launch: launchTime() },
		execute,
	)
	const [titles] = await titlesFor([arrivals])
	return titles
}

/** The titles that arrived on a member's services in their country, best first. Shared by members with the same. */
export function getMemberTitles({
	country,
	services,
	now,
}: {
	country: string
	services: readonly number[]
	now: number
}): Promise<ArrivalTitle[]> {
	const families = [...new Set(services.map(familyOf))].sort((a, b) => a - b)
	return cached<MemberParams, ArrivalTitle[]>({
		name: "new-on-services-member-v1",
		target: readMember,
		params: { country, families, day: utcDay(now) },
		ttlMinutes: MEMBER_TTL_MINUTES,
	})
}

// ---------------------------------------------------------------------------------------------------------
// The links: every page with titles, from the country entries

async function readLinks({ day }: { day: number }): Promise<NewLinks> {
	const now = nowIn(day)
	const since = windowStart(now, launchTime())
	const [countries, candidates] = await Promise.all([
		getCountries({}),
		// The countries with any candidate at all; the others have no page with titles.
		query<{ country_code: string }>(
			`SELECT DISTINCT country_code FROM availability_history
			 WHERE streaming_type IN ('flatrate', 'free', 'ads') AND streaming_service_id IN (${BRAND_IDS.join(", ")})
			   AND dropped_on IS NULL AND appeared_source <> 'backfill' AND (${LANDED_DAY}) >= ?
			 LIMIT 1000`,
			[since],
		),
	])
	const known = new Set(countries.map(({ code }) => code))
	const queue = candidates
		.map(({ country_code }) => country_code)
		.filter((code) => known.has(code))
		.sort()
	const results = new Map<string, CountryArrivals>()
	await Promise.all(
		Array.from({ length: LINKS_CONCURRENCY }, async () => {
			for (let code = queue.shift(); code; code = queue.shift())
				results.set(code, await getCountryArrivals({ country: code, now }))
		}),
	)
	return linksOf(
		[...results.keys()]
			.sort()
			.map((country) => ({
				country,
				arrivals: results.get(country) as CountryArrivals,
			})),
	)
}

export function getLinks(now: number): Promise<NewLinks> {
	return cached<{ day: number }, NewLinks>({
		name: "new-on-services-links-v1",
		target: readLinks,
		params: { day: utcDay(now) },
		ttlMinutes: LINKS_TTL_MINUTES,
	})
}

/** The links, or null when they aren't ready within a page's budget. The computation goes on either way. */
async function linksWithin(now: number, wait: boolean): Promise<NewLinks | null> {
	const links = getLinks(now)
	if (wait) return links
	links.catch((error) =>
		console.error("New on your services: building the links failed", error),
	)
	let timer: NodeJS.Timeout | undefined
	const late = new Promise<null>((resolve) => {
		timer = setTimeout(() => resolve(null), LINKS_BUDGET_MS)
	})
	try {
		return await Promise.race([links.catch(() => null), late])
	} finally {
		clearTimeout(timer)
	}
}

// ---------------------------------------------------------------------------------------------------------
// The meta

async function readMeta(): Promise<NewMeta> {
	const [updated, logos] = await Promise.all([
		query<{ updated: number | null }>(
			`SELECT max(updated_at) AS updated FROM availability_history WHERE streaming_service_id IN (${BRAND_IDS.join(", ")})`,
		),
		query<{ tmdb_id: number; logo_path: string | null }>(
			`SELECT tmdb_id, logo_path FROM streaming_service WHERE tmdb_id IN (${BRANDS.map((b) => b.logo).join(", ")}) LIMIT 1000`,
		),
	])
	const logoOf = new Map(logos.map((row) => [row.tmdb_id, row.logo_path]))
	return {
		updatedAt: updated[0]?.updated ?? null,
		logos: Object.fromEntries(
			BRANDS.map((brand) => [brand.slug, logoOf.get(brand.logo) ?? null]),
		),
	}
}

function getMeta(now: number): Promise<NewMeta> {
	return cached<{ day: number }, NewMeta>({
		name: "new-on-services-meta-v1",
		target: readMeta,
		params: { day: utcDay(now) },
		ttlMinutes: META_TTL_MINUTES,
	})
}

// ---------------------------------------------------------------------------------------------------------
// The viewer

async function readViewer(request: Request): Promise<Viewer> {
	const identity = cacheIdentity(request)
	// No auth cookie: a visitor, with the country of the cache identity (the same country the page cache keys on).
	if (identity.audience === "anon")
		return { country: identity.country, member: null }
	const userId = await getUserIdFromRequest({ request })
	if (!userId) return { country: identity.country, member: null }
	const [ctx, settings, userData] = await Promise.all([
		getMemberViewerContext(userId, identity.country),
		getUserSettings({ userId }),
		getUserData({ user_id: userId }),
	])
	const saved = settings.country_default?.trim().toUpperCase() ?? ""
	return {
		country: ctx.country,
		member: {
			services: ctx.services,
			savedCountry: /^[A-Z]{2}$/.test(saved) ? saved : null,
			waits: waitsOf(ctx.wishlist, userData.watchState),
		},
	}
}

/** A service's short name, as the title page and the Newly available row say it: "Prime", "Disney+". */
const shortName = (name: string) => brandName(getShorterProviderLabel(name))

export const newDeps: NewDeps = {
	now: () => Date.now(),
	launch: launchTime,
	countries: async () =>
		(await getCountries({})).map(({ code, name }) => ({ code, name })),
	meta: getMeta,
	country: getCountryArrivals,
	memberTitles: getMemberTitles,
	links: linksWithin,
	viewer: readViewer,
	serviceCards: async (ids) =>
		(await getServiceCards(ids)).map((card) => ({
			...card,
			name: shortName(card.name),
		})),
}
