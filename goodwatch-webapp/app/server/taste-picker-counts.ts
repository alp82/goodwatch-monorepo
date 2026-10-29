// The taste picker's numbers for one list (#677): what each taste group carries, and each choice's counts, "For you",
// and "Narrow it". Pure, for watch-next-taste-picker.server.ts and its tests.
//
// - A word carries a group when at least 40% of the group's loved titles have it and it is at least 1.15 times as
//   common there as in everything the member loves. A group's colors are the mood, and the theme or style, it carries
//   most; its line lists the words it carries most, one per ground.
// - Picks combine by Discover's rule (domain/taste-picker.ts).
import { MOOD_KEYS, maskOfMoods } from "~/domain/moods"
import {
	MAX_PICKS,
	NEVER_APART,
	WORDS,
	WORD_BY_ID,
	type Word,
	type WordMasks,
	fitsPicks,
	groupNumber,
	hasWord,
	kindOf,
	sameGround,
} from "~/domain/taste-picker"
import type { TitleKey } from "~/utils/title-key"
import type { TitleSnapshot } from "./title-snapshot/index.server"

/** A word carries a group when at least this share of the group's loved titles has it... */
const CARRIES = 0.4
/** ...and it is this many times as common there as in everything the member loves. */
const LIFT = 1.15
/** The tiles under "For you". */
export const FOR_YOU = 8
/** The "Narrow it" suggestions after a pick. */
export const NARROW = 6
/** The words a group's line names. */
const MADE_OF = 3

/** A taste group as the picker shows it. */
export interface PickerGroup {
	/** "g1" for the largest. */
	id: string
	/** Its key in the URL ("movie-603"), which stays when the groups change order (groupKeyOf). */
	key: string
	/** Its trait name ("Dark, psychological thrillers"). */
	name: string
	/** One or two colors: the mood, then the theme or style, that most set it apart. */
	hues: string[]
	/** The words it carries most, one per ground, for its line. */
	madeOf: string[]
	/** Every word it carries, the one that most sets it apart first. */
	carries: string[]
}

/** A title's words, from the snapshot; null when it has no title analysis. */
export function masksOf(
	snapshot: TitleSnapshot,
	key: TitleKey,
): WordMasks | null {
	const row = snapshot.rowOf(key)
	const facts = row < 0 ? null : snapshot.facts(key)
	if (!facts) return null
	return {
		moods: maskOfMoods(facts.moods),
		themes: snapshot.columns.themes[row],
		styles: snapshot.columns.styles[row],
	}
}

/**
 * What each group carries, from its loved titles' words: the words by how much they set it apart, its colors, and the
 * words its line names. `loved` holds each group's loved titles, largest group first.
 */
export function describeGroups(
	loved: WordMasks[][],
): Omit<PickerGroup, "id" | "key" | "name">[] {
	const all = loved.flat()
	const share = (list: WordMasks[], word: Word) =>
		list.length ? list.filter((m) => hasWord(m, word)).length / list.length : 0
	return loved.map((list) => {
		const ranked = WORDS.filter((w) => !NEVER_APART.includes(w.id))
			.map((word) => {
				const here = share(list, word)
				return {
					word,
					lift: here >= CARRIES ? here / Math.max(0.01, share(all, word)) : 0,
				}
			})
			.filter((x) => x.lift >= LIFT)
			.sort((a, b) => b.lift - a.lift)
			.map((x) => x.word)
		const colors = carriedColorWords(ranked.map((w) => w.id))
		const madeOf: string[] = []
		for (const word of ranked)
			if (!madeOf.some((id) => sameGround(id, word.id))) madeOf.push(word.id)
		return {
			hues: colors.map((w) => w.hue),
			madeOf: madeOf.slice(0, MADE_OF),
			carries: ranked.map((w) => w.id),
		}
	})
}

/** The carried mood and theme/style used for a group's colors and Discover mix. */
export function carriedColorWords(carries: readonly string[]): Word[] {
	const ranked = carries.map((id) => WORD_BY_ID[id]).filter((word) => !!word)
	const mood = ranked.find((w) => w.kind === "mood")
	const other = ranked.find(
		(w) => w.kind !== "mood" && !(mood && sameGround(mood.id, w.id)),
	)
	return [mood, other].filter((w): w is Word => !!w)
}

