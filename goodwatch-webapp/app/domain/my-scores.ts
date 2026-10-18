// Your scores (My library): every title a member has scored, in one table to change them in. The filters, the
// sort and the grouping are worked out here, in the browser, over the member's whole list: the largest list on the
// site held about 1,000 scores in October 2026. Pure; the page keeps the state.
import type { MediaKey } from "~/types/user-data"
import type { PresentedMedia } from "~/utils/media-presentation"

/** A title in the member's language when the page presents it so (`presentation`, `canonical_title`). */
export interface ScoredTitle extends PresentedMedia {
	key: MediaKey
	mediaType: "movie" | "show"
	tmdbId: number
	title: string
	poster_path: string | null
	release_year: number | null
	genres: string[]
	/** The GoodWatch score, 0 to 100; null when the title has none. */
	gw: number | null
	score: number
	/** When the score was given or last changed (ISO). */
	ratedAt: string | null
	/** The latest dated watch (ISO); null without one. */
	watchedAt: string | null
}

/** Scores changed in one request of /api/update-scores-batch; the page sends a larger selection in several. */
export const SCORE_BATCH_MAX = 50

// ---------------------------------------------------------------------------------------------------------
// Filters

/** Your score against the GoodWatch score, on your 1-10 scale: 1.5 apart or more is a difference. */
export type Versus = "more" | "close" | "less"
const APART = 1.5

export const gapOf = (title: Pick<ScoredTitle, "gw">, score: number) =>
	title.gw == null ? null : score - title.gw / 10
export const versusOf = (title: Pick<ScoredTitle, "gw">, score: number): Versus | null => {
	const gap = gapOf(title, score)
	if (gap === null) return null
	return gap >= APART ? "more" : gap <= -APART ? "less" : "close"
}
export const decadeOf = (title: Pick<ScoredTitle, "release_year">) =>
	title.release_year ? Math.floor(title.release_year / 10) * 10 : 0
const ratedYearOf = (title: Pick<ScoredTitle, "ratedAt">) => title.ratedAt?.slice(0, 4) ?? ""

export const MIN_GOODWATCH = [60, 70, 80] as const
export type MinGoodwatch = 0 | (typeof MIN_GOODWATCH)[number]

export interface ScoreFilters {
	q: string
	scores: number[]
	kind: "all" | "movie" | "show"
	/** Any of them. */
	genres: string[]
	minGw: MinGoodwatch
	decades: number[]
	versus: Versus[]
	/** Years the score was given in. */
	rated: string[]
	/** Only the titles rescored since the page opened. */
	changedOnly: boolean
}
export const NO_FILTERS: ScoreFilters = {
	q: "",
	scores: [],
	kind: "all",
	genres: [],
	minGw: 0,
	decades: [],
	versus: [],
	rated: [],
	changedOnly: false,
}

/** The filters of the side sheet, each one group there. Search and Only what I changed are on the row. */
export type FilterGroup = "scores" | "kind" | "versus" | "genres" | "minGw" | "decades" | "rated"

// Lower case and without accents, so "elite" finds "Élite"; a leading article doesn't count for the order.
const fold = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim()
const sortName = (title: string) => fold(title).replace(/^(the|an|a) (?=\S)/, "")

/** How a title stands now: its score, and whether it was rescored on this page. */
export interface Standing {
	score: number
	changed: boolean
}

/** Whether a title passes the filters. `skip` leaves one group out, for that group's option counts. */
export function passes(title: ScoredTitle, f: ScoreFilters, now: Standing, skip?: FilterGroup): boolean {
	return (
		(skip === "scores" || !f.scores.length || f.scores.includes(now.score)) &&
		(skip === "kind" || f.kind === "all" || title.mediaType === f.kind) &&
		(skip === "genres" || !f.genres.length || f.genres.some((g) => title.genres.includes(g))) &&
		(skip === "minGw" || !f.minGw || (title.gw ?? 0) >= f.minGw) &&
		(skip === "decades" || !f.decades.length || f.decades.includes(decadeOf(title))) &&
		(skip === "versus" || !f.versus.length || f.versus.includes(versusOf(title, now.score) as Versus)) &&
		(skip === "rated" || !f.rated.length || f.rated.includes(ratedYearOf(title))) &&
		(!f.changedOnly || now.changed) &&
		(!f.q.trim() || fold(title.title).includes(fold(f.q)))
	)
}

/** What each option of each group would leave: the other groups applied, the option on its own. */
export function optionCounts(
	titles: readonly ScoredTitle[],
	f: ScoreFilters,
	standingOf: (title: ScoredTitle) => Standing,
): Record<FilterGroup, Map<string, number>> {
	const keysOf: Record<FilterGroup, (t: ScoredTitle, s: Standing) => (string | number | null)[]> = {
		scores: (_, s) => [s.score],
		kind: (t) => [t.mediaType],
		versus: (t, s) => [versusOf(t, s.score)],
		genres: (t) => t.genres,
		minGw: (t) => MIN_GOODWATCH.filter((min) => (t.gw ?? 0) >= min),
		decades: (t) => [decadeOf(t) || null],
		rated: (t) => [ratedYearOf(t) || null],
	}
	const out = {} as Record<FilterGroup, Map<string, number>>
	for (const group of Object.keys(keysOf) as FilterGroup[]) {
		const counts = new Map<string, number>()
		for (const title of titles) {
			const standing = standingOf(title)
			if (!passes(title, f, standing, group)) continue
			for (const key of keysOf[group](title, standing))
				if (key != null) counts.set(String(key), (counts.get(String(key)) ?? 0) + 1)
		}
		out[group] = counts
	}
	return out
}

