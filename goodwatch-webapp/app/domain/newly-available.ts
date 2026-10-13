// Newly available on a member's services (#456): the rules. A title lands when none of the member's saved services
// carried it and one does now; a landing is news when it came after the member last opened the page the title
// lives on, after the launch, and after the member had the title. For 14 days from the day it landed the title
// also counts as recently landed, whether the member opened the page or not (#489). Pure, and the server's alone:
// what the navigation is told and what it says are in domain/newly-available-signal.ts and
// newly-available-words.ts (docs/implementation/tracking/newly-available/README.md).

import { duplicateProviderMapping } from "~/utils/streaming-links"
import { type TitleKey, parseTitleKey, titleKey } from "~/utils/title-key"
import type { Landings, NewOnServices } from "./newly-available-signal"

// Duplicate service ids are one service: Amazon Video and the second Amazon Prime Video are Amazon Prime Video,
// Apple TV Plus is Apple TV.
const baseServiceOf = new Map<number, number>()
for (const [base, duplicates] of Object.entries(duplicateProviderMapping))
	for (const duplicate of duplicates) baseServiceOf.set(duplicate, Number(base))

/** The service an id belongs to: itself, or the service it duplicates. */
export const baseService = (id: number) => baseServiceOf.get(id) ?? id

// ---------------------------------------------------------------------------------------------------------
// The times the availability index keeps

/** When each service first carried a title, by base service, for the services that started after the times kept. */
export type FirstSeen = ReadonlyMap<number, number>

/**
 * The time each service first carried each title, from the earliest `created_at` of the title's rows per service
 * id: `[title, service id, time]`. A service's duplicates and its kinds of offer are one service, and its earliest
 * row is when it started. Only services that started after `since` are kept: every other one has carried the
 * title for longer than anyone is told about. The rows must hold every current row of the titles they name.
 */
export function firstSeenOf(
	rows: Iterable<readonly [TitleKey, number, number]>,
	since: number,
): Map<TitleKey, Map<number, number>> {
	const earliest = new Map<TitleKey, Map<number, number>>()
	for (const [key, serviceId, at] of rows) {
		const service = baseService(serviceId)
		let services = earliest.get(key)
		if (!services) {
			services = new Map()
			earliest.set(key, services)
		}
		const known = services.get(service)
		if (known === undefined || at < known) services.set(service, at)
	}
	for (const [key, services] of earliest) {
		for (const [service, at] of services)
			if (!(at > since)) services.delete(service)
		if (!services.size) earliest.delete(key)
	}
	return earliest
}

// ---------------------------------------------------------------------------------------------------------
// When a title landed on a member's services

export interface Landing {
	/** When the first of the member's services started to carry the title. */
	at: number
	/** That service. */
	service: number
}

/**
 * When a title landed on a member's services, or null: it is on none of them, or one of them has carried it for
 * longer than the times kept, so it was watchable before. `carried` are the services that carry the title now and
 * `mine` the member's, both as base services; `fresh` holds the title's services that started lately.
 */
export function landingOn(
	carried: Iterable<number>,
	fresh: FirstSeen | undefined,
	mine: ReadonlySet<number>,
): Landing | null {
	let landing: Landing | null = null
	for (const service of carried) {
		if (!mine.has(service)) continue
		const at = fresh?.get(service)
		if (at === undefined) return null
		if (!landing || at < landing.at) landing = { at, service }
	}
	return landing
}

// ---------------------------------------------------------------------------------------------------------
// Which titles, and which landings are news

export interface TitleThatCanLand {
	key: TitleKey
	/** When the member added it to Want to See; null for a show they watch, which counts from the start. */
	addedAt: number | null
}

/** A member's Want to See titles, and the shows they are Watching or have On hold. */
export function titlesThatCanLand(
	wishlist: ReadonlyMap<TitleKey, Date>,
	watchState: Readonly<Record<string, { state: string }>>,
): TitleThatCanLand[] {
	const watched = new Set<TitleKey>()
	for (const [key, entry] of Object.entries(watchState)) {
		if (!key.startsWith("show-")) continue
		if (entry.state === "watching" || entry.state === "on_hold")
			watched.add(titleKey("show", Number(key.slice(5))))
	}
	const titles: TitleThatCanLand[] = []
	for (const [key, added] of wishlist)
		titles.push({ key, addedAt: watched.has(key) ? null : added.getTime() })
	for (const key of watched)
		if (!wishlist.has(key)) titles.push({ key, addedAt: null })
	return titles
}

export interface Candidate extends TitleThatCanLand {
	landing: Landing | null
}

/** A title whose landing is news for the member. */
export interface Landed {
	key: TitleKey
	tmdbId: number
	at: number
	service: number
}

