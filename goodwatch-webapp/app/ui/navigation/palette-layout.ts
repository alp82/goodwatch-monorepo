// How the command palette lays out what it found, as plain data: tabs for the rail, and in each tab the sections it
// shows with their options in keyboard order. CommandPalette.tsx draws it (palette-parts.tsx); only the active tab is
// ever drawn, so a tab that isn't shown costs nothing but this description.
//
// Typed text:
//   - one group: no rail, that group alone (titles as a grid of poster cards, everything else one column of rows)
//   - 2+ groups: a rail with All first, then each group with its count. All shows every group: under 5 groups one
//     column in the fixed order; 5 or more put Movies and Shows on top as rows of poster cards and the rest in two
//     balanced columns. A group's header row opens its tab; in its own tab the header opens its page on the site.
//   - nothing: the text, the Search action, moods and trending titles to start from.
// Before typing: For you (the member's taste tiles, or the For you page's call to action and trending), Trending,
// Moods, and Go to.
import type { ComponentType, SVGProps } from "react"
import type { Mood } from "~/domain/moods"
import type {
	PaletteItem,
	PaletteStart,
	PaletteTitle,
} from "~/utils/command-palette"
import { type PaletteGroupKey, paletteTitlePath } from "~/utils/command-palette"
import type { PalettePage } from "./palette-pages"

export type Icon = ComponentType<SVGProps<SVGSVGElement>>
export type PanelGroupKey = PaletteGroupKey | "pages"

/** One thing Up and Down can land on: a row, a poster card, a chip, a group's header, or a call to action. */
export interface Option {
	key: string
	label: string
	sub?: string
	href: string
	image?: PaletteItem["image"]
	/** A movie or show: drawn as its poster card. */
	title?: PaletteTitle
	icon?: Icon
	/** The group it came in, for its fallback picture. */
	group?: PanelGroupKey
	/** Runs in place of following `href` (see PalettePage). */
	action?: PalettePage["action"]
	/** A group's header in the All tab: shows that tab instead of following `href`. */
	opens?: string
}

export interface PanelGroup {
	key: PanelGroupKey
	label: string
	total: number
	estimated?: boolean
	items: Option[]
	/** The group's own page on the site, for its header in its own tab. */
	href?: string
}

/** A section's header row: its name, its count, and the option it is when it leads somewhere. */
export interface Head {
	label: string
	count?: string
	option?: Option
}

export type Section =
	| {
			kind: "cards"
			key: string
			head: Head
			items: Option[]
			cols: number
			wrap?: boolean
	  }
	| {
			kind: "rows"
			key: string
			head: Head
			items: Option[]
			big?: boolean
			split?: boolean
			compact?: boolean
	  }
	| { kind: "chips"; key: string; head: Head; items: Option[] }
	| { kind: "cta"; key: string; text: string; option: Option }
	| { kind: "nothing"; key: string; q: string; short: boolean }
	| { kind: "note"; key: string; text: string }

/** A tab's body: sections across the full width, then (5+ groups) two columns. */
export interface Layout {
	top: Section[]
	columns?: [Section[], Section[]]
}

export interface Tab {
	key: string
	label: string
	count?: string
	layout: Layout
}

/** What the panel shows: its tabs, and whether the rail (and so the wide panel) shows. */
export interface Plan {
	tabs: Tab[]
	rail: boolean
}

/** Every option of a layout, in the order Up and Down move through them: top, then the left column, then the right. */
export function layoutOptions(layout: Layout): Option[] {
	const sections = [...layout.top, ...(layout.columns?.flat() ?? [])]
	return sections.flatMap((section) => {
		switch (section.kind) {
			case "cards":
			case "rows":
			case "chips":
				return section.head.option
					? [section.head.option, ...section.items]
					: section.items
			case "cta":
				return [section.option]
			default:
				return []
		}
	})
}

// ---------------------------------------------------------------- groups

const isTitleGroup = (group: PanelGroup) =>
	group.key === "movies" || group.key === "shows"

/** "57", "~1,200": a group's count, never fewer than the items it has. */
export const countOf = (group: PanelGroup) =>
	`${group.estimated ? "~" : ""}${Math.max(group.total, group.items.length).toLocaleString("en-US")}`

