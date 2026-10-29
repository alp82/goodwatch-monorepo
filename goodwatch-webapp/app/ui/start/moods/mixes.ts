// The start page's mixes: a few of the taste picker's own words (moods, themes, styles) that go well together, named
// like a taste group ("Dark, gritty crime"). A guest has no taste groups, so the mixes take their place in My movies'
// picker (docs/implementation/start-page-redesign.md, "Mood picker").
//
// A mix is its parts. The picks are words only, up to three; a mix is on while all its parts are picked, however they
// got there. Only one mix is on at a time: when two would be (Funny, Feel-good and Romance hold two), the one whose
// parts were all picked first wins. Pure, so the rules are tested without React (mixes.test.ts).
import { MAX_PICKS, WORD_BY_ID, groupNumber } from "~/domain/taste-picker"

export interface Mix {
	/** The picker's group id ("g1"...): the picker draws a mix as it draws a taste group. */
	id: string
	name: string
	/** Word ids ("m:crime", "t:fantasy", "s:slow"); the first one lights the room. */
	parts: readonly string[]
}

export const MIXES: readonly Mix[] = [
	{ id: "g1", name: "Warm, easy comedies", parts: ["m:funny", "m:feelgood"] },
	{
		id: "g2",
		name: "Dark, gritty crime",
		parts: ["m:crime", "m:scary", "s:graphic"],
	},
	{
		id: "g3",
		name: "Eerie, mind-bending stories",
		parts: ["m:mind", "m:scary"],
	},
	{ id: "g4", name: "Funny love stories", parts: ["m:romance", "m:funny"] },
	{
		id: "g5",
		name: "Smart, high-stakes action",
		parts: ["m:action", "m:mind", "s:fast"],
	},
	{
		id: "g6",
		name: "Warm coming-of-age stories",
		parts: ["m:growing", "m:feelgood"],
	},
	{
		id: "g7",
		name: "Moving period dramas",
		parts: ["m:history", "m:heavy", "s:slow"],
	},
	{
		id: "g8",
		name: "Dark fantasy epics",
		parts: ["t:fantasy", "m:heavy", "s:spectacle"],
	},
]

const MIX_BY_ID: ReadonlyMap<string, Mix> = new Map(MIXES.map((m) => [m.id, m]))

export const mixOf = (id: string): Mix | null => MIX_BY_ID.get(id) ?? null

export const isMix = (id: string) =>
	groupNumber(id) !== null && MIX_BY_ID.has(id)

/** The words a pick on show stands for: a mix's parts, or the word itself. */
export const wordsOf = (id: string): readonly string[] =>
	MIX_BY_ID.get(id)?.parts ?? [id]

/** The mix that is on: all its parts picked; of two, the one whose parts were all picked first. */
export function activeMix(picks: readonly string[]): Mix | null {
	let best: Mix | null = null
	let bestAt = Number.POSITIVE_INFINITY
	for (const mix of MIXES) {
		if (!mix.parts.every((p) => picks.includes(p))) continue
		const at = Math.max(...mix.parts.map((p) => picks.indexOf(p)))
		if (at < bestAt) {
			best = mix
			bestAt = at
		}
	}
	return best
}

/** The picks as the chips show them: the mix that is on (by its id), then the other words. */
export function displayPicks(picks: readonly string[]): string[] {
	const mix = activeMix(picks)
	return mix
		? [mix.id, ...picks.filter((p) => !mix.parts.includes(p))]
		: [...picks]
}

/** The word that lights the room: the first pick on show's first word (a mix leads with its first part). */
export function leadWord(picks: readonly string[]): string | null {
	const first = displayPicks(picks)[0]
	return first ? (wordsOf(first)[0] ?? null) : null
}

/**
 * A tap on a mix. The mix that is on comes off by its parts and the tapped one's parts go in first; the other words
 * stay while they fit in three (the latest ones stay). Tapping the mix that is on takes its parts off and keeps the
 * other words. A mix is never refused.
 */
export function pickMix(picks: readonly string[], id: string): string[] {
	const mix = MIX_BY_ID.get(id)
	if (!mix) return [...picks]
	const on = activeMix(picks)
	const others = picks.filter(
		(p) => !on?.parts.includes(p) && !mix.parts.includes(p),
	)
	if (on?.id === id) return others
	const room = MAX_PICKS - mix.parts.length
	return [...mix.parts, ...(room > 0 ? others.slice(-room) : [])]
}

/**
 * A tap on a tile or a chip's ×. A mix goes through pickMix; a word is picked or unpicked, and a fourth word is refused
 * (the picks stay as they are). Unticking a mix's part turns the mix off and keeps the rest.
 */
export function tapPick(
	picks: readonly string[],
	id: string,
): { picks: string[]; refused: boolean } {
	if (isMix(id)) return { picks: pickMix(picks, id), refused: false }
	if (!WORD_BY_ID[id]) return { picks: [...picks], refused: false }
	if (picks.includes(id))
		return { picks: picks.filter((p) => p !== id), refused: false }
	if (picks.length >= MAX_PICKS) return { picks: [...picks], refused: true }
	return { picks: [...picks, id], refused: false }
}

/** A pick's name: the mix's or the word's. */
export const pickLabel = (id: string) =>
	MIX_BY_ID.get(id)?.name ?? WORD_BY_ID[id]?.name ?? id

/** The picks in one line, as the chips show them ("Warm, easy comedies · Animated"). */
export const picksLine = (picks: readonly string[]) =>
	displayPicks(picks).map(pickLabel).join(" · ")

/** A mix's line: its parts by name ("Crime & mystery · Scary · Graphic"). */
export const mixLine = (id: string) =>
	(MIX_BY_ID.get(id)?.parts ?? [])
		.map((w) => WORD_BY_ID[w]?.name ?? w)
		.join(" · ")
