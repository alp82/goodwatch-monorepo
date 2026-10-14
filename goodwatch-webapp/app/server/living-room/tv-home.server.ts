// What the start page with the new TV shows a guest and a member, shaped from what the loader read
// (tv-loader.server.ts). Pure: no request, and no read but the one it is handed (`keepCountryServices`).
import { episodeCode, tonightsPickOf } from "~/domain/my-shows"
import type { TonightParts } from "~/server/home-doors.server"
import type { TitleCard } from "~/server/title-cards.server"
import type {
	TvHomeData,
	TvService,
	TvTonightPick,
} from "~/ui/living-room/tv/tv-home"
import {
	DOOR_HREF,
	SHOWS_PER_GROUP,
	TONIGHT_PICKS,
} from "~/ui/living-room/tv/tv-machine"
import { brandName, getShorterProviderLabel } from "~/utils/streaming-links"

/**
 * What every guest of a country gets: the start titles, the first picture, and the two services the Remote's
 * keys and home's tiles stand for.
 */
export function guestHome(
	start: { titles: TvHomeData["startTitles"]; picture: string | null },
	services: TvService[],
): TvHomeData {
	return {
		member: false,
		startTitles: start.titles,
		picture: start.picture,
		tonight: [],
		shows: null,
		services,
	}
}

// ---- The person's two streaming services: the Remote's keys and home's tiles after the apps.

/** How many services the Remotes have a key for. */
export const TV_SERVICES = 2

/** The pair every Remote had before: Netflix and Prime Video, by TMDB provider id. They fill up what is missing. */
const FIXED_PAIR: TvService[] = [
	{ id: 8, name: "Netflix", logo_path: null },
	{ id: 9, name: "Prime", logo_path: null },
]

/** A service as the catalog lists it. */
type CatalogService = { id: number; name: string; logo_path: string | null }

/** A service's name as the app says it in a line: "Prime", "Disney+". Plans and channels of one brand share it. */
const brandOf = (name: string) => brandName(getShorterProviderLabel(name))

/**
 * The services of a country's catalog in the country's own order, the one the settings and Discover list them
 * in. A service the country does not have is left out; services at the same place keep the order they came in.
 */
export function countryCatalog<
	S extends CatalogService & { order_by_country?: Record<string, number> },
>(providers: readonly S[], country: string): S[] {
	return providers
		.map((service, at) => ({
			service,
			at,
			order: service.order_by_country?.[country],
		}))
		.filter((one): one is typeof one & { order: number } => one.order != null)
		.sort((a, b) => a.order - b.order || a.at - b.at)
		.map(({ service }) => service)
}

/**
 * The person's services, as many as the Remotes have keys for, one per brand: their own saved services in the
 * order they saved them, filled up from their country's catalog in its order, and then from the fixed pair where
 * the catalog has too few (a country nobody has data for, a failed read). A guest has no saved services, so a
 * guest's are the first of the country's catalog.
 */
export function tvServices(
	saved: readonly CatalogService[],
	catalog: readonly CatalogService[],
	count = TV_SERVICES,
): TvService[] {
	const byBrand = new Map<string, TvService>()
	for (const { id, name, logo_path } of [...saved, ...catalog, ...FIXED_PAIR]) {
		const brand = brandOf(name)
		if (!byBrand.has(brand))
			byBrand.set(brand, { id, name: brand, logo_path: logo_path || null })
	}
	return [...byBrand.values()].slice(0, count)
}

/**
 * The shows whose card Tonight needs: the show of Tonight's pick when the pick is an episode or a show to start,
 * and the first show to start, which follows the movies.
 */
export function tonightShowIds(parts: TonightParts): number[] {
	const choice = tonightsPickOf(parts.shows, parts.movies[0]?.tmdb_id ?? null)
	const ids = new Set<number>()
	if (choice && choice.kind !== "movie") ids.add(choice.showId)
	const start = parts.shows.start[0]
	if (start) ids.add(start.id)
	return [...ids]
}

