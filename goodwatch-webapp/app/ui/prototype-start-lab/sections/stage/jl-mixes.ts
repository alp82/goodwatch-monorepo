// PROTOTYPE (start page lab, round 15): the guest's mood picker data for stages l and m. My movies' taste picker
// (watch-next/TasteShelf) with curated mixes in place of a member's taste groups: each mix is a few of the picker's own
// words (moods, themes, styles) that go well together, named like a taste group ("Dark, gritty crime").
//
// LAB STAND-IN: the fixtures hold titles per mood and per captured prompt only. A theme or style answers with the list of
// the mood (or prompt) closest to it (STAND_IN), a mix merges its parts' lists, and the counts are those lists' sizes.
// The site would count and rank the catalog by Discover's rule (any within a kind, every kind picked).
import type { MoodKey } from "~/domain/moods"
import { MAX_PICKS, WORD_BY_ID, WORDS, groupNumber } from "~/domain/taste-picker"
import type { WatchNextPicker } from "~/server/watch-next.server"
import type { FixtureAnswer } from "../../lab/fixture-search"
import type { LabCard, LabData } from "../../lab/types"

export type Mix = {
	/** The picker's group id ("g1"…): a mix counts as one pick, as a taste group does. */
	id: string
	name: string
	/** The picker's word ids ("m:crime", "t:true", "s:slow"), the one that drives the room's light first. */
	parts: string[]
}

/** Round 15: eight mixes, none of them saying what a search preset says (no mystery, space, animation or "funny weird"). */
export const MIXES: Mix[] = [
	{ id: "g1", name: "Warm, easy comedies", parts: ["m:funny", "m:feelgood"] },
	{ id: "g2", name: "Dark, gritty crime", parts: ["m:crime", "m:scary", "s:graphic"] },
	{ id: "g3", name: "Eerie, mind-bending stories", parts: ["m:mind", "m:scary"] },
	{ id: "g4", name: "Funny love stories", parts: ["m:romance", "m:funny"] },
	{ id: "g5", name: "Smart, high-stakes action", parts: ["m:action", "m:mind", "s:fast"] },
	{ id: "g6", name: "Warm coming-of-age stories", parts: ["m:growing", "m:feelgood"] },
	{ id: "g7", name: "Moving period dramas", parts: ["m:history", "m:heavy", "s:slow"] },
	{ id: "g8", name: "Dark fantasy epics", parts: ["t:fantasy", "m:heavy", "s:spectacle"] },
]

/** How many mixes the stage itself shows (l's row); the picker shows all. */
export const STAGE_MIXES = 6

const MIX_BY_ID = new Map(MIXES.map((m) => [m.id, m]))

/** LAB STAND-IN: the list each theme and style answers with: a mood's, or a captured prompt's. */
const STAND_IN: Record<string, MoodKey | { prompt: string }> = {
	"t:crime": "crime",
	"t:mystery": "crime",
	"t:war": "history",
	"t:politics": "crime",
	"t:true": "history",
	"t:history": "history",
	"t:family": "feelgood",
	"t:mind": "mind",
	"t:showbiz": "funny",
	"t:sports": "action",
	"t:money": "crime",
	"t:future": "worlds",
	"t:fantasy": "worlds",
	"s:animated": { prompt: "an animated movie adults will love" },
	"s:documentary": "history",
	"s:spectacle": "action",
	"s:stylized": "mind",
	"s:music": "growing",
	"s:slow": "heavy",
	"s:fast": "action",
	"s:talky": "funny",
	"s:nonlinear": "mind",
	"s:graphic": "scary",
}

/** A word's fixture list (a mood's own, or its stand-in's) and the key that says which list it is. */
function wordList(data: LabData, id: string): { src: string; titles: LabCard[] } {
	const word = WORD_BY_ID[id]
	const via = word?.kind === "mood" ? (word.key as MoodKey) : STAND_IN[id]
	if (!via) return { src: id, titles: [] }
	if (typeof via === "string") return { src: `m:${via}`, titles: data.guest.moods.find((m) => m.key === via)?.titles ?? [] }
	return { src: `p:${via.prompt}`, titles: data.guest.prompts.find((p) => p.q === via.prompt)?.titles ?? [] }
}

/** The words a pick stands for: a mix's parts, or the word itself. */
const wordsOf = (id: string) => MIX_BY_ID.get(id)?.parts ?? [id]