/** Posters across in the All tab and in a title group's own tab. */
const CARDS_ACROSS = 6
/** Posters across when a title group is all there is (the panel stays narrow, without the rail). */
const CARDS_ACROSS_ALONE = 5
/** Rows each non-title group shows in the All tab. */
const ROWS_IN_ALL = 3

const tabHead = (group: PanelGroup): Head => ({
	label: group.label,
	count: countOf(group),
	option: {
		key: `head-${group.key}`,
		label: `Show every match in ${group.label}`,
		href: "",
		opens: group.key,
	},
})

/** In a group's own tab: the header opens its page on the site; without one it's the name and the count. */
const pageHead = (group: PanelGroup): Head => ({
	label: group.label,
	count: countOf(group),
	option: group.href
		? {
				key: `head-${group.key}`,
				label: `Open all ${group.label.toLowerCase()}`,
				href: group.href,
			}
		: undefined,
})

const isPeople = (group: PanelGroup) =>
	group.key === "people" || group.key === "members"

/** A group by itself: everything it has. */
function groupSection(
	group: PanelGroup,
	cols: number,
	peopleSplit: boolean,
): Section {
	const head = pageHead(group)
	if (isTitleGroup(group))
		return {
			kind: "cards",
			key: group.key,
			head,
			items: group.items,
			cols,
			wrap: true,
		}
	return {
		kind: "rows",
		key: group.key,
		head,
		items: group.items,
		big: isPeople(group),
		split: peopleSplit && isPeople(group),
		compact: group.key === "pages",
	}
}

/** A group in the All tab: a row of posters, or its first few rows. */
function allSection(group: PanelGroup): Section {
	const head = tabHead(group)
	if (isTitleGroup(group))
		return {
			kind: "cards",
			key: group.key,
			head,
			items: group.items.slice(0, CARDS_ACROSS),
			cols: CARDS_ACROSS,
		}
	return {
		kind: "rows",
		key: group.key,
		head,
		items: group.items.slice(0, ROWS_IN_ALL),
		compact: group.key === "pages",
	}
}

/** About how tall a section of rows is, to balance the two columns. */
const heightOf = (section: Section) =>
	36 + (section.kind === "rows" ? section.items.length * 52 : 0)

/** Two columns of about the same height: each section goes to the shorter one, in order. */
function balance(sections: Section[]): [Section[], Section[]] {
	const left: Section[] = []
	const right: Section[] = []
	let l = 0
	let r = 0
	for (const section of sections) {
		if (l <= r) {
			left.push(section)
			l += heightOf(section)
		} else {
			right.push(section)
			r += heightOf(section)
		}
	}
	return [left, right]
}

/** Five or more groups split into columns. */
const COLUMNS_FROM = 5

/** The panel for typed text that matched. `groups` are in the fixed order and not empty. */
export function resultsPlan(groups: PanelGroup[]): Plan {
	if (groups.length === 1)
		return {
			rail: false,
			tabs: [
				{
					key: "all",
					label: "All",
					layout: { top: [groupSection(groups[0], CARDS_ACROSS_ALONE, false)] },
				},
			],
		}
	const estimated = groups.some((group) => group.estimated)
	const total = groups.reduce(
		(sum, group) => sum + Math.max(group.total, group.items.length),
		0,
	)
	const all: Layout =
		groups.length < COLUMNS_FROM
			? { top: groups.map(allSection) }
			: {
					top: groups.filter(isTitleGroup).map(allSection),
					columns: balance(
						groups.filter((group) => !isTitleGroup(group)).map(allSection),
					),
				}
	return {
		rail: true,
		tabs: [
			{
				key: "all",
				label: "All",
				count: `${estimated ? "~" : ""}${total.toLocaleString("en-US")}`,
				layout: all,
			},
			...groups.map((group) => ({
				key: group.key,
				label: group.label,
				count: countOf(group),
				layout: { top: [groupSection(group, CARDS_ACROSS, true)] },
			})),
		],
	}
}

// ---------------------------------------------------------------- titles, moods

export const titleOption = (title: PaletteTitle): Option => ({
	key: `title-${title.mediaType}-${title.tmdbId}`,
	label: title.title,
	href: paletteTitlePath(title),
	title,
})