/**
 * The landings that are news, movies and shows apart, the latest first. A landing counts when it came after the
 * launch, after the member's last visit of the title's page (My movies for a movie, My shows for a show; null for
 * a member who never opened it), and after the member added the title to Want to See.
 */
export function newlyAvailableOf(
	candidates: readonly Candidate[],
	rule: {
		launch: number
		visits: { movie: number | null; show: number | null }
	},
): { movies: Landed[]; shows: Landed[] } {
	const news = { movie: [] as Landed[], show: [] as Landed[] }
	for (const { key, addedAt, landing } of candidates) {
		if (!landing) continue
		const { mediaType, tmdbId } = parseTitleKey(key)
		const after = Math.max(
			rule.launch,
			rule.visits[mediaType] ?? Number.NEGATIVE_INFINITY,
			addedAt ?? Number.NEGATIVE_INFINITY,
		)
		if (landing.at > after) news[mediaType].push({ key, tmdbId, ...landing })
	}
	const latestFirst = (a: Landed, b: Landed) => b.at - a.at || a.key - b.key
	return {
		movies: news.movie.sort(latestFirst),
		shows: news.show.sort(latestFirst),
	}
}

// ---------------------------------------------------------------------------------------------------------
// Recently landed: what the row on My movies and My shows lists, a poster marks and a home door leads with (#489)

/** How many days a landing counts, the day it landed included. */
export const LANDED_DAYS = 14

const DAY_MS = 86_400_000

/** Days since a title landed, by the calendar (UTC), as a watch's day reads elsewhere: 0 on the day itself. */
export const daysSinceLanding = (at: number, now: number) =>
	Math.max(0, Math.floor(now / DAY_MS) - Math.floor(at / DAY_MS))

/**
 * The landings that still count, movies and shows apart, the latest first: after the launch, after the member
 * added the title, and in the last `LANDED_DAYS` days. Flat: a visit of the page does not end it, and nothing is
 * stored for it.
 */
export function recentlyLandedOf(
	candidates: readonly Candidate[],
	rule: { launch: number; now: number },
): { movies: Landed[]; shows: Landed[] } {
	const landed = newlyAvailableOf(candidates, {
		launch: rule.launch,
		visits: { movie: null, show: null },
	})
	const counts = ({ at }: Landed) =>
		daysSinceLanding(at, rule.now) < LANDED_DAYS
	return {
		movies: landed.movies.filter(counts),
		shows: landed.shows.filter(counts),
	}
}

/**
 * What the row of My movies and of My shows lists, the latest first: the landings of the last `LANDED_DAYS` days,
 * and after them the older ones that are still news to the member. The signal counts those until the page is
 * opened (#456), and the page it leads to has to say what they are.
 */
export function listedLandingsOf(
	candidates: readonly Candidate[],
	rule: {
		launch: number
		now: number
		visits: { movie: number | null; show: number | null }
	},
): { movies: Landed[]; shows: Landed[] } {
	const recent = recentlyLandedOf(candidates, rule)
	const news = newlyAvailableOf(candidates, rule)
	const withNews = (counted: Landed[], unseen: Landed[]) => {
		const keys = new Set(counted.map(({ key }) => key))
		return [...counted, ...unseen.filter(({ key }) => !keys.has(key))]
	}
	return {
		movies: withNews(recent.movies, news.movies),
		shows: withNews(recent.shows, news.shows),
	}
}

/**
 * A home door's titles with the recently landed ones in front, the latest landing first; everything else keeps
 * its place. `behind` says whether a landed title is behind the door at all: a movie that fits tonight, a show
 * not started.
 */
export function landedFirst<T>(
	order: readonly T[],
	landed: readonly T[],
	behind: (item: T) => boolean,
): T[] {
	const lead = landed.filter(behind)
	if (!lead.length) return [...order]
	const led = new Set(lead)
	return [...lead, ...order.filter((item) => !led.has(item))]
}

// ---------------------------------------------------------------------------------------------------------
// What the signal is told

/** The titles of one kind that landed and are news, the latest first, with what is read to say them. */
export interface LandedTitles {
	ids: number[]
	/** The title and the service it landed on, when it is one and both have a name. */
	only: { title: string; service: string } | null
}

export interface NewlyAvailable {
	movies: LandedTitles
	shows: LandedTitles
}

const landingsOf = ({ ids, only }: LandedTitles): Landings => ({
	count: ids.length,
	ids,
	only: ids.length === 1 ? only : null,
})

/** What the navigation and home's doors are told; null when nothing landed. */
export function signalOf(fresh: NewlyAvailable): NewOnServices | null {
	if (!fresh.movies.ids.length && !fresh.shows.ids.length) return null
	return { movies: landingsOf(fresh.movies), shows: landingsOf(fresh.shows) }
}
