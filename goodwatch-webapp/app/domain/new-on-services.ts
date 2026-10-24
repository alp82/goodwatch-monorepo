// "New on your services" (#489 Part C): the rules of the pages at /new. A page lists the titles first seen on a
// service in a country within its window (14 days, flat, never before the launch of Newly available), ranked by
// GoodWatch score, and again day by day, the latest first. A title says its arrival day only where the day is exact;
// otherwise it says "New on Netflix" and nothing more (#625, variation A). Backfilled offers are old catalog and never
// an arrival. The continuity rules are those of Newly available (domain/newly-available.ts): offer types, a brand's
// tiers and a return that joins an older stay are one arrival.
//
// Addresses: /new/us/netflix is the page of a service in a country, /new/us the country's page for every service,
// /new/netflix the share link that leads each visitor to their own country, and /new the member's own page.
// docs/implementation/new-on-services/README.md

import type { TitleKey } from "~/utils/title-key"
import brandList from "./new-on-services-brands.json" with { type: "json" }
import {
	BACKFILLED,
	LANDED_DAYS,
	type ServiceStay,
	baseService,
	daysSinceLanding,
	firstSeenOf,
	landingOn,
	titlesThatCanLand,
} from "./newly-available"
import { duplicateProviderMapping } from "~/utils/streaming-links"

const DAY_MS = 86_400_000

// ---------------------------------------------------------------------------------------------------------
// Services

/** A streaming brand with a page of its own: the services the daily list job reads in every country (#682). */
export interface Brand {
	slug: string
	name: string
	/** Its service ids. The first is the id the app counts the brand as (a base service). */
	ids: readonly number[]
	/** The id whose logo stands for the brand. */
	logo: number
}

export const BRANDS: readonly Brand[] = brandList

const bySlug = new Map(BRANDS.map((brand) => [brand.slug, brand]))
const byService = new Map<number, Brand>()
for (const brand of BRANDS) for (const id of brand.ids) byService.set(id, brand)

export const brandBySlug = (slug: string): Brand | null =>
	bySlug.get(slug) ?? null

export const brandOfService = (id: number): Brand | null =>
	byService.get(id) ?? byService.get(baseService(id)) ?? null

/** The id a service counts as: its brand's, or the service it duplicates ("with ads" tiers, Amazon Video). */
export const familyOf = (id: number) =>
	brandOfService(id)?.ids[0] ?? baseService(id)

/** Every service id that offers the given services: a brand's tiers, and a service's duplicates. */
export function serviceIdsOf(services: Iterable<number>): number[] {
	const ids = new Set<number>()
	for (const service of services) {
		const family = familyOf(service)
		const brand = brandOfService(family)
		for (const id of brand
			? brand.ids
			: [family, ...(duplicateProviderMapping[family] ?? [])])
			ids.add(id)
	}
	return [...ids]
}

// ---------------------------------------------------------------------------------------------------------
// Which titles: the window and the arrivals

/** How many days an arrival counts, the day it arrived included: the same 14 days as parts A and B. */
export const WINDOW_DAYS = LANDED_DAYS

export const utcDay = (time: number) => Math.floor(time / DAY_MS) * DAY_MS

/** The first day of the window: 13 days before today (UTC), and never before the launch day. */
export const windowStart = (now: number, launch: number) =>
	Math.max(utcDay(launch), utcDay(now) - (WINDOW_DAYS - 1) * DAY_MS)

/** One stay of a title on a service in a country, as availability_history keeps it. */
export interface HistoryStay {
	key: TitleKey
	service: number
	/** The day it arrived: appeared_on for an exact stay, otherwise the UTC day it was first observed. */
	landedOn: number
	exact: boolean
	/** Opened by the first read of a list or a backfill: old catalog, never an arrival. */
	backfill: boolean
	droppedOn: number | null
	createdAt: number
}

export interface Arrival {
	key: TitleKey
	/** The service it arrived on, as the id it counts as (`familyOf`). */
	service: number
	at: number
	exact: boolean
}

const newestFirst = (a: { at: number; key: number }, b: typeof a) =>
	b.at - a.at || a.key - b.key

/**
 * The titles that arrived on the services within the window, newest first. A title arrives when none of the services
 * carried it and one does now; the first of them is the service it arrived on. Stays of other services are not read,
 * so a title that moves from Hulu to Netflix is new on Netflix's page.
 */
export function arrivalsOf(
	stays: Iterable<HistoryStay>,
	{ services, since }: { services: Iterable<number>; since: number },
): Arrival[] {
	const rows: ServiceStay[] = []
	for (const stay of stays)
		rows.push([
			stay.key,
			familyOf(stay.service),
			stay.backfill ? BACKFILLED : stay.landedOn,
			stay.droppedOn,
			stay.createdAt,
			!stay.backfill && stay.exact,
		])
	const mine = new Set([...services].map(familyOf))
	const arrivals: Arrival[] = []
	for (const [key, fresh] of firstSeenOf(rows, Number.NEGATIVE_INFINITY)) {
		const landing = landingOn(fresh.keys(), fresh, mine)
		if (!landing || landing.at < since) continue
		arrivals.push({
			key,
			service: landing.service,
			at: landing.at,
			exact: fresh.get(landing.service)?.exact === true,
		})
	}
	return arrivals.sort(newestFirst)
}