/**
 * LAB STAND-IN for the site's ranking of picks: every distinct fixture list the picks reach, merged. Titles on more
 * of the lists come first, then the higher each one ranks on its best list, so the mix's common ground leads.
 */
export function mergedTitles(data: LabData, ids: string[]): LabCard[] {
	const lists = new Map<string, LabCard[]>()
	for (const id of ids)
		for (const w of wordsOf(id)) {
			const l = wordList(data, w)
			if (l.titles.length && !lists.has(l.src)) lists.set(l.src, l.titles)
		}
	const tally = new Map<number, { card: LabCard; n: number; rank: number }>()
	for (const titles of lists.values())
		titles.forEach((card, i) => {
			const e = tally.get(card.key)
			if (e) {
				e.n += 1
				e.rank = Math.min(e.rank, i)
			} else tally.set(card.key, { card, n: 1, rank: i })
		})
	return [...tally.values()].sort((a, b) => b.n - a.n || a.rank - b.rank).map((e) => e.card)
}

/** A pick's name: the mix's or the word's. */
export const pickLabel = (id: string) => MIX_BY_ID.get(id)?.name ?? WORD_BY_ID[id]?.name ?? id

/** The stage vocabulary's id (hi-vocab) for the picks' first word: what the room's light reads. */
export function leadVocab(ids: string[]): string | null {
	const first = ids[0] ? wordsOf(ids[0])[0] : null
	if (!first) return null
	const [kind, key] = first.split(":")
	return `${kind === "m" ? "mood" : kind === "t" ? "theme" : "style"}:${key}`
}

/** What the picks answer with (the merged lists), shaped like a mood answer so the module shows it as one. */
export function mixAnswer(data: LabData, ids: string[]): FixtureAnswer {
	const name = ids.map(pickLabel).join(" + ")
	return { q: name, answeredAs: name, kind: "mood", reading: null, titles: mergedTitles(data, ids) }
}

const hueOf = (id: string) => WORD_BY_ID[id]?.hue ?? "#6b7280"

/**
 * The picker's data in My movies' shape (WatchNextPicker), so its own pieces (PickChip, MoodButton, choiceHues,
 * pickName) render it unchanged: the mixes as groups (two colors: their first two parts), every word with its fixture
 * count, and a backdrop per tile that no earlier tile uses.
 */
export function guestPicker(data: LabData, picks: string[]): WatchNextPicker {
	const used = new Set<number>()
	const pictureOf = (titles: LabCard[]) => {
		const card = titles.find((t) => t.backdrop_path && !used.has(t.key)) ?? titles.find((t) => t.backdrop_path)
		if (card) used.add(card.key)
		return card?.backdrop_path ?? null
	}
	const choices: WatchNextPicker["choices"] = []
	for (const m of MIXES) {
		const titles = mergedTitles(data, [m.id])
		choices.push({ id: m.id, count: titles.length, leaves: titles.length, picture: pictureOf(titles) })
	}
	for (const w of WORDS) {
		const titles = wordList(data, w.id).titles
		choices.push({ id: w.id, count: titles.length, leaves: titles.length, picture: pictureOf(titles) })
	}
	return {
		picks,
		fitting: picks.length ? mergedTitles(data, picks).length : 0,
		groups: MIXES.map((m, i) => ({
			id: m.id,
			key: `mix-${i + 1}`,
			name: m.name,
			hues: [...new Set(m.parts.slice(0, 2).map(hueOf))],
			madeOf: m.parts,
		})),
		choices,
		forYou: MIXES.map((m) => m.id),
		narrow: [],
	}
}

/** Picks or unpicks a choice; a fourth is refused (the caller shows My movies' hint). */
export function togglePick(picks: string[], id: string): { picks: string[]; refused: boolean } {
	if (picks.includes(id)) return { picks: picks.filter((p) => p !== id), refused: false }
	if (picks.length >= MAX_PICKS) return { picks, refused: true }
	return { picks: [...picks, id], refused: false }
}

export const isMix = (id: string) => groupNumber(id) !== null

/** A mix's line: its parts by name ("Crime & mystery · Scary · Graphic"). */
export const mixLine = (id: string) => (MIX_BY_ID.get(id)?.parts ?? []).map((w) => WORD_BY_ID[w]?.name).join(" · ")