export const moodOption = (mood: Mood, withLine = true): Option => ({
	key: `mood-${mood.key}`,
	label: mood.name,
	sub: withLine ? mood.description : undefined,
	href: `/discover?moods=${mood.key}`,
	image: { kind: "hue", hue: mood.hue },
})

// ---------------------------------------------------------------- nothing matched

/** Typed text that found nothing (or is too short to look up): Search still works; moods and trending to start from. */
export function nothingPlan(
	q: string,
	short: boolean,
	moods: Option[],
	trending: Option[],
): Plan {
	const top: Section[] = [
		{ kind: "nothing", key: "nothing", q, short },
		{
			kind: "chips",
			key: "moods",
			head: { label: "Start from a mood" },
			items: moods,
		},
	]
	if (trending.length)
		top.push({
			kind: "cards",
			key: "trending",
			head: { label: "Trending now" },
			items: trending.slice(0, CARDS_ACROSS_ALONE),
			cols: CARDS_ACROSS_ALONE,
		})
	return { rail: false, tabs: [{ key: "all", label: "All", layout: { top } }] }
}

export const searchingPlan: Plan = {
	rail: false,
	tabs: [
		{
			key: "all",
			label: "All",
			layout: { top: [{ kind: "note", key: "searching", text: "Searching…" }] },
		},
	],
}

// ---------------------------------------------------------------- before typing

/** The For you tab: the member's taste tiles, or the page's call to action and the trending titles. */
function forYouLayout(
	start: PaletteStart | undefined,
	failed: boolean,
	trending: Option[],
): Layout {
	if (!start) {
		if (!failed)
			return {
				top: [{ kind: "note", key: "loading", text: "Loading your picks…" }],
			}
		return {
			top: [
				{
					kind: "cta",
					key: "cta",
					text: "Your picks didn't load.",
					option: {
						key: "for-you-cta",
						label: "Open For you",
						href: "/watch/for-you",
					},
				},
			],
		}
	}
	const { forYou } = start
	if (forYou.state === "picks" && forYou.tiles.length)
		return {
			top: forYou.tiles.map((tile, index) => ({
				kind: "cards",
				key: `tile-${index}`,
				head: {
					label: tile.label,
					option: {
						key: `tile-head-${index}`,
						label: `All of ${tile.label}`,
						href: tile.href,
					},
				},
				items: tile.titles.slice(0, CARDS_ACROSS).map(titleOption),
				cols: CARDS_ACROSS,
			})),
		}
	const top: Section[] = []
	if (forYou.state !== "picks")
		top.push({
			kind: "cta",
			key: "cta",
			text: forYou.message,
			option: {
				key: "for-you-cta",
				label: forYou.cta.label,
				href: forYou.cta.href,
			},
		})
	if (trending.length)
		top.push({
			kind: "cards",
			key: "trending",
			head: {
				label: "Trending now",
				count: String(trending.length),
				option: {
					key: "head-trending",
					label: "Show every trending title",
					href: "",
					opens: "trending",
				},
			},
			items: trending.slice(0, CARDS_ACROSS),
			cols: CARDS_ACROSS,
		})
	return { top }
}

/** Before typing: For you, Trending, Moods, Go to. */
export function startPlan(args: {
	start: PaletteStart | undefined
	failed: boolean
	trending: Option[]
	moods: Option[]
	pages: Option[]
}): Plan {
	const { start, failed, trending, moods, pages } = args
	const list = (
		key: string,
		label: string,
		items: Option[],
		compact = false,
	): Tab => ({
		key,
		label,
		count: String(items.length),
		layout: {
			top: [
				{
					kind: "rows",
					key,
					head: { label, count: String(items.length) },
					items,
					compact,
				},
			],
		},
	})
	const tabs: Tab[] = [
		{
			key: "for-you",
			label: "For you",
			layout: forYouLayout(start, failed, trending),
		},
	]
	if (trending.length)
		tabs.push({
			key: "trending",
			label: "Trending",
			count: String(trending.length),
			layout: {
				top: [
					{
						kind: "cards",
						key: "trending",
						head: { label: "Trending now", count: String(trending.length) },
						items: trending,
						cols: CARDS_ACROSS,
						wrap: true,
					},
				],
			},
		})
	tabs.push(list("moods", "Moods", moods), list("go", "Go to", pages, true))
	return { rail: true, tabs }
}
