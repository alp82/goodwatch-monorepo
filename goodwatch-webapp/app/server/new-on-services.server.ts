// "New on your services" (#489 Part C): the reads behind the pages at /new (new-on-services-page.server.ts).
//
// - A page's titles: the arrivals of availability_history (new-on-services-read.server.ts) with their display fields,
//   adult titles left out, best first. Cached in Valkey per country, services and UTC day for 30 minutes, the
//   data cache of the other catalog pages; the page cache keeps the documents in front of it.
// - The summary: which country has titles on which brand (it decides the links between the pages), when the
//   history last changed (the info icon), the brands' logos and the countries' names. One statement over every
//   country, cached per UTC day for an hour.
// - The viewer: the member's saved country, services and the titles they wait for, or the visitor's country.
// docs/implementation/new-on-services/README.md
import {
	BRANDS,
	type Arrival,
	familyOf,
	rankByScore,
	utcDay,
	waitsOf,
	windowStart,
} from "~/domain/new-on-services"
import { launchTime, LANDED_DAY } from "~/server/availability-first-seen.server"
import { cacheIdentity } from "~/server/cache-identity.server"
import { getCountries } from "~/server/countries.server"
import { readArrivals } from "~/server/new-on-services-read.server"
import type {
	ArrivalTitle,
	NewDeps,
	NewSummary,
	Viewer,
} from "~/server/new-on-services-page.server"
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

const TITLES_TTL_MINUTES = 30
const SUMMARY_TTL_MINUTES = 60
const BRAND_IDS = BRANDS.flatMap((brand) => brand.ids)

// ---------------------------------------------------------------------------------------------------------
// A page's titles

async function adultKeys(arrivals: Arrival[]): Promise<Set<number>> {
	const movies: number[] = []
	const shows: number[] = []
	for (const { key } of arrivals) {
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

/** Display fields for the arrivals, best first. A title the catalog lacks, or an adult one, is left out. */
async function titlesOf(arrivals: Arrival[]): Promise<ArrivalTitle[]> {
	if (!arrivals.length) return []
	const keys = arrivals.map(({ key }) => key)
	const chunks: number[][] = []
	for (let i = 0; i < keys.length; i += MAX_KEYS)
		chunks.push(keys.slice(i, i + MAX_KEYS))
	const [displays, adult] = await Promise.all([
		Promise.all(chunks.map((chunk) => getDisplayFields(chunk))),
		adultKeys(arrivals),
	])
	const byKey = new Map(displays.flatMap((map) => [...map]))
	return rankByScore(
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
	)
}

type TitlesParams = { country: string; families: number[]; day: number }

async function readTitles({
	country,
	families,
	day,
}: TitlesParams): Promise<ArrivalTitle[]> {
	// The day is part of the key, so the window moves at midnight (UTC); within the day, now is when the read runs.
	const now = Math.max(day, Date.now())
	const arrivals = await readArrivals(
		{ country, services: families, now, launch: launchTime() },
		execute,
	)
	return titlesOf(arrivals)
}

/** The titles that arrived on the services in the country within the window, best first. */
export function getArrivalTitles({
	country,
	services,
	now,
}: {
	country: string
	services: readonly number[]
	now: number
}): Promise<ArrivalTitle[]> {
	const families = [...new Set(services.map(familyOf))].sort((a, b) => a - b)
	return cached<TitlesParams, ArrivalTitle[]>({
		name: "new-on-services-titles-v1",
		target: readTitles,
		params: { country, families, day: utcDay(now) },
		ttlMinutes: TITLES_TTL_MINUTES,
	})
}

// ---------------------------------------------------------------------------------------------------------
// The summary

const BRAND_OF_ID = `CASE ${BRANDS.map(
	(brand) =>
		`WHEN streaming_service_id IN (${brand.ids.join(", ")}) THEN '${brand.slug}'`,
).join(" ")} END`

async function readSummary({ day }: { day: number }): Promise<NewSummary> {
	const since = windowStart(Math.max(day, Date.now()), launchTime())
	const [countries, counts, updated, logos] = await Promise.all([
		getCountries({}),
		// An upper bound of each page's titles: the continuity rules can leave some out (a brand's other tier).
		query<{ country_code: string; brand: string; titles: number }>(
			`SELECT country_code, brand, count(*) AS titles
			 FROM (
			   SELECT country_code, ${BRAND_OF_ID} AS brand, media_type, media_tmdb_id
			   FROM availability_history
			   WHERE streaming_type IN ('flatrate', 'free', 'ads') AND streaming_service_id IN (${BRAND_IDS.join(", ")})
			     AND dropped_on IS NULL AND appeared_source <> 'backfill' AND (${LANDED_DAY}) >= ?
			   GROUP BY 1, 2, 3, 4
			 ) arrivals
			 GROUP BY 1, 2
			 LIMIT 100000`,
			[since],
		),
		query<{ updated: number | null }>(
			`SELECT max(updated_at) AS updated FROM availability_history WHERE streaming_service_id IN (${BRAND_IDS.join(", ")})`,
		),
		query<{ tmdb_id: number; logo_path: string | null }>(
			`SELECT tmdb_id, logo_path FROM streaming_service WHERE tmdb_id IN (${BRANDS.map((b) => b.logo).join(", ")}) LIMIT 1000`,
		),
	])
	const byCountry: NewSummary["counts"] = {}
	for (const { country_code, brand, titles } of counts) {
		byCountry[country_code] ??= {}
		byCountry[country_code][brand] = titles
	}
	const logoOf = new Map(logos.map((row) => [row.tmdb_id, row.logo_path]))
	return {
		countries: countries.map(({ code, name }) => ({ code, name })),
		counts: byCountry,
		updatedAt: updated[0]?.updated ?? null,
		logos: Object.fromEntries(
			BRANDS.map((brand) => [brand.slug, logoOf.get(brand.logo) ?? null]),
		),
	}
}

export function getNewSummary(now: number): Promise<NewSummary> {
	return cached<{ day: number }, NewSummary>({
		name: "new-on-services-summary-v1",
		target: readSummary,
		params: { day: utcDay(now) },
		ttlMinutes: SUMMARY_TTL_MINUTES,
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
	summary: getNewSummary,
	titles: getArrivalTitles,
	viewer: readViewer,
	serviceCards: async (ids) =>
		(await getServiceCards(ids)).map((card) => ({
			...card,
			name: shortName(card.name),
		})),
}
