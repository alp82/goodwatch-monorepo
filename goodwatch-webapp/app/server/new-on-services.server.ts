// "New on your services" (#489 Part C): the reads behind the pages at /new (new-on-services-page.server.ts).
//
// - A country's arrivals: one read of every brand's stays in availability_history (new-on-services-read.server.ts),
//   each brand's list and the country's list (domain countryArrivalsOf), with display fields. Adult titles, titles
//   the catalog lacks and titles without a name are left out. Cached in Valkey per country and UTC day for 30 minutes.
// - The links: every page with titles, built from the same country entries, so a linked page or a page the sitemap
//   lists has titles. A country whose read fails is left out instead of failing them all. Cached per UTC day for an
//   hour. A page waits LINKS_BUDGET_MS for them; past that it renders without them and is not stored, while the
//   computation goes on and fills the cache.
// - A member's titles: the same read for their own services, which can include services outside the brands.
// - The meta: when the brands' history last changed (the info icon) and the brands' logos.
// - The viewer: the member's saved country, services and the titles they wait for, or the visitor's country.
// docs/implementation/new-on-services/README.md
import {
	BRANDS,
	type Arrival,
	countryArrivalsOf,
	familyOf,
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
	type NewPagesHere,
	type NewWeekRow,
	type Viewer,
	WEEK_ROW_LIMIT,
	arrivalTitlesOf,
	linksAcross,
	newPagesHere,
	weekTitlesOf,
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
// Titles: display fields, with adult titles, titles the catalog lacks and titles without a name left out

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
	return arrivalTitlesOf(
		lists,
		new Map(displays.flatMap((map) => [...map])),
		adult,
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

/** How long the start page waits for a member's row before it renders without it. */
const WEEK_ROW_BUDGET_MS = 250

/**
 * The start page's row (#489, Q67): this week's arrivals on the member's services, from the read /new uses and its
 * cache. Null without saved services, without arrivals this week, or when the read isn't ready within the start
 * page's budget; the read goes on then and fills the cache for the next visit. Never fails.
 */
export async function getMemberWeekRow({
	country,
	services,
	now = Date.now(),
}: {
	country: string
	services: readonly number[]
	now?: number
}): Promise<NewWeekRow | null> {
	if (!services.length) return null
	const read = getMemberTitles({ country, services, now }).then(async (titles) => {
		const week = weekTitlesOf(titles, now)
		if (!week.length) return null
		const shown = week.slice(0, WEEK_ROW_LIMIT)
		const cards = await newDeps.serviceCards([...new Set(shown.map(({ service }) => service))])
		return {
			titles: shown.map(({ backdrop_path, ...title }) => title),
			total: week.length,
			services: Object.fromEntries(
				cards.map(({ id, name, logo_path }) => [id, { name, logo_path }]),
			),
		}
	})
	read.catch((error) =>
		console.error("New on your services: the start page's row failed", error),
	)
	let timer: NodeJS.Timeout | undefined
	const late = new Promise<null>((resolve) => {
		timer = setTimeout(() => resolve(null), WEEK_ROW_BUDGET_MS)
	})
	try {
		return await Promise.race([read.catch(() => null), late])
	} finally {
		clearTimeout(timer)
	}
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
	return linksAcross(
		candidates
			.map(({ country_code }) => country_code)
			.filter((code) => known.has(code)),
		(country) => getCountryArrivals({ country, now }),
		LINKS_CONCURRENCY,
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

// The links in this process for a few minutes, so a title page doesn't read and parse them from Valkey each time.
const LINKS_MEMO_MS = 10 * 60_000
let linksMemo: { day: number; at: number; links: Promise<NewLinks> } | null = null

function memoLinks(now: number): Promise<NewLinks> {
	const day = utcDay(now)
	if (!linksMemo || linksMemo.day !== day || now - linksMemo.at > LINKS_MEMO_MS) {
		const links = getLinks(now)
		linksMemo = { day, at: now, links }
		links.catch(() => {
			if (linksMemo?.links === links) linksMemo = null
		})
	}
	return linksMemo.links
}

/**
 * The brands with a page of their own in the country, for the title page's "More new on Netflix" (#489, Q67), or
 * "late" when the links aren't ready within the page's budget (after midnight UTC, while they are built). Never fails:
 * without the links there is no page to name.
 */
export async function newPagesWithin(
	country: string,
	budgetMs: number,
): Promise<NewPagesHere | "late"> {
	const links = memoLinks(Date.now())
	let timer: NodeJS.Timeout | undefined
	const late = new Promise<"late">((resolve) => {
		timer = setTimeout(() => resolve("late"), budgetMs)
	})
	try {
		return await Promise.race([
			links.then(
				(all) => newPagesHere(all, country),
				(): NewPagesHere => ({ country, brands: [] }),
			),
			late,
		])
	} finally {
		clearTimeout(timer)
	}
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