/** How many filters of the sheet are on; the Filters button shows it. */
export const activeFilterCount = (f: ScoreFilters) =>
	f.scores.length +
	(f.kind === "all" ? 0 : 1) +
	f.versus.length +
	f.genres.length +
	(f.minGw ? 1 : 0) +
	f.decades.length +
	f.rated.length

// ---------------------------------------------------------------------------------------------------------
// Sort and groups

export type ScoreSort = "title" | "year" | "kind" | "gw" | "gap" | "score" | "rated"
export type Direction = "asc" | "desc"
/** The direction a column sorts in on its first press. */
export const FIRST_DIRECTION: Record<ScoreSort, Direction> = {
	title: "asc",
	year: "desc",
	kind: "asc",
	gw: "desc",
	gap: "desc",
	score: "desc",
	rated: "desc",
}
/** A press on the column sorted by turns the order around; another column starts in its first direction. */
export const nextSort = (current: { by: ScoreSort; dir: Direction }, by: ScoreSort) =>
	current.by === by
		? { by, dir: current.dir === "asc" ? ("desc" as const) : ("asc" as const) }
		: { by, dir: FIRST_DIRECTION[by] }

export type ScoreGrouping = "none" | "score" | "versus" | "genre" | "decade" | "kind" | "rated"

export interface ScoreGroup {
	key: string
	/** Empty without grouping. */
	label: string
	titles: ScoredTitle[]
}

const VERSUS_GROUP: Record<Versus, [order: number, label: string]> = {
	more: [0, "You like it more than GoodWatch"],
	close: [1, "About the same as GoodWatch"],
	less: [2, "You like it less than GoodWatch"],
}

/**
 * The titles that pass the filters, sorted, in groups. `scoreOf` is the score a row sits by: the page keeps a
 * rescored row in place until the view changes, so it passes the score from the last change of view.
 */
export function arrange(
	titles: readonly ScoredTitle[],
	f: ScoreFilters,
	sort: { by: ScoreSort; dir: Direction },
	grouping: ScoreGrouping,
	standingOf: (title: ScoredTitle) => Standing,
	scoreLabel: (score: number) => string = String,
): ScoreGroup[] {
	const list = titles.filter((t) => passes(t, f, standingOf(t)))
	const scoreOf = (t: ScoredTitle) => standingOf(t).score
	const sortValue: Record<ScoreSort, (t: ScoredTitle) => number | string> = {
		title: (t) => sortName(t.title),
		year: (t) => t.release_year ?? 0,
		kind: (t) => t.mediaType,
		gw: (t) => t.gw ?? -1,
		gap: (t) => gapOf(t, scoreOf(t)) ?? -99,
		score: scoreOf,
		rated: (t) => t.ratedAt ?? "",
	}
	const value = sortValue[sort.by]
	const sign = sort.dir === "asc" ? 1 : -1
	const names = new Map(list.map((t) => [t.key, sortName(t.title)]))
	list.sort((a, b) => {
		const [x, y] = [value(a), value(b)]
		const order = typeof x === "string" ? x.localeCompare(y as string, "en") : x - (y as number)
		return (
			order * sign ||
			(names.get(a.key) as string).localeCompare(names.get(b.key) as string, "en") ||
			(a.key < b.key ? -1 : 1)
		)
	})
	if (grouping === "none") return [{ key: "all", label: "", titles: list }]

	const groups = new Map<string, ScoreGroup & { order: number }>()
	const add = (key: string, label: string, order: number, title: ScoredTitle) => {
		let group = groups.get(key)
		if (!group) {
			group = { key, label, order, titles: [] }
			groups.set(key, group)
		}
		group.titles.push(title)
	}
	for (const t of list) {
		const score = scoreOf(t)
		if (grouping === "score") add(String(score), `${score} · ${scoreLabel(score)}`, -score, t)
		else if (grouping === "decade") {
			const decade = decadeOf(t)
			add(String(decade), decade ? `${decade}s` : "Year unknown", -decade, t)
		} else if (grouping === "kind")
			add(t.mediaType, t.mediaType === "movie" ? "Movies" : "Shows", t.mediaType === "movie" ? 0 : 1, t)
		else if (grouping === "rated") {
			const year = Number(ratedYearOf(t) || 0)
			add(String(year), year ? `Rated in ${year}` : "Date unknown", -year, t)
		} else if (grouping === "genre") {
			// A title sits under its first genre, or under a picked genre it has.
			const genre = f.genres.find((g) => t.genres.includes(g)) ?? t.genres[0] ?? "No genre"
			add(genre, genre, 0, t)
		} else {
			const versus = versusOf(t, score)
			if (versus) add(versus, VERSUS_GROUP[versus][1], VERSUS_GROUP[versus][0], t)
			else add("none", "No GoodWatch score", 3, t)
		}
	}
	return [...groups.values()]
		.sort((a, b) =>
			grouping === "genre"
				? b.titles.length - a.titles.length || a.label.localeCompare(b.label, "en")
				: a.order - b.order,
		)
		.map(({ order: _, ...group }) => group)
}

/** How many titles have each score, 1 to 10. */
export function scoreSpread(scores: Iterable<number>): number[] {
	const spread = Array.from({ length: 10 }, () => 0)
	for (const score of scores) if (score >= 1 && score <= 10) spread[score - 1] += 1
	return spread
}