/**
 * The titles a member waits for, as Newly available counts them: Want to See, and the shows they are Watching or
 * have On hold ("watching" wins for a show on both).
 */
export const waitsOf = (
	wishlist: ReadonlyMap<TitleKey, Date>,
	watchState: Readonly<Record<string, { state: string }>>,
): Map<TitleKey, "want" | "watching"> =>
	new Map(
		titlesThatCanLand(wishlist, watchState).map(({ key, addedAt }) => [
			key,
			addedAt === null ? "watching" : "want",
		]),
	)

// ---------------------------------------------------------------------------------------------------------
// Order

interface Ranked {
	key: TitleKey
	at: number
	score: number | null
	/** Left out when a caller doesn't know it; null when the catalog has no poster. */
	poster_path?: string | null
}

// A card without a poster shows the placeholder: it goes after every card with one.
const withPosterFirst = (a: Ranked, b: Ranked) =>
	Number(b.poster_path !== null) - Number(a.poster_path !== null)

/**
 * Titles with a poster first; then best GoodWatch score first, titles without a score last, the newer first on a
 * tie.
 */
export const rankByScore = <T extends Ranked>(list: readonly T[]): T[] =>
	[...list].sort(
		(a, b) =>
			withPosterFirst(a, b) ||
			(b.score ?? -1) - (a.score ?? -1) ||
			newestFirst(a, b),
	)

export interface DayGroup<T> {
	/** The UTC day, or null for the titles whose day is not known. */
	day: number | null
	titles: T[]
}

/**
 * Exact days, the latest first, each best first; then the titles without a known day, the newest first. In each
 * group, titles without a poster go last.
 */
export function dayGroupsOf<T extends Ranked & { exact: boolean }>(
	list: readonly T[],
): DayGroup<T>[] {
	const days = new Map<number, T[]>()
	const unknown: T[] = []
	for (const title of list) {
		if (!title.exact) {
			unknown.push(title)
			continue
		}
		const day = utcDay(title.at)
		days.set(day, [...(days.get(day) ?? []), title])
	}
	const groups: DayGroup<T>[] = [...days]
		.sort(([a], [b]) => b - a)
		.map(([day, titles]) => ({ day, titles: rankByScore(titles) }))
	if (unknown.length)
		groups.push({
			day: null,
			titles: [...unknown].sort(
				(a, b) => withPosterFirst(a, b) || newestFirst(a, b),
			),
		})
	return groups
}

// ---------------------------------------------------------------------------------------------------------
// Words. Days are UTC days, the days the history keeps.

const WEEKDAYS = [
	"Sunday",
	"Monday",
	"Tuesday",
	"Wednesday",
	"Thursday",
	"Friday",
	"Saturday",
]
const MONTHS = [
	"January",
	"February",
	"March",
	"April",
	"May",
	"June",
	"July",
	"August",
	"September",
	"October",
	"November",
	"December",
]

/** "October 13". */
export const dateWords = (at: number) => {
	const date = new Date(at)
	return `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}`
}

const weekday = (at: number) => WEEKDAYS[new Date(at).getUTCDay()]

/** "today", "yesterday", "on Tuesday" within the week, "on October 13" after it. */
export function dayWords(at: number, now: number): string {
	const days = daysSinceLanding(at, now)
	if (days === 0) return "today"
	if (days === 1) return "yesterday"
	return days < 7 ? `on ${weekday(at)}` : `on ${dateWords(at)}`
}

/** A day's heading: "Today", "Yesterday", "Tuesday, October 13". */
export function dayHeading(at: number, now: number): string {
	const days = daysSinceLanding(at, now)
	if (days === 0) return "Today"
	if (days === 1) return "Yesterday"
	return `${weekday(at)}, ${dateWords(at)}`
}

/** A short stamp under a poster: "Today", "Yesterday", "Tue, Oct 13". */
export function dayStamp(at: number, now: number): string {
	const days = daysSinceLanding(at, now)
	if (days < 2) return days === 0 ? "Today" : "Yesterday"
	const date = new Date(at)
	return `${weekday(at).slice(0, 3)}, ${MONTHS[date.getUTCMonth()].slice(0, 3)} ${date.getUTCDate()}`
}

/** "New on Netflix yesterday" for an exact day; "New on Netflix" otherwise, with no day and no week. */
export const arrivalWords = (
	arrival: { at: number; exact: boolean },
	service: string,
	now: number,
) =>
	arrival.exact
		? `New on ${service} ${dayWords(arrival.at, now)}`
		: `New on ${service}`

/** What a title a member waits for says. "since" is said of an exact day only. */
export function waitedWords(
	arrival: { at: number; exact: boolean },
	wait: "want" | "watching",
	service: string,
	now: number,
): { lead: string; landed: string } {
	const days = daysSinceLanding(arrival.at, now)
	const since =
		days === 0
			? "since today"
			: days === 1
				? "since yesterday"
				: days < 7
					? `since ${weekday(arrival.at)}`
					: `since ${dateWords(arrival.at)}`
	return {
		lead: wait === "watching" ? "You are watching it" : "You want to see it",
		landed: arrival.exact ? `On ${service} ${since}` : `New on ${service}`,
	}
}

