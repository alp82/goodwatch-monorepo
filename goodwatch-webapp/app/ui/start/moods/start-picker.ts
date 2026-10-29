// The start page mood picker's data and placement, apart from React (start-picker.test.ts): the picker in My movies'
// shape (the mixes stand where taste groups do), the tiles' guest lines, and where the panel goes.
import { MAX_PICKS, WORDS, WORD_BY_ID } from "~/domain/taste-picker"
import type { WatchNextPicker } from "~/server/watch-next.server"
import type { ShelfLines } from "~/ui/watch-next/TasteShelf"
import { MIXES, activeMix, isMix, mixLine } from "./mixes"
import { type CountScope, type MoodCounts, countText } from "./mood-counts"

export const PANEL_LINE = "Mix moods, themes, and styles."
const MIX_HEADING = {
	title: "Start with a mix",
	note: "One at a time. Its moods, themes, and styles show below.",
}

/** The picker's data in My movies' shape, so its pieces render it as they are: the mixes stand where taste groups do. */
export function startPicker(
	picks: readonly string[],
	counts: MoodCounts | null,
	pictures: Record<string, string>,
): WatchNextPicker {
	const choice = (id: string) => {
		const count = counts?.byWord[id] ?? 0
		return { id, count, leaves: count, picture: pictures[id] ?? null }
	}
	return {
		picks: [...picks],
		fitting: counts?.total ?? 0,
		groups: MIXES.map((mix) => ({
			id: mix.id,
			key: mix.id,
			name: mix.name,
			hues: [...new Set(mix.parts.slice(0, 2).map((p) => WORD_BY_ID[p].hue))],
			madeOf: [...mix.parts],
		})),
		choices: [
			...MIXES.map((m) => choice(m.id)),
			...WORDS.map((w) => choice(w.id)),
		],
		forYou: MIXES.map((m) => m.id),
		narrow: [],
	}
}

/**
 * The tiles' lines: a mix says its parts and is never dimmed or refused; a word says its description (moods) and how
 * many titles it leaves picked (an unpicked word: with it; a picked one: what is on show), and is dimmed at three.
 */
export function startShelfLines(
	picks: readonly string[],
	counts: MoodCounts | null,
	scope: CountScope,
): ShelfLines {
	const mix = activeMix(picks)
	return {
		first: MIX_HEADING,
		lines: (id) => {
			if (isMix(id))
				return { on: mix?.id === id, full: false, line: mixLine(id), tap: null }
			const on = picks.includes(id)
			const n = on ? counts?.total : counts?.byWord[id]
			return {
				on,
				full: !on && picks.length >= MAX_PICKS,
				line: WORD_BY_ID[id]?.description ?? null,
				tap: n === undefined ? null : countText(n, scope),
			}
		},
	}
}

/** The space kept under the panel, above the window's bottom or the phone's dock. */
const BELOW = 16
/** The least the panel shows before the page scrolls it up, and where it then opens from the top. */
const MIN_PANEL = 360
const TOP = 72
const MAX_WIDTH = 980

export type PanelBox = {
	/** In the page (it scrolls with the page). */
	top: number
	left: number
	width: number
	maxHeight: number
	/** How far the page scrolls first (0 for none, below 0 to bring a row above TOP back down). */
	scrollBy: number
	/** Where its top is in the window once that scroll is done: its height counts from there. */
	viewTop: number
}

const across = (column: { left: number; width: number }) => {
	const width = Math.min(MAX_WIDTH, column.width)
	return { left: column.left + (column.width - width) / 2, width }
}

const heightFrom = (viewTop: number, bottom: number) =>
	Math.max(200, Math.floor(bottom - BELOW - viewTop))

/**
 * Where the panel goes, from the page as it is now: under the row (8 px), as wide as the column (MAX_WIDTH at most),
 * down to BELOW above `bottom` (the window's bottom, or the dock's top). With less than MIN_PANEL there, the page
 * scrolls the panel up to TOP, as far as the page can scroll (`room`); a row above TOP scrolls back down to it.
 *
 * On open, and again on each resize (a rotation, the phone's bars, the visual viewport): the row may have moved in the
 * window since, so nothing of the last box is kept. A resize during the open's smooth scroll measures the row where it
 * is: with too little room there the page scrolls the rest of the way to TOP, otherwise the panel ends above the
 * bottom from where it is (shorter than it could be once the scroll ends, never behind the dock).
 */
export function panelBox({
	row,
	column,
	bottom,
	scrollY,
	room,
}: {
	row: { bottom: number }
	column: { left: number; width: number }
	bottom: number
	scrollY: number
	room: number
}): PanelBox {
	const at = row.bottom + 8
	const limit = bottom - BELOW
	// A row above TOP (a rotation can leave it out of sight) scrolls back down to TOP, as far as the page's top allows.
	const by =
		at < TOP
			? Math.max(at - TOP, -scrollY)
			: limit - at < Math.min(MIN_PANEL, limit - TOP)
				? Math.min(at - TOP, room)
				: 0
	return {
		top: at + scrollY,
		...across(column),
		maxHeight: heightFrom(at - by, bottom),
		scrollBy: by,
		viewTop: at - by,
	}
}
