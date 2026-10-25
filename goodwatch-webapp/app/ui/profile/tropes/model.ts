// The Tropes tab's pure rules: which titles the filters keep, how the tropes in them rank and sort, what each filter
// choice would leave, the band tiers, and the teaser line. The page re-runs these in the browser on every filter
// change; the owner's pool comes from loadProfileTropes. Spec: docs/implementation/taste-redesign.md, decision 3.
import { GENRE_COLOR } from "../../../domain/genre-colors.ts"
import type { ProfileTitle } from "../../../domain/profile.ts"
import {
	type PoolTitle,
	type TropePool,
	definingTop,
	leastTitles,
	lovedZ,
} from "../../../server/profile/tropes-model.ts"

export type Kind = "all" | "movie" | "show"
export type MinScore = "any" | "7" | "8" | "9"
export type SortKey = "loved" | "count" | "average"

export interface Facets {
	kind: Kind
	/** Indexes into the pool's genres. */
	genres: number[]
	/** Decade starts (1990 = the 1990s); EARLY stands for "Before 1970". */
	eras: number[]
	min: MinScore
	sort: SortKey
}

export const NO_FACETS: Facets = {
	kind: "all",
	genres: [],
	eras: [],
	min: "any",
	sort: "loved",
}

export const SORTS: { key: SortKey; label: string; hint: string }[] = [
	{
		key: "loved",
		label: "Loved most",
		hint: "Most titles scored 8 or more, for how often it shows up",
	},
	{ key: "count", label: "Most titles", hint: "Shows up in the most titles" },
	{ key: "average", label: "Highest average", hint: "The best average score" },
]
export const KINDS: { key: Kind; label: string }[] = [
	{ key: "all", label: "All" },
	{ key: "movie", label: "Movies" },
	{ key: "show", label: "Shows" },
]
export const MINS: { key: MinScore; label: string }[] = [
	{ key: "any", label: "Any score" },
	{ key: "7", label: "7+" },
	{ key: "8", label: "8+" },
	{ key: "9", label: "9+" },
]

export const EARLY = 1960
export const eraLabel = (era: number) =>
	era === EARLY ? "Before 1970" : `${era}s`
export const eraOf = (year: number) =>
	Math.max(EARLY, Math.floor(year / 10) * 10)

/** No hue of its own (type, era, score): the tiles' neutral wash. */
export const NO_HUE = "#6b7280"
export const genreHue = (name: string) => GENRE_COLOR[name] ?? NO_HUE

const round1 = (x: number) => Math.round(x * 10) / 10

/** Whether a title passes the filters; `skip` leaves one filter out, for the counts its own choices show. */
export function keeps(t: PoolTitle, f: Facets, skip?: keyof Facets) {
	return (
		(skip === "kind" ||
			f.kind === "all" ||
			t.m === (f.kind === "movie" ? 0 : 1)) &&
		(skip === "genres" ||
			!f.genres.length ||
			t.g.some((g) => f.genres.includes(g))) &&
		(skip === "eras" ||
			!f.eras.length ||
			(t.y != null && f.eras.includes(eraOf(t.y)))) &&
		(skip === "min" || f.min === "any" || t.s >= Number(f.min))
	)
}

export interface RankedTrope {
	name: string
	/** Titles in the filtered set that carry it. */
	count: number
	/** Of those, scored 8 or more. */
	loved: number
	/** How clearly it shows up more in what the member scores 8 or more. */
	z: number
	/** The member's average score on them. */
	average: number
	/** The defining title keys, up to 12. */
	top: string[]
	description: string | null
	/** The TV Tropes page; empty when unknown. */
	url: string
}

/**
 * The tropes in at least `leastTitles` of the filtered titles, by the binomial z-score of their 8+ share against the
 * filtered set's 8+ share; ties on loved count, then name. `usual` is the filtered set's average score.
 */