/** A title on the list as the picker counts it. */
export interface PickerEntry {
	key: TitleKey
	masks: WordMasks | null
	/** Its taste group's number, or null. */
	group: number | null
}

/** Whether a title has one choice. */
export function hasChoice(entry: PickerEntry, id: string): boolean {
	const group = groupNumber(id)
	if (group !== null) return entry.group === group
	const word = WORD_BY_ID[id]
	return Boolean(word && entry.masks && hasWord(entry.masks, word))
}

/** A choice with its numbers on the member's list. */
export interface PickerChoice {
	id: string
	/** Titles with it. */
	count: number
	/** Titles the picks leave with it added; its own count when picked. */
	leaves: number
}

export interface PickerCounts {
	/** Titles with the picks. */
	fitting: number
	/** The taste groups, every mood, then the themes and styles the list holds (or that are picked). */
	choices: PickerChoice[]
	/** The tiles under "For you", in order. */
	forYou: string[]
	/** After a pick: choices of another kind that would leave fewer titles, groups first, then most left. */
	narrow: string[]
}

/**
 * The picker's numbers for one list: `counted` holds the titles the counts go by (the services choice applied), `picks`
 * the choice ids picked.
 */
export function pickerCounts(
	counted: readonly PickerEntry[],
	picks: readonly string[],
	groups: readonly Pick<PickerGroup, "id" | "carries">[],
): PickerCounts {
	const fits = (ids: readonly string[]) =>
		counted.filter((e) => fitsPicks(ids, (id) => hasChoice(e, id))).length
	const fitting = fits(picks)
	const ids = [...groups.map((g) => g.id), ...WORDS.map((w) => w.id)]
	const choices = ids
		.map((id) => {
			const count = counted.filter((e) => hasChoice(e, id)).length
			return {
				id,
				count,
				leaves: picks.includes(id) ? count : fits([...picks, id]),
			}
		})
		// The moods always show, as they always have (an empty list too); themes and styles when the list holds them.
		.filter(
			(c) =>
				kindOf(c.id) === "taste" ||
				kindOf(c.id) === "mood" ||
				c.count > 0 ||
				picks.includes(c.id),
		)
	const byId = new Map(choices.map((c) => [c.id, c]))

	// For you: every taste group (2 to 5; it is the only place they show), then the words the member's taste carries,
	// most of its titles in the groups that carry them first, then the moods with most titles.
	const inTaste = (id: string) =>
		counted.filter(
			(e) =>
				e.group !== null &&
				hasChoice(e, id) &&
				groups[e.group - 1]?.carries.includes(id),
		).length
	const carried = WORDS.map((w) => w.id)
		.filter((id) => groups.some((g) => g.carries.includes(id)))
		.map((id) => ({ id, n: inTaste(id) }))
		.filter((x) => x.n > 0)
		.sort((a, b) => b.n - a.n)
		.map((x) => x.id)
	const moods = MOOD_KEYS.map((m) => `m:${m}`).sort(
		(a, b) => (byId.get(b)?.count ?? 0) - (byId.get(a)?.count ?? 0),
	)
	const forYou = [
		...new Set([...groups.map((g) => g.id), ...carried, ...moods]),
	].slice(0, FOR_YOU)

	// Narrow it: only once something is picked and there is room for another pick.
	const pickedKinds = new Set(picks.map(kindOf))
	// One per ground: Crime & mystery, not also Crime and Mystery.
	const narrow: string[] = []
	if (picks.length && picks.length < MAX_PICKS)
		for (const c of choices
			.filter(
				(c) =>
					!picks.includes(c.id) &&
					!pickedKinds.has(kindOf(c.id)) &&
					!NEVER_APART.includes(c.id) &&
					!picks.some((p) => sameGround(p, c.id)) &&
					c.leaves > 0 &&
					c.leaves < fitting,
			)
			.sort(
				(a, b) =>
					Number(kindOf(b.id) === "taste") - Number(kindOf(a.id) === "taste") ||
					b.leaves - a.leaves,
			)) {
			if (narrow.length >= NARROW) break
			if (!narrow.some((id) => sameGround(id, c.id))) narrow.push(c.id)
		}
	return { fitting, choices, forYou, narrow }
}