/**
 * A member's Tonight and My shows, shaped from what home's doors read.
 * - Tonight: up to three picks. The first is Tonight's pick, as `getTonightsPick` decides it with tracking: the
 *   Next episode of the first show to continue, else the first movie of My movies, else the first show to start.
 *   The movies follow, then the first show to start.
 * - My shows: the first three shows to continue, or to pick up when there is none, and the first three to start.
 * `showCards` are the cards of `tonightShowIds`; a show the catalog lacks is left out.
 */
export function memberHome(
	parts: TonightParts,
	showCards: readonly TitleCard[],
): Pick<TvHomeData, "tonight" | "shows"> {
	const { shows, movies } = parts
	const showCard = (id: number) =>
		showCards.find((card) => card.media_type === "show" && card.tmdb_id === id)
	const choice = tonightsPickOf(shows, movies[0]?.tmdb_id ?? null)
	const tonight: TvTonightPick[] = []
	if (choice?.kind === "episode") {
		const card = showCard(choice.showId)
		const next = shows.continue[0].next
		if (card)
			tonight.push({
				card,
				href: DOOR_HREF.continue,
				...(next && {
					episode: { code: episodeCode(next), name: next.name },
				}),
			})
	}
	const start = shows.start[0]
	const startCard = start && showCard(start.id)
	const startPick = startCard && { card: startCard, href: DOOR_HREF.start }
	// A show to start is Tonight's pick only without a movie; otherwise it follows the movies.
	if (choice?.kind === "start" && startPick) tonight.push(startPick)
	for (const card of movies) tonight.push({ card, href: DOOR_HREF.movie })
	if (choice?.kind !== "start" && startPick) tonight.push(startPick)

	const started = shows.continue.length ? shows.continue : shows.pickUp
	return {
		tonight: tonight.slice(0, TONIGHT_PICKS),
		shows: {
			next: started.slice(0, SHOWS_PER_GROUP).map((row) => ({
				id: row.id,
				title: row.title,
				poster_path: row.poster_path,
				backdrop_path: row.backdrop_path,
				episode: row.next && {
					code: episodeCode(row.next),
					name: row.next.name,
					runtime: row.next.runtime,
				},
				// My shows (slice 9).
				left: row.left,
				caughtUp: row.kind === "seenNew",
			})),
			start: shows.start.slice(0, SHOWS_PER_GROUP).map((show) => ({
				id: show.id,
				title: show.title,
				poster_path: show.poster_path,
				backdrop_path: show.backdrop_path,
				match: show.match,
				service: show.service,
				// My shows (slice 9).
				seasons: show.seasons,
			})),
		},
	}
}

/** A country's first services are kept for a day; a failed read is tried again after a minute. */
const COUNTRY_SERVICES_MS = 24 * 60 * 60 * 1000
const COUNTRY_SERVICES_RETRY_MS = 60 * 1000
/** As many as fill up a member who saved services of the catalog's first brands. */
const COUNTRY_SERVICES_KEPT = 2 * TV_SERVICES

/**
 * Keeps the first services of each country's catalog in memory: `read` runs once per country and day, and
 * requests that arrive while it runs wait for the same read. A failed read answers none (the fixed pair then
 * fills up) and is tried again after a minute. It never throws.
 */
export function keepCountryServices<
	S extends CatalogService & { order_by_country?: Record<string, number> },
>(
	read: (country: string) => Promise<readonly S[]>,
	clock: () => number = Date.now,
): (country: string) => Promise<TvService[]> {
	const kept = new Map<
		string,
		{ services: Promise<TvService[]>; until: number }
	>()
	return (country) => {
		const now = clock()
		const have = kept.get(country)
		if (have && have.until > now) return have.services
		const entry = {
			until: now + COUNTRY_SERVICES_MS,
			services: Promise.resolve()
				.then(() => read(country))
				.then((providers) =>
					tvServices(
						[],
						countryCatalog(providers, country),
						COUNTRY_SERVICES_KEPT,
					),
				)
				.catch((error): TvService[] => {
					console.error("The TV: loading a country's services failed", error)
					entry.until = clock() + COUNTRY_SERVICES_RETRY_MS
					return []
				}),
		}
		kept.set(country, entry)
		return entry.services
	}
}
