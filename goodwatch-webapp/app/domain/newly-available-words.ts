// Newly available on a member's services (#456): what the hub's tiles, home's doors and the pages say, and what
// they are told about the titles that landed in the last 14 days (#489). Apart from
// domain/newly-available-signal.ts, which the navigation loads on every page: these words load with the hub, the
// doors and the pages.

import {
	type NewEpisodes,
	type SignalWords,
	signalWords,
} from "./new-episodes-signal"
import { type Landings, badgeOf, newShowCount } from "./newly-available-signal"

type Kind = "movie" | "show"

const counted = (count: number, kind: Kind) =>
	`${count} ${kind}${count === 1 ? "" : "s"}`
const are = (count: number) => (count === 1 ? "is" : "are")
const IS_NOW_ON = " is now on "

/**
 * What a tile and a door say about the titles that landed: one is named with its service, several are counted.
 * Null when nothing landed. A phone's tile has one line of about 22 characters and cuts the rest, so its line
 * leads with the service: cut, it still says what happened ("Now on Netflix: Dune: P...").
 */
export function landedWords(
	kind: Kind,
	landed: Landings | null,
): SignalWords | null {
	if (!landed?.count) return null
	const { count, only } = landed
	const badge = badgeOf(count)
	const doorShort = counted(count, kind)
	if (only)
		return {
			badge,
			tile: `Now on ${only.service}: ${only.title}`,
			door: `${only.title}${IS_NOW_ON}${only.service}`,
			doorShort,
		}
	return {
		badge,
		tile: `${count} now on your services`,
		door: `${doorShort} ${are(count)} now on your services`,
		doorShort,
	}
}

/**
 * What the My shows tile and the door that opens My shows say: new episodes, shows that landed, or both. With both
 * the shows are counted, each once; one show with a new episode that also landed says its episode.
 */
export function showsWords(
	episodes: NewEpisodes | null,
	landed: Landings | null,
): SignalWords | null {
	const aired = episodes ? signalWords(episodes) : null
	if (!landed?.count) return aired
	if (!aired) return landedWords("show", landed)
	const shows = newShowCount(episodes, landed)
	if (shows === 1) return aired
	const doorShort = counted(shows, "show")
	return {
		badge: badgeOf(shows),
		tile: `New in ${doorShort}`,
		door: `${doorShort} have something new`,
		doorShort,
	}
}

// ---------------------------------------------------------------------------------------------------------
// Recently landed (#489): the row on My movies and My shows, the mark on a poster, the line of a home door

/** The service a title is new on, as a poster and a line show it: its short name ("Prime") and its logo. */
export interface NewOn {
	id: number
	name: string
	logo_path: string
}

/** A title that landed on the member's services in the last 14 days, as the pages are told. */
export interface LandedTitle {
	mediaType: Kind
	tmdbId: number
	title: string
	poster_path: string | null
	/** The GoodWatch score, 0 to 100, for the row's score pill. */
	goodwatch?: number | null
	/** When it landed, in milliseconds, and how many days ago by the calendar (UTC): 0 on the day itself. */
	at: number
	days: number
	/** The service it landed on; null when the catalog has no name for it. */
	service: NewOn | null
}

/** "New on Netflix": the mark on a title, and the small line of a home door. */
export const newOn = (service: string | null) =>
	`New on ${service ?? "your services"}`

/**
 * What the row says while it is closed: the latest title with its service and its day, and how many more it opens
 * to. Null when nothing landed.
 */
export function landedRowWords(landed: readonly LandedTitle[]): {
	title: string
	says: string
	when: string
	more: string | null
} | null {
	const [latest] = landed
	if (!latest) return null
	return {
		title: latest.title,
		says: `is new on ${latest.service?.name ?? "your services"}`,
		when: ago(latest.days),
		more: landed.length > 1 ? `and ${landed.length - 1} more` : null,
	}
}

const DAY_MONTH = new Intl.DateTimeFormat("en-GB", {
	day: "numeric",
	month: "short",
	timeZone: "UTC",
})
const ago = (days: number) =>
	days < 1 ? "today" : days === 1 ? "yesterday" : `${days} days ago`

/**
 * The day a title landed, in the row's list: within a week the distance leads and the date follows ("Yesterday",
 * "11 Oct"); after that the date leads ("30 Sept", "12 days ago").
 */
export function landedDayWords(
	at: number,
	days: number,
): { when: string; detail: string } {
	const date = DAY_MONTH.format(at)
	const distance = ago(days)
	return days < 7
		? { when: distance[0].toUpperCase() + distance.slice(1), detail: date }
		: { when: date, detail: distance }
}

/**
 * The small line of a home door whose first title is recently landed: "New on Netflix". Null for a door that is
 * not led by one, and while the pill on home already names that title with its service: the door then does not
 * say it a second time.
 */
export const doorNewOn = (
	lead: { title: string | null; newOn?: string | null },
	pill: string | null | false,
): string | null =>
	lead.newOn && !(lead.title && pill && pill.startsWith(lead.title + IS_NOW_ON))
		? newOn(lead.newOn)
		: null
