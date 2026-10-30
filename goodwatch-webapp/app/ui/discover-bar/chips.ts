// The search state as removable chips, in the order the status line and the panel footer show them: the query,
// steering (More like, Less like, Like), people, On my services and the picked services, Not seen yet, You's choices,
// every other filter, then popularity, budget and show choices. Pure, no React.
//
// activeChips has no chip for On my services or Not seen yet (they are defaults, and Clear all keeps them); here they
// get one each, so they stay removable one at a time.
import type { FilterName, FilterState } from "~/domain/filter-state"
import { MOOD_BY_KEY, type MoodKey } from "~/domain/moods"
import type { ActiveChip, FilterNames } from "~/ui/filter-bar/labels"
import { type SubTabId, subTabOfGroup } from "./tabs"

/** Recoveries show while the list holds at most this many titles. */
export const RECOVERY_LIST_MAX = 40
/** A search ranks at most this many titles. */

export type BarChipKind = "query" | "steer" | "person" | "filter"

export interface BarChip {
	key: string
	kind: BarChipKind
	/** The group the chip belongs to (its accent); the query has none. */
	group: FilterName | null
	/** Words before the label in a quieter tone ("More like", "with"). */
	prefix?: string
	label: string
	/** A small picture: a poster for steering chips, a face for people. */
	image?: string | null
	/** A mood's hue, for mood chips. */
	hue?: string
	/** The sub-tab the chip opens. */
	opens: SubTabId | null
	/** The state without this choice; the query chip has none (it clears the search). */
	remove?: (state: FilterState) => FilterState
}

const STEER_WORDS = {
	loved: "More like",
	disliked: "Less like",
	similarTo: "Like",
} as const
type SteerGroup = keyof typeof STEER_WORDS
const STEER_ORDER: readonly SteerGroup[] = ["loved", "disliked", "similarTo"]

/** Places in the order; lower first. Groups not listed are "every other filter". */
const RANK: Partial<Record<string, number>> = {
	loved: 1,
	disliked: 1,
	similarTo: 1,
	people: 2,
	services: 3,
	notSeenYet: 5,
	wishlist: 5,
	minMatch: 5,
	tasteGroups: 5,
	popularity: 7,
	budget: 7,
	shows: 7,
}
const OTHER = 6

const rankOf = (chip: BarChip) =>
	chip.kind === "query"
		? 0
		: chip.key === "not-seen-yet"
			? 4
			: (RANK[chip.group ?? ""] ?? OTHER)

/** The title key or person id at the end of a chip key ("loved-123"), or null for a grouped chip. */
const idOf = (key: string) => {
	const match = key.match(/-(\d+)$/)
	return match ? Number(match[1]) : null
}

function steerChip(chip: ActiveChip, names: FilterNames): BarChip {
	const group = chip.group as SteerGroup
	const id = idOf(chip.key)
	const many = id === null ? (chip.preview?.length ?? 0) : 0
	return {
		key: chip.key,
		kind: "steer",
		group: chip.group,
		prefix: STEER_WORDS[group],
		label: id === null ? `${many} titles` : (names.title?.(id) ?? "a title"),
		image: id === null ? null : (names.poster?.(id) ?? null),
		opens: subTabOfGroup(chip.group),
		remove: chip.remove,
	}
}

/**
 * Every chip of the search state, in order. `chips` is activeChips of the state as it applies; `query` is the running
 * search, or null. `faces` names the people's pictures.
 */
export function barChips(
	state: FilterState,
	chips: readonly ActiveChip[],
	{
		query,
		names = {},
		face,
	}: {
		query: string | null
		names?: FilterNames
		face?: (id: number) => string | null | undefined
	},
): BarChip[] {
	const out: BarChip[] = []
	const text = query?.trim()
	if (text)
		out.push({
			key: "query",
			kind: "query",
			group: null,
			label: text,
			opens: "titles",
		})
	if (state.onMyServices)
		out.push({
			key: "on-my-services",
			kind: "filter",
			group: "services",
			label: "On my services",
			opens: "services",
			remove: (s) => ({
				...s,
				onMyServices: false,
				anyService: undefined,
				services: undefined,
			}),
		})
	if (state.notSeenYet)
		out.push({
			key: "not-seen-yet",
			kind: "filter",
			group: "notSeenYet",
			label: "Not seen yet",
			opens: "taste",
			remove: (s) => ({ ...s, notSeenYet: false }),
		})
	for (const chip of chips) {
		if ((STEER_ORDER as readonly string[]).includes(chip.group)) {
			out.push(steerChip(chip, names))
			continue
		}
		if (chip.group === "people") {
			const id = idOf(chip.key)
			out.push({
				key: chip.key,
				kind: "person",
				group: "people",
				prefix: "with",
				label: chip.label,
				image: id === null ? null : (face?.(id) ?? null),
				opens: "people",
				remove: chip.remove,
			})
			continue
		}
		const mood = chip.key.startsWith("mood-")
			? MOOD_BY_KEY[chip.key.slice(5) as MoodKey]
			: undefined
		out.push({
			key: chip.key,
			kind: "filter",
			group: chip.group,
			label: chip.label.replace(/^Produced in /, "Made in "),
			hue: mood?.hue,
			opens: subTabOfGroup(chip.group),
			remove: chip.remove,
		})
	}
	// A stable sort keeps activeChips' own order inside each place; steering follows More like, Less like, Like.
	const steer = (chip: BarChip) =>
		chip.kind === "steer" ? STEER_ORDER.indexOf(chip.group as SteerGroup) : 0
	return out
		.map((chip, index) => ({ chip, index }))
		.sort(
			(a, b) =>
				rankOf(a.chip) - rankOf(b.chip) ||
				steer(a.chip) - steer(b.chip) ||
				a.index - b.index,
		)
		.map(({ chip }) => chip)
}

/** What the count says: "Counting…", "N titles", "N matches", or "About N matches" for a full search. */
export function countWords(
	total: number | null | undefined,
	searching: boolean,
	estimate = false,
): { n: number | null; words: string; about: boolean } {
	if (total == null) return { n: null, words: "Counting…", about: false }
	if (searching && estimate && total > 0)
		return {
			n:
				total < 100
					? total
					: Math.round(total / (total < 1000 ? 10 : 100)) *
						(total < 1000 ? 10 : 100),
			words: total === 1 ? "match" : "matches",
			about: true,
		}
	const one = total === 1
	return {
		n: total,
		words: searching ? (one ? "match" : "matches") : one ? "title" : "titles",
		about: false,
	}
}

/** The one-tap recoveries the footer offers: the biggest `max`, only while the list holds 40 titles or fewer. */
export function footerRecoveries<T extends { titles: number }>(
	total: number | null | undefined,
	recoveries: readonly T[] | undefined,
	max: number,
): T[] {
	if (total == null || total > RECOVERY_LIST_MAX || !recoveries?.length)
		return []
	return [...recoveries].sort((a, b) => b.titles - a.titles).slice(0, max)
}
