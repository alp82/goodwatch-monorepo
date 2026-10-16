import type {
	Badge,
	Combine,
	Place,
	SwnWords,
	VariantKey,
} from "~/ui/prototype-sides-watch-next/model"
import {
	type Masks,
	WORDS,
	WORD_BY_ID,
	type Word,
	hasWord,
	sameGround,
} from "~/ui/prototype-sides-watch-next/words"
// PROTOTYPE - throwaway (#659, round 4). The filters' moods, themes, and styles next to the member's taste groups:
// which words a group carries, each group's preset, how the picks combine, where "Fits your taste" and "Close to your
// taste" go, and what brings titles up. Pure: index.server.ts hands in the list and the groups.
import type { TitleKey } from "~/utils/title-key"

/** A word carries a group when at least this share of the group's loved titles has it... */
const CARRIES = 0.4
/** ...and this many times the share of the member's other loved titles: what sets the group apart. */
const LIFT = 1.15
export const MAX_PICKS = 3

interface Entry {
	key: TitleKey
	onServices: boolean | null
}

export interface WordsInput {
	variant: VariantKey
	combine: Combine
	entries: Entry[]
	onMyServices: boolean
	masksOf: (key: TitleKey) => Masks | null
	groupOf: (key: TitleKey) => string | null
	placeOf: (key: TitleKey) => Place
	/** The groups by id (g1...), with the loved titles each holds. */
	groups: { id: string; loved: TitleKey[] }[]
	picks: string[]
	wide: string[]
	boost: string[]
	from: string | null
}

export interface WordsModel {
	view: Omit<SwnWords, "words"> & {
		words: Omit<SwnWords["words"][number], "backdrop">[]
	}
	/** The title has the picks, as the variant combines them; "relaxed" lets your taste go (a group: close to it too). */
	hit: (key: TitleKey, relaxed?: boolean) => boolean
	/** The groups your taste narrows to tonight, or those the badges and order go by. */
	focus: string[]
	/** Your taste narrows tonight: a group is picked, or a picked word is taken in your taste. */
	narrows: boolean
	/** How far up a fitting title goes (higher first; personal order keeps the rest). */
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
	const carried = new Map<string, string[]>(
		WORDS.map((w) => [
			w.id,
			i.groups.filter((g) => lift(g.id, w) >= LIFT).map((g) => g.id),
		]),
	)

	const counted = i.entries.filter(
		(e) => !i.onMyServices || e.onServices !== false,
	)
	// Each group's preset: the mood that most sets it apart, and the theme or style that most does.
	const presets: SwnWords["presets"] = {}
	for (const g of i.groups) {
		const best = (kinds: Word["kind"][], next?: string) =>
			WORDS.filter(
				(w) => kinds.includes(w.kind) && !(next && sameGround(next, w.id)),
			)
				.map((w) => ({ w, lift: lift(g.id, w) }))
				.filter((x) => x.lift >= LIFT)
				.sort((a, b) => b.lift - a.lift)[0]?.w.id
		const mood = best(["mood"])
		const words = [mood, best(["theme", "style"], mood)].filter(
			(x): x is string => !!x,
		)
		const fits = counted.filter((e) =>
			words.every((id) => has(e.key, WORD_BY_ID[id])),
		)
		presets[g.id] = {
			words,
			count: words.length ? fits.length : 0,
			inGroup: fits.filter((e) => i.groupOf(e.key) === g.id).length,
		}
	}

	// ---- the picks ----
	const isGroup = (id: string) => ids.has(id)
	const picks = [
		...new Set(i.picks.filter((p) => isGroup(p) || WORD_BY_ID[p])),
	].slice(0, MAX_PICKS)
	const wide = i.wide.filter((w) => picks.includes(w))
	const inTasteWord = (id: string) =>
		i.variant === "insideall" && (carried.get(id)?.length ?? 0) > 0
	const narrowedWord = (id: string) => inTasteWord(id) && !wide.includes(id)
	const match = (key: TitleKey, pick: string, relaxed: boolean) => {
		if (isGroup(pick)) {
			if (i.groupOf(key) === pick) return true
			return relaxed && i.placeOf(key)?.id === pick
		}
		const w = WORD_BY_ID[pick]
		if (!has(key, w)) return false
		if (relaxed || !narrowedWord(pick)) return true
		return (carried.get(pick) ?? []).includes(i.groupOf(key) ?? "")
	}
	const combineHit = (list: string[], key: TitleKey, relaxed: boolean) => {
		if (!list.length) return true
		if (i.combine === "any") return list.some((p) => match(key, p, relaxed))
		if (i.combine === "all") return list.every((p) => match(key, p, relaxed))
		// Discover's rule: any within a kind, every kind picked (a group is a kind of its own).
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
	const pickedGroups = picks.filter(isGroup)
	const narrowedWords = picks.filter(narrowedWord)
	const from =
		i.variant === "presets" &&
		i.from &&
		ids.has(i.from) &&
		presets[i.from].words.length > 0 &&
		presets[i.from].words.every((w) => picks.includes(w))
			? i.from
			: null
	const focus =
		i.variant === "presets"
			? from
				? [from]
				: []
			: i.variant === "sorts"
				? [...ids]
				: i.variant === "yours"
					? [
							...new Set(
								picks.flatMap((p) =>
									isGroup(p) ? [] : (carried.get(p) ?? []),
								),
							),
						]
					: i.variant === "insideall"
						? [...new Set(narrowedWords.flatMap((p) => carried.get(p) ?? []))]
						: pickedGroups
	const narrows = pickedGroups.length > 0 || narrowedWords.length > 0
	const badges: Record<string, Badge> = {}
	for (const e of i.entries) {
		const place = i.placeOf(e.key)
		if (place && focus.includes(place.id))
			badges[e.key] = place.how === "in" ? "fits" : "close"
	}
	const boost =
		i.variant === "refine" ? i.boost.filter((b) => WORD_BY_ID[b]) : []
	const liftOf = (key: TitleKey) => {
		if (boost.length) return boost.some((b) => has(key, WORD_BY_ID[b])) ? 1 : 0
		if (i.variant === "sorts")
			return badges[key] === "fits" ? 2 : badges[key] === "close" ? 1 : 0
		return 0
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
	const fittingNow = counted.filter((e) => hit(e.key))
	const boostCounts = Object.fromEntries(
		WORDS.map((w) => [w.id, fittingNow.filter((e) => has(e.key, w)).length]),
	)

	return {
		view: {
			combine: i.combine,
			picks,
			wide,
			boost,
			from,
			words,
			presets,
			groupLeaves,
			boostCounts,
			badges,
		},
		hit,
		focus,
		narrows,
		lift: liftOf,
	}
}