export function rankTropes(
	pool: Pick<TropePool, "tropes" | "descriptions" | "urls">,
	subset: PoolTitle[],
): { ranked: RankedTrope[]; usual: number } {
	const entries = new Map<number, { t: PoolTitle; d: number }[]>()
	for (const t of subset)
		t.r.forEach((r, i) => {
			const list = entries.get(r) ?? []
			if (!list.length) entries.set(r, list)
			list.push({ t, d: t.d[i] ?? 0 })
		})
	const least = leastTitles(subset.length)
	const rate =
		subset.filter((t) => t.s >= 8).length / Math.max(1, subset.length)
	const ranked: RankedTrope[] = []
	for (const [r, list] of entries) {
		if (list.length < least) continue
		const name = pool.tropes[r]
		if (name === undefined) continue
		const loved = list.filter((e) => e.t.s >= 8).length
		ranked.push({
			name,
			count: list.length,
			loved,
			z: lovedZ(loved, list.length, rate),
			average: round1(list.reduce((a, e) => a + e.t.s, 0) / list.length),
			top: definingTop(list),
			description: pool.descriptions[name] ?? null,
			url: pool.urls[name] ?? "",
		})
	}
	ranked.sort(
		(a, b) => b.z - a.z || b.loved - a.loved || a.name.localeCompare(b.name),
	)
	const usual = subset.length
		? round1(subset.reduce((a, t) => a + t.s, 0) / subset.length)
		: 0
	return { ranked, usual }
}

/** Loved most keeps the rank; the other sorts reorder it, with the name as the last tie-break. */
export function sortTropes(ranked: RankedTrope[], sort: SortKey) {
	if (sort === "loved") return ranked
	const by =
		sort === "count"
			? (a: RankedTrope, b: RankedTrope) =>
					b.count - a.count || b.loved - a.loved
			: (a: RankedTrope, b: RankedTrope) =>
					b.average - a.average || b.count - a.count
	return [...ranked].sort((a, b) => by(a, b) || a.name.localeCompare(b.name))
}

/** How many titles a choice leaves with the other filters applied, and its picture: its best-scored title's backdrop. */
export function choiceStats(
	pool: PoolTitle[],
	titles: Record<string, Pick<ProfileTitle, "backdrop">>,
	f: Facets,
	skip: keyof Facets,
	test: (t: PoolTitle) => boolean,
) {
	let count = 0
	let best: PoolTitle | null = null
	for (const t of pool) {
		if (!keeps(t, f, skip) || !test(t)) continue
		count++
		if (titles[t.k]?.backdrop && (!best || t.s > best.s)) best = t
	}
	return {
		count,
		picture: best ? (titles[best.k]?.backdrop ?? null) : null,
	}
}

/** The decades the pool's titles come from, oldest first. */
export function erasOf(pool: PoolTitle[]) {
	const all = new Set<number>()
	for (const t of pool) if (t.y != null) all.add(eraOf(t.y))
	return [...all].sort((a, b) => a - b)
}

/** How many defining titles an open band shows. */
export const DEFINING = 12

export type Tier = "hero" | "medium" | "compact"
/** Ranks 1-3 hero, 4-10 medium, the rest compact. */
export const tierOf = (index: number): Tier =>
	index < 3 ? "hero" : index < 10 ? "medium" : "compact"

/** A description's first sentence, for a closed band's line. */
export const teaser = (text: string | null | undefined) =>
	text ? (text.match(/^[^.!?]+[.!?]+["')\]]*/)?.[0] ?? text) : null

/** Classes that keep a trope name's words whole. Put `lang="en"` on the same element for the hyphens. */
export const WHOLE_WORDS =
	"[overflow-wrap:normal] [word-break:normal] hyphens-auto text-balance"

/** The longest word, without the punctuation that hugs it ("Punctuated!", "\"Psycho\""). */
export const longestWord = (name: string) =>
	Math.max(
		...name
			.split(/\s+/)
			.map((w) => w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "").length),
	)

/**
 * A trope name's size for a hero or a medium band, stepped down from its longest word (about 0.62 em per character in
 * the black weight) so a word never breaks, and one more step for very long names. No measuring in the browser.
 */
export function nameSize(name: string, slot: "hero" | "big") {
	const word = longestWord(name)
	const long = name.length
	if (slot === "hero")
		return word > 16 || long > 40
			? "text-3xl sm:text-4xl"
			: word > 12
				? "text-4xl sm:text-5xl"
				: "text-4xl sm:text-6xl"
	return word > 15 || long > 34
		? "text-lg sm:text-xl"
		: word > 12 || long > 26
			? "text-xl sm:text-2xl"
			: "text-2xl sm:text-[26px]"
}

/** The page description: "The tropes @handle loves most: A, B and C." Null without ranked tropes. */
export function tropesLine(
	handle: string,
	data: Pick<TropePool, "tropes" | "descriptions" | "urls" | "pool">,
) {
	const names = rankTropes(data, data.pool)
		.ranked.slice(0, 3)
		.map((t) => t.name)
	if (!names.length) return undefined
	const list =
		names.length > 1
			? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`
			: names[0]
	return `The tropes @${handle} loves most: ${list}.`
}