const plural = (n: number, one: string, many = `${one}s`) =>
	`${n.toLocaleString("en-US")} ${n === 1 ? one : many}`

/** "17 movies and shows", "3 movies", "1 show". */
export function countWords(list: readonly { media_type: string }[]): string {
	const movies = list.filter((t) => t.media_type === "movie").length
	const shows = list.length - movies
	if (movies && shows) return `${plural(list.length, "movie and show", "movies and shows")}`
	return movies ? plural(movies, "movie") : plural(shows, "show")
}

/** The line under the heading: how many titles in how many days, and how many of them arrived today. */
export function tallyWords(
	list: readonly { at: number; exact: boolean; media_type: string }[],
	since: number,
	now: number,
): string {
	const days = Math.round((utcDay(now) - utcDay(since)) / DAY_MS) + 1
	const window = `in the last ${days} days`
	if (!list.length) return `Nothing new ${window}`
	const today = list.filter(
		(t) => t.exact && daysSinceLanding(t.at, now) === 0,
	).length
	return `${countWords(list)} ${window}${today ? `, ${today} of them today` : ""}`
}

// Country names that English says with "the".
const WITH_THE = new Set([
	"Bahamas",
	"Comoros",
	"Czech Republic",
	"Gambia",
	"Maldives",
	"Netherlands",
	"Palestinian Territory",
	"Philippines",
	"Seychelles",
	"Vatican",
])

/** "in Germany", "in the United States". */
export const inCountry = (name: string) =>
	WITH_THE.has(name) ||
	/^United |Islands$|Republic|^Republic|Territory$/.test(name)
		? `in the ${name}`
		: `in ${name}`

// ---------------------------------------------------------------------------------------------------------
// Addresses

export const countryPath = (country: string) => `/new/${country.toLowerCase()}`
export const servicePath = (country: string, brand: Brand) =>
	`${countryPath(country)}/${brand.slug}`
/** The link people share: no country, so each visitor lands on the page of their own. */
export const sharePath = (brand: Brand) => `/new/${brand.slug}`
export const shareTarget = (brand: Brand, viewerCountry: string) =>
	servicePath(viewerCountry, brand)

export type Where =
	| { kind: "country"; country: string }
	| { kind: "share"; brand: Brand }
	| { kind: "redirect"; to: string }
	| { kind: "notFound" }

/** What the part after /new names: a country the site knows (lower case), a service to share, or nothing. */
export function readWhere(segment: string, known: ReadonlySet<string>): Where {
	if (/^[a-z]{2}$/i.test(segment) && known.has(segment.toUpperCase()))
		return segment === segment.toLowerCase()
			? { kind: "country", country: segment.toUpperCase() }
			: { kind: "redirect", to: countryPath(segment) }
	const brand = brandBySlug(segment)
	return brand ? { kind: "share", brand } : { kind: "notFound" }
}

/** On a country's page opened from another country: the same page for the viewer's own, or null. */
export function countryOffer(
	pageCountry: string,
	viewerCountry: string,
	brand: Brand | null,
	names: ReadonlyMap<string, string>,
): { country: string; path: string; words: string } | null {
	const country = viewerCountry.toUpperCase()
	const name = names.get(country)
	if (country === pageCountry.toUpperCase() || !name) return null
	return {
		country,
		path: brand ? servicePath(country, brand) : countryPath(country),
		words: `New on ${brand ? brand.name : "streaming"} ${inCountry(name)}`,
	}
}

// ---------------------------------------------------------------------------------------------------------
// Search engines

export type PageKind = "service" | "country" | "member"

/** An empty page stays out of search engines until it has titles; the member's page always does. */
export const robotsFor = (kind: PageKind, count: number) =>
	kind === "member" || count === 0
		? ("noindex, follow" as const)
		: ("index, follow" as const)

export function pageCopy({
	kind,
	brand,
	country,
	countryName,
	tally,
	count,
}: {
	kind: PageKind
	brand: string | null
	country: string
	countryName: string
	tally: string
	count: number
}): { heading: string; title: string; description: string } {
	if (kind === "member")
		return {
			heading: "New on your services",
			title: "New on your services | GoodWatch",
			description: "What arrived on your streaming services lately.",
		}
	const where = inCountry(countryName)
	const on = brand ?? "streaming"
	const heading = brand ? `New on ${brand}` : `New on streaming ${where}`
	const title = brand
		? `New on ${brand} (${country}): the latest movies and shows | GoodWatch`
		: `New on streaming ${where}: the latest movies and shows | GoodWatch`
	const description = count
		? `What's new on ${on} ${where}: ${tally}. Best first, with GoodWatch scores. Updated daily.`
		: `What's new on ${on} ${where}. ${tally}. Updated daily.`
	return { heading, title, description }
}
