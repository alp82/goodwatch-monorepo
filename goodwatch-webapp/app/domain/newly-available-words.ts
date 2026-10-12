// Newly available on a member's services (#456): what the hub's tiles, home's doors and the two pages say. Apart
// from domain/newly-available-signal.ts, which the navigation loads on every page: these words load with the hub,
// the doors and the pages.

import {
	type NewEpisodes,
	type SignalWords,
	signalWords,
} from "./new-episodes-signal"
import {
	type LandedLine,
	type Landings,
	badgeOf,
	newShowCount,
} from "./newly-available-signal"

type Kind = "movie" | "show"

const counted = (count: number, kind: Kind) =>
	`${count} ${kind}${count === 1 ? "" : "s"}`
const are = (count: number) => (count === 1 ? "is" : "are")

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
			door: `${only.title} is now on ${only.service}`,
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

/** How many names a page's line says before it counts the rest, as My shows does for new episodes. */
export const LINE_NAMES = 3

/**
 * The one line a page says on arrival about what landed: "Dune is now on Netflix", and with several the names. The
 * lead is set in bold. Null when nothing landed.
 */
export function landedLine(
	kind: Kind,
	landed: LandedLine | null,
): { lead: string; rest: string } | null {
	if (!landed?.count) return null
	const { count, titles, service } = landed
	if (!titles.length)
		return {
			lead: counted(count, kind),
			rest: `${are(count)} now on your services`,
		}
	if (count === 1)
		return {
			lead: titles[0],
			rest: `is now on ${service ?? "your services"}`,
		}
	const names = titles.slice(0, LINE_NAMES)
	const more = count - names.length
	return {
		lead: "Now on your services:",
		rest: names.join(", ") + (more > 0 ? ` and ${more} more` : ""),
	}
}
