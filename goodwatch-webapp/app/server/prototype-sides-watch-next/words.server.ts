import type {
	Badge,
	Place,
	SwnWords,
} from "~/ui/prototype-sides-watch-next/model"
import {
	type Masks,
	WORDS,
	WORD_BY_ID,
	type Word,
	hasWord,
	sameGround,
} from "~/ui/prototype-sides-watch-next/words"
// PROTOTYPE - throwaway (#659, rounds 4 and 5). The filters' moods, themes, and styles next to the member's taste
// groups: which words a group carries, the two that color it, how the picks combine, and where "Fits your taste" and
// "Close to your taste" go. Pure: index.server.ts hands in the list and the groups.
//
// Round 5 picks by Discover's rule: any within a kind (mood, theme, style, or taste group), every kind picked. With
// moods only, that is today's Watch next rule; a theme or a group next to a mood narrows it.
import type { TitleKey } from "~/utils/title-key"

/** A word carries a group when at least this share of the group's loved titles has it... */
const CARRIES = 0.4
/** ...and this many times the share of the member's other loved titles: what sets the group apart. */
const LIFT = 1.15
export const MAX_PICKS = 3
/** Styles in most of what anyone loves (Music in 42 to 100% of every group): they never set a group apart. */
const NEVER_APART = ["s:music", "s:talky"]

interface Entry {
	key: TitleKey
	onServices: boolean | null
}

export interface WordsInput {
	entries: Entry[]
	onMyServices: boolean
	masksOf: (key: TitleKey) => Masks | null
	groupOf: (key: TitleKey) => string | null
	placeOf: (key: TitleKey) => Place
	/** The groups by id (g1...), with the loved titles each holds. */
	groups: { id: string; loved: TitleKey[] }[]
	picks: string[]
}

export interface WordsModel {
	view: Omit<SwnWords, "words"> & {
		words: Omit<SwnWords["words"][number], "backdrop">[]
	}
	/** The title has the picks; "relaxed" lets a picked group take titles close to it too. */
	hit: (key: TitleKey, relaxed?: boolean) => boolean
	/** The picked groups: the badges go by them. */
	focus: string[]
	/** A group is picked, so titles close to your taste follow the fits. */
	narrows: boolean
	/** How far up a fitting title goes (higher first; personal order keeps the rest). Round 5 keeps the order. */
	lift: (key: TitleKey) => number
}

export function wordsModel(i: WordsInput): WordsModel {
	const ids = new Set(i.groups.map((g) => g.id))
	const masks = new Map(i.entries.map((e) => [e.key, i.masksOf(e.key)]))
	const has = (key: TitleKey, w: Word) => {
		const m = masks.get(key)
		return !!m && hasWord(m, w)
	}

	// ---- what each group's loved titles say in words ----
	const lovedMasks = new Map(
		i.groups.map((g) => [g.id, g.loved.flatMap((k) => i.masksOf(k) ?? [])]),
	)
	const allLoved = [...lovedMasks.values()].flat()
	const shareIn = (list: Masks[], w: Word) =>
		list.length ? list.filter((m) => hasWord(m, w)).length / list.length : 0
	const lift = (id: string, w: Word) => {
		const share = shareIn(lovedMasks.get(id) ?? [], w)
		return share >= CARRIES ? share / Math.max(0.01, shareIn(allLoved, w)) : 0
	}
	const carries: SwnWords["carries"] = {}
	const blend: SwnWords["blend"] = {}
	for (const g of i.groups) {
		const ranked = WORDS.filter((w) => !NEVER_APART.includes(w.id))
			.map((w) => ({ w, lift: lift(g.id, w) }))
			.filter((x) => x.lift >= LIFT)
			.sort((a, b) => b.lift - a.lift)
			.map((x) => x.w)
		carries[g.id] = ranked.map((w) => w.id)
		// Its colors: the mood that most sets it apart, then the theme or style that most does (not the same ground).
		const mood = ranked.find((w) => w.kind === "mood")
		const other = ranked.find(
			(w) => w.kind !== "mood" && !(mood && sameGround(mood.id, w.id)),
		)
		blend[g.id] = [mood, other].filter((w): w is Word => !!w).map((w) => w.hue)
	}
	const carried = new Map<string, string[]>(
		WORDS.map((w) => [
			w.id,
			i.groups.filter((g) => carries[g.id].includes(w.id)).map((g) => g.id),
		]),
	)

	const counted = i.entries.filter(
		(e) => !i.onMyServices || e.onServices !== false,
	)

	// ---- the picks ----
	const isGroup = (id: string) => ids.has(id)
	const picks = [
		...new Set(i.picks.filter((p) => isGroup(p) || WORD_BY_ID[p])),
	].slice(0, MAX_PICKS)
	const match = (key: TitleKey, pick: string, relaxed: boolean) => {
		if (isGroup(pick)) {
			if (i.groupOf(key) === pick) return true
			return relaxed && i.placeOf(key)?.id === pick
		}
		return has(key, WORD_BY_ID[pick])
	}
	// Discover's rule: any within a kind, every kind picked (a group is a kind of its own).
	const combineHit = (list: string[], key: TitleKey, relaxed: boolean) => {
		const kinds = new Map<string, string[]>()
		for (const p of list) {
			const kind = isGroup(p) ? "group" : WORD_BY_ID[p].kind
			kinds.set(kind, [...(kinds.get(kind) ?? []), p])
		}
		return [...kinds.values()].every((ps) =>
			ps.some((p) => match(key, p, relaxed)),
		)
	}
	const hit = (key: TitleKey, relaxed = false) =>
		combineHit(picks, key, relaxed)

	// ---- whose taste ----
	const focus = picks.filter(isGroup)
	const badges: Record<string, Badge> = {}
	for (const e of i.entries) {
		const place = i.placeOf(e.key)
		if (place && focus.includes(place.id))
			badges[e.key] = place.how === "in" ? "fits" : "close"
	}

	// ---- the words as the list holds them ----
	const leavesWith = (extra: string) =>
		counted.filter((e) => combineHit([...picks, extra], e.key, false)).length
	const words = WORDS.map((w) => {
		const count = counted.filter((e) => has(e.key, w)).length
		const groups = (carried.get(w.id) ?? []).filter((g) =>
			counted.some((e) => has(e.key, w) && i.groupOf(e.key) === g),
		)
		return {
			id: w.id,
			count,
			leaves: picks.includes(w.id) ? count : leavesWith(w.id),
			groups,
			inTaste: counted.filter(
				(e) => has(e.key, w) && groups.includes(i.groupOf(e.key) ?? ""),
			).length,
		}
	}).filter((w) => w.count > 0)
	const groupLeaves = Object.fromEntries(
		i.groups.map((g) => [
			g.id,
			picks.includes(g.id)
				? counted.filter((e) => i.groupOf(e.key) === g.id).length
				: leavesWith(g.id),
		]),
	)

	return {
		view: {
			picks,
			words,
			carries,
			blend,
			groupLeaves,
			fitting: counted.filter((e) => hit(e.key)).length,
			badges,
		},
		hit,
		focus,
		narrows: focus.length > 0,
		lift: () => 0,
	}
}
