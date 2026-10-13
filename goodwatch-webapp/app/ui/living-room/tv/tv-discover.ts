// What mini Discover on the TV says and asks for: the eighteen options of its three tabs in words and colours,
// the request for the titles of one choice, and a title's line of facts. Pure, so the words and the rules stay in
// one place and have tests.
//
// Which six each tab offers is the machine's (`DISCOVER_TABS` in tv-machine.ts). What an option is called and
// its colour are the app's own:
// - A mood's name, line and colour are read from `domain/moods.ts`.
// - A theme's and a style's name and colour are those of `domain/themes-styles.ts`, written out here, and
//   tv-discover.test.ts holds each to that list. They are not read from it, because that module is part of the
//   Discover page's filter code: a module the TV shares with it becomes a file of its own, one more script in the
//   first view of the Discover page and of every page that loads the filter's labels (measured in a build).
// - A theme and a style have no line in the app, so their twelve lines are the approved prototype's.
//
// The titles of a choice are Discover's own results for that one filter, asked for as the Discover page asks:
// `/api/discover/results?moods=<key>`, `?themes=<key>` or `?styles=<key>`. So the four titles on the TV are the
// first four on the page the Expand key opens, in the same order.
//
// With the Discover screen's chunk: nothing here is in the start page's first view.
import type { TitleCard } from "~/server/title-cards.server"
import { MOOD_BY_KEY, type MoodKey } from "../../../domain/moods.ts"
import {
	DISCOVER_TABS,
	LIST_TITLES,
	type TvDiscoverTab,
	discoverTab,
} from "./tv-machine.ts"
import { titleKicker, whereLine } from "./tv-title.ts"

/** One option of a tab, as its tile shows it. */
export type TvDiscoverOption = {
	/** Its item on the choice screen: `mood:funny`, `theme:crime`, `style:slow`. */
	item: string
	key: string
	name: string
	/** One line saying what it is. */
	line: string
	/** "#rrggbb", the mood's, theme's or style's own colour. */
	color: string
}

export const DISCOVER_TAB_NAME: Record<TvDiscoverTab, string> = {
	moods: "Moods",
	themes: "Themes",
	styles: "Styles",
}

type Words = Pick<TvDiscoverOption, "name" | "color" | "line">

/** The TV's six themes, by the app's key: the app's name and colour, and one line saying what the theme is. */
export const DISCOVER_THEMES: Record<string, Words> = {
	crime: {
		name: "Crime",
		color: "#c2413a",
		line: "Heists, cons and the people who chase them.",
	},
	mystery: {
		name: "Mystery",
		color: "#5b7fa8",
		line: "A puzzle to solve before the end.",
	},
	family: {
		name: "Family",
		color: "#8ccf4d",
		line: "Parents, siblings and what holds them together.",
	},
	growing: {
		name: "Growing up",
		color: "#7cc4e8",
		line: "Finding your way, at any age.",
	},
	future: {
		name: "Future",
		color: "#3fc1b0",
		line: "Tomorrow's worlds and machines.",
	},
	fantasy: {
		name: "Fantasy",
		color: "#d4508a",
		line: "Magic, spirits and other rules.",
	},
}

/** The TV's six styles, likewise. */
export const DISCOVER_STYLES: Record<string, Words> = {
	animated: {
		name: "Animated",
		color: "#e38fb8",
		line: "Drawn, painted or rendered.",
	},
	spectacle: {
		name: "Spectacle",
		color: "#e8793d",
		line: "Made for the biggest screen.",
	},
	slow: {
		name: "Slow burn",
		color: "#5b7fa8",
		line: "Takes its time, pays it back.",
	},
	fast: { name: "Fast-paced", color: "#c2413a", line: "No scene wasted." },
	talky: {
		name: "Talky",
		color: "#b98a5a",
		line: "The dialogue is the action.",
	},
	nonlinear: {
		name: "Nonlinear",
		color: "#8e62d6",
		line: "Time loops, folds and jumps.",
	},
}

/** An option of a tab by its key, or null for a key the TV has no words for. */
export function discoverOption(
	tab: TvDiscoverTab,
	key: string,
): TvDiscoverOption | null {
	const { kind } = discoverTab(tab)
	const item = `${kind}:${key}`
	if (kind === "mood") {
		const mood = MOOD_BY_KEY[key as MoodKey]
		if (!mood) return null
		return {
			item,
			key,
			name: mood.name,
			line: mood.description,
			color: mood.hue,
		}
	}
	const words = (kind === "theme" ? DISCOVER_THEMES : DISCOVER_STYLES)[key]
	return words ? { item, key, ...words } : null
}

/** A tab's six options, in the machine's order. */
export function discoverOptions(tab: TvDiscoverTab): TvDiscoverOption[] {
	return discoverTab(tab).keys.flatMap((key) => discoverOption(tab, key) ?? [])
}

/** The three tabs, in order, with their names. */
export const DISCOVER_TAB_KEYS: readonly {
	tab: TvDiscoverTab
	item: string
	name: string
}[] = DISCOVER_TABS.map(({ tab }) => ({
	tab,
	item: `tab:${tab}`,
	name: DISCOVER_TAB_NAME[tab],
}))

/**
 * The filter bar's query for one choice, as the Discover page writes it for that one filter: `moods=funny`,
 * `themes=crime`, `styles=slow`. Nothing else: the page's defaults (On my services, Not seen yet, For you) are the
 * server's for the same person, so the TV and the page get the same answer.
 */
export function discoverQuery(tab: TvDiscoverTab, key: string): string {
	return `${discoverTab(tab).param}=${encodeURIComponent(key)}`
}

/** The titles the list shows: the first four of Discover's results. */
export const listCards = (cards: readonly TitleCard[]) =>
	cards.slice(0, LIST_TITLES)

/**
 * A title's line of facts under its name: "2001 · Movie · 1h 56m · 82 score · 91% match · On Netflix". A fact
 * nobody knows is left out; a title that streams nowhere says so.
 */
export function listFacts(
	card: Pick<
		TitleCard,
		| "media_type"
		| "release_year"
		| "runtime"
		| "goodwatch_overall_score_normalized_percent"
		| "match"
		| "services"
	>,
): string {
	const score = card.goodwatch_overall_score_normalized_percent
	return [
		titleKicker(card),
		score == null ? null : `${Math.round(score)} score`,
		card.match == null ? null : `${card.match}% match`,
		// A card's services are the viewer's own first.
		whereLine(card, []),
	]
		.filter(Boolean)
		.join(" · ")
}

/** What the list says in the titles' place: while they are on their way, and when there are none. */
export const listEmptyLine = (waiting: boolean) =>
	waiting ? "Titles are on their way." : "Nothing fits."
