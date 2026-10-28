// Quick list, the rating flow's second mode on /taste/quiz (`?mode=quick`): a table of titles the person hasn't
// answered, 20 rows at a time, each answered in place with the score keys or one of the two marks. This file is its
// pure state, so the tests run it as it is; `use-quick-list.ts` binds it to the person's answers and the saves.
//
// Rules (owner, October 28, 2026, from the approved prototype):
// - The rows are the person's unanswered titles from the rating flow's own source, best known first (the source's
//   order, unlabeled), or a search of the whole catalog, where titles the person answered before show that answer.
// - 20 rows show. A row answered stays, dimmed with its answer, until another row is answered: then it slides out and
//   the next title takes a place at the bottom. Only the latest answered rows stay.
// - Undo takes back the latest change and brings back the rows it sent away, in their places, one step at a time.
// - Pressing the chosen score again clears it (a change Undo takes back too).
// - Title and Year sort the rows: first press one way, second press the other, third press back to the source order.
import type { FilterGroup, ScoreFilters, ScoredTitle } from "../../domain/my-scores.ts"
import { passes } from "../../domain/my-scores.ts"
import type { MediaKey } from "../../types/user-data.ts"
import type { ScoringMedia } from "../scoring/types.ts"
import { type ExcludeItem, excludeIdsFor } from "../taste/answered.ts"

/** Rows shown at a time. */
export const ROWS = 20

/** How long a row takes to slide out before the rows close up (QuickTable's row transition). */
export const LEAVE_MS = 300

/** The filters of the side sheet that fit titles nobody has scored yet. */
export const FILTER_GROUPS: readonly FilterGroup[] = ["kind", "genres", "decades"]

// ---------------------------------------------------------------------------------------------------------
// Titles

/** A row's title: the scores table's title shape (so its filters apply), what the larger row shows, and what saves need. */
export interface QuickTitle extends ScoredTitle {
	synopsis: string
	/** Genres, then the title analysis' essence tags: the row's second line. */
	tags: string[]
	/** The title as the saves take it. */
	media: ScoringMedia
}

// TMDB's movie and show genres differ; one name per idea, so a genre filter finds both.
const GENRE: Record<string, string[]> = {
	"Sci-Fi & Fantasy": ["Science Fiction", "Fantasy"],
	"Action & Adventure": ["Action", "Adventure"],
	"War & Politics": ["War"],
}
export const genresOf = (list: readonly string[] = []) => [...new Set(list.flatMap((g) => GENRE[g] ?? [g]))]

const yearOf = (y: unknown) => {
	const n = Number(y)
	return Number.isFinite(n) && n > 0 ? n : null
}

/** A title of the rating flow's source (smart titles). */
export function fromScoring(t: ScoringMedia): QuickTitle {
	const genres = genresOf(t.genres)
	return {
		...(t.canonical_title !== undefined ? { canonical_title: t.canonical_title } : {}),
		...(t.presentation ? { presentation: t.presentation } : {}),
		key: `${t.media_type}-${t.tmdb_id}` as MediaKey,
		mediaType: t.media_type,
		tmdbId: t.tmdb_id,
		title: t.title,
		poster_path: t.poster_path || null,
		release_year: yearOf(t.release_year),
		genres,
		gw: null,
		score: 0,
		ratedAt: null,
		watchedAt: null,
		synopsis: t.synopsis ?? "",
		tags: [...genres.slice(0, 2), ...(t.essence_tags ?? []).slice(0, 3)],
		media: t,
	}
}

/** A row of the combined search (ui/search/search-model.tsx, `Row`), as far as Quick list reads it. */
export interface SearchRowLike {
	key: string
	title: string
	type: string
	year?: string | null
	poster?: string | null
	discovery?: { genres?: string[] | null } | null
}

/** A title of a search answer; null for a row that is no movie or show. */
export function fromSearchRow(r: SearchRowLike): QuickTitle | null {
	const [type, id] = r.key.split(":")
	const tmdbId = Number(id)
	if ((type !== "movie" && type !== "show") || !Number.isSafeInteger(tmdbId) || tmdbId < 1) return null
	const year = yearOf(r.year)
	return fromScoring({
		tmdb_id: tmdbId,
		media_type: type,
		title: r.title,
		poster_path: r.poster ?? "",
		...(year ? { release_year: String(year) } : {}),
		genres: r.discovery?.genres ?? [],
	})
}

/** Each title once, the first place kept. */
export function uniqueTitles(titles: Iterable<QuickTitle>): QuickTitle[] {
	const seen = new Set<string>()
	const out: QuickTitle[] = []
	for (const t of titles) {
		if (seen.has(t.key)) continue
		seen.add(t.key)
		out.push(t)
	}
	return out
}

// ---------------------------------------------------------------------------------------------------------
// Answers

/** An answer as the rating flow gives it: a score, Haven't seen it, Haven't seen it with Want to See, Not interested. */
export type QuickAnswer =
	| { type: "score"; score: number }
	| { type: "skip" }
	| { type: "plan" }
	| { type: "not-interested" }

export const sameAnswer = (a: QuickAnswer | null, b: QuickAnswer | null) =>
	a === b ||
	(!!a && !!b && a.type === b.type && (a.type !== "score" || (b.type === "score" && a.score === b.score)))

/** The person's marks, as the account (or a guest's browser, in the same shape) holds them. */
export interface HeldMarks {
	scores?: Record<string, { score: number } | undefined>
	skipped?: Record<string, unknown>
	wishlist?: Record<string, unknown>
	notInterested?: Record<string, unknown>
}

/**
 * The answer the person's marks hold for a title: the score first; then Want to See (a guest's browser keeps it
 * alone, a member's account with Haven't seen it), Not interested, Haven't seen it. Null without one.
 */
export function heldAnswer(data: HeldMarks | null | undefined, key: string): QuickAnswer | null {
	if (!data) return null
	const score = data.scores?.[key]?.score
	if (score) return { type: "score", score }
	if (data.wishlist?.[key]) return { type: "plan" }
	if (data.notInterested?.[key]) return { type: "not-interested" }
	if (data.skipped?.[key]) return { type: "skip" }
	return null
}

/** One title's change: what it held before and after (null: no answer). */
export interface Change {
	key: string
	before: QuickAnswer | null
	after: QuickAnswer | null
}

/** A change Undo can take back, with the rows as they were before it. */
export interface Step {
	id: number
	items: Change[]
	/** The rows before the change, the ones already on their way out left out. */
	shown: string[]
	latest: string[]
	/** The list the rows came from (a new search, filter or order starts a new one). */
	list: number
}

export interface QuickState {
	/** This visit's answers, over the person's marks: null where one was taken back here. */
	answers: Record<string, QuickAnswer | null>
	/** The rows in order, those sliding out among them. */
	shown: string[]
	/** Rows sliding out. */
	leaving: string[]
	/** Rows the latest change answered: they stay, dimmed, until the next answer. */
	latest: string[]
	/** Rows Undo just brought back (they come in as they left). */
	back: string[]
	/**
	 * Rows that slid out of this list after their answer: they don't take a place in it again. A new list (another
	 * search, filters, order, or the search cleared) starts with none, so a search shows an answer given here.
	 */
	gone: string[]
	/** What Undo takes back, the latest first. */
	steps: Step[]
	list: number
}

export const INITIAL_QUICK: QuickState = {
	answers: {},
	shown: [],
	leaving: [],
	latest: [],
	back: [],
	gone: [],
	steps: [],
	list: 0,
}

/** How many changes Undo can take back. */
export const UNDO_DEPTH = 50

export type QuickAction =
	/** A new list (search, filters, order): its first rows, in order. */
	| { type: "rows"; fill: readonly string[] }
	/** Titles that may take a free place, in order: the rows fill up to ROWS. */
	| { type: "fill"; fill: readonly string[] }
	/**
	 * Rows go and the rows fill up again: rows done sliding out (`left`: only those still on their way out, so a row
	 * Undo brought back stays), or rows no longer wanted.
	 */
	| { type: "settle"; keys: readonly string[]; fill: readonly string[]; left?: boolean }
	/** Answers given (or a score cleared: `after` null) to rows shown. */
	| { type: "answer"; id: number; items: readonly Change[] }
	/** A save of the change `step` gave `key` failed: its answer is the person's marks again, and Undo skips it. */
	| { type: "failed"; step: number; key: string }
	/** Undo's save for `key` failed: its answer is the person's marks again. */
	| { type: "forget"; key: string }
	| { type: "undo" }

const fillUp = (shown: readonly string[], fill: readonly string[]) => {
	const out = [...shown]
	const have = new Set(out)
	for (const key of fill) {
		if (out.length >= ROWS) break
		if (have.has(key)) continue
		have.add(key)
		out.push(key)
	}
	return out
}

export function quickList(state: QuickState, action: QuickAction): QuickState {
	switch (action.type) {
		case "rows":
			return {
				...state,
				shown: fillUp([], action.fill),
				leaving: [],
				latest: [],
				back: [],
				gone: [],
				list: state.list + 1,
			}
		case "fill": {
			if (state.shown.length >= ROWS) return state
			const shown = fillUp(state.shown, action.fill)
			return shown.length === state.shown.length ? state : { ...state, shown }
		}
		case "settle": {
			const gone = new Set(action.left ? action.keys.filter((k) => state.leaving.includes(k)) : action.keys)
			if (!gone.size && state.shown.length >= ROWS) return state
			const dismissed = new Set([...state.gone, ...(action.left ? gone : [])])
			const shown = fillUp(
				state.shown.filter((k) => !gone.has(k)),
				action.fill.filter((k) => !dismissed.has(k)),
			)
			return {
				...state,
				shown,
				gone: action.left ? [...dismissed] : state.gone,
				leaving: state.leaving.filter((k) => !gone.has(k)),
				latest: state.latest.filter((k) => !gone.has(k)),
				back: state.back.filter((k) => !gone.has(k)),
			}
		}
		case "answer": {
			const items = action.items.filter((i) => !sameAnswer(i.before, i.after))
			if (!items.length) return state
			const keys = new Set(items.map((i) => i.key))
			const answers = { ...state.answers }
			for (const i of items) answers[i.key] = i.after
			const cleared = items.every((i) => i.after == null)
			// The rows the last answer kept go now; a cleared score sends nothing away.
			const leaving = new Set(state.leaving)
			const going = cleared ? [] : state.latest.filter((k) => !keys.has(k) && !leaving.has(k))
			const step: Step = {
				id: action.id,
				items,
				shown: state.shown.filter((k) => !leaving.has(k)),
				latest: state.latest,
				list: state.list,
			}
			return {
				...state,
				answers,
				leaving: [...state.leaving, ...going],
				latest: cleared
					? state.latest.filter((k) => !keys.has(k))
					: items.flatMap((i) => (i.after && state.shown.includes(i.key) ? [i.key] : [])),
				back: [],
				steps: [step, ...state.steps].slice(0, UNDO_DEPTH),
			}
		}
		case "failed": {
			const answers = { ...state.answers }
			delete answers[action.key]
			const steps = state.steps
				.map((s) => (s.id === action.step ? { ...s, items: s.items.filter((i) => i.key !== action.key) } : s))
				.filter((s) => s.items.length > 0)
			return { ...state, answers, steps }
		}
		case "forget": {
			const answers = { ...state.answers }
			delete answers[action.key]
			return { ...state, answers }
		}
		case "undo": {
			const [step, ...steps] = state.steps
			if (!step) return state
			const answers = { ...state.answers }
			for (const i of step.items) answers[i.key] = i.before
			if (step.list === state.list) {
				// The rows as they were: the ones that slid out come back to their places, the ones that came in go.
				const now = new Set(state.shown.filter((k) => !state.leaving.includes(k)))
				const returning = new Set(step.shown)
				return {
					...state,
					answers,
					gone: state.gone.filter((k) => !returning.has(k)),
					shown: step.shown,
					leaving: [],
					latest: step.latest,
					back: step.shown.filter((k) => !now.has(k)),
					steps,
				}
			}
			// The list changed since: a title taken back that isn't shown comes in at the top.
			const missing = step.items.map((i) => i.key).filter((k) => !state.shown.includes(k))
			return {
				...state,
				answers,
				gone: state.gone.filter((k) => !missing.includes(k)),
				shown: [...missing, ...state.shown].slice(0, Math.max(ROWS, missing.length)),
				back: missing,
				latest: state.latest.filter((k) => !step.items.some((i) => i.key === k)),
				steps,
			}
		}
	}
}

/** A title's answer now: this visit's, else the person's marks. */
export const answerOf = (state: Pick<QuickState, "answers">, held: (key: string) => QuickAnswer | null, key: string) =>
	key in state.answers ? (state.answers[key] ?? null) : held(key)

/**
 * The titles of `list` that may take a free place, in order. From the person's unanswered titles: those with no answer
 * at all (`answered` is the person's marks, every kind, and this visit's answers). From a search: every title but the
 * rows that slid out of it (an answer, given before or in this visit, shows, to be changed).
 */
export function fillOf(
	list: readonly QuickTitle[],
	state: Pick<QuickState, "answers" | "shown" | "gone">,
	answered: { has: (key: string) => boolean },
	search: boolean,
): string[] {
	const shown = new Set(state.shown)
	const gone = new Set(state.gone)
	return list.flatMap((t) => {
		if (shown.has(t.key) || gone.has(t.key)) return []
		if (search) return [t.key]
		const here = state.answers[t.key]
		if (here) return []
		if (here === undefined && answered.has(t.key)) return []
		return [t.key]
	})
}

/**
 * Rows of the person's unanswered titles that turned out answered (a guest's browser read after the first rows, an
 * answer given in another tab): not answered here, but in the person's marks. A search keeps them.
 */
export function staleRows(
	state: Pick<QuickState, "answers" | "shown" | "leaving">,
	answered: { has: (key: string) => boolean },
	search: boolean,
): string[] {
	if (search) return []
	return state.shown.filter((k) => !(k in state.answers) && !state.leaving.includes(k) && answered.has(k))
}

/** The change Undo takes back next, for the undo bar. */
export const lastStep = (s: Pick<QuickState, "steps">): Step | null => s.steps[0] ?? null

// ---------------------------------------------------------------------------------------------------------
// The guest limit

/**
 * Which of `keys` may take `score` for a guest with `rated` scores and `limit` at most: a title that has a score
 * already is a change; the rest only while ratings are left. Members: all.
 */
export function scorable(
	keys: readonly string[],
	scored: (key: string) => boolean,
	rated: number,
	limit: number,
	member: boolean,
): string[] {
	if (member) return [...keys]
	let left = Math.max(0, limit - rated)
	return keys.filter((k) => {
		if (scored(k)) return true
		if (left <= 0) return false
		left--
		return true
	})
}

// ---------------------------------------------------------------------------------------------------------
// Order

export type QuickSort = "source" | "title" | "year"
export type Direction = "asc" | "desc"
export interface Order {
	by: QuickSort
	dir: Direction
}
/** The source's own order: best known first for the person's titles, the ranking's for a search. Unlabeled. */
export const SOURCE_ORDER: Order = { by: "source", dir: "desc" }
const FIRST: Record<Exclude<QuickSort, "source">, Direction> = { title: "asc", year: "desc" }

/** A column head's press: its first direction, then the other, then back to the source order. */
export function nextOrder(o: Order, by: Exclude<QuickSort, "source">): Order {
	if (o.by !== by) return { by, dir: FIRST[by] }
	return o.dir === FIRST[by] ? { by, dir: FIRST[by] === "asc" ? "desc" : "asc" } : SOURCE_ORDER
}

// Lower case and without accents; a leading article doesn't count for the order.
const sortName = (s: string) =>
	s
		.normalize("NFD")
		.replace(/\p{M}/gu, "")
		.toLowerCase()
		.trim()
		.replace(/^(the|an|a) (?=\S)/, "")

/** The titles that pass the filters (the search box aside: a search is its own list), in order. */
export function listOf(titles: readonly QuickTitle[], f: ScoreFilters, o: Order): QuickTitle[] {
	const sheet = { ...f, q: "" }
	const passing = titles.filter((t) => passes(t, sheet, { score: 0, changed: false }))
	if (o.by === "source") return passing
	const sign = o.dir === "asc" ? 1 : -1
	const at = new Map(passing.map((t, i) => [t.key, i]))
	return passing.sort((a, b) => {
		const d =
			o.by === "year"
				? (a.release_year ?? 0) - (b.release_year ?? 0)
				: sortName(a.title).localeCompare(sortName(b.title), "en")
		return d * sign || (at.get(a.key) ?? 0) - (at.get(b.key) ?? 0)
	})
}

// ---------------------------------------------------------------------------------------------------------
// Selection (desktop only)

/** A press on a row: it joins the selection, or leaves it. */
export function toggleSelected(selected: ReadonlySet<string>, key: string): Set<string> {
	const next = new Set(selected)
	if (next.has(key)) next.delete(key)
	else next.add(key)
	return next
}

/** A Shift press: every row from the last one pressed (`anchor`) to this one joins. Without an anchor in the rows, a press. */
export function selectRange(
	selected: ReadonlySet<string>,
	rows: readonly string[],
	anchor: string | null,
	key: string,
): Set<string> {
	const from = anchor == null ? -1 : rows.indexOf(anchor)
	const to = rows.indexOf(key)
	if (from < 0 || to < 0) return toggleSelected(selected, key)
	const next = new Set(selected)
	for (let i = Math.min(from, to); i <= Math.max(from, to); i++) next.add(rows[i])
	return next
}

/** The selection, with rows that are no longer there left out (the same set when nothing changed). */
export function keepSelected(selected: ReadonlySet<string>, rows: readonly string[]): ReadonlySet<string> {
	if (![...selected].some((k) => !rows.includes(k))) return selected
	return new Set([...selected].filter((k) => rows.includes(k)))
}

/**
 * The selection after a bulk answer to `chosen`: rows whose write was on its way (`busy`) weren't answered, so they
 * stay selected, with a line that says so; the rest leave the selection.
 */
export function afterBulk(
	chosen: readonly string[],
	busy: readonly string[],
): { selected: Set<string>; stillSaving: number } {
	const left = new Set(busy)
	const selected = new Set(chosen.filter((k) => left.has(k)))
	return { selected, stillSaving: selected.size }
}

// ---------------------------------------------------------------------------------------------------------
// Bulk writes

/** How many saves of a bulk answer (or its undo) run at a time. */
export const BULK_AT_ONCE = 4

/** Runs tasks given to it with at most `limit` running at a time, the rest waiting in order. */
export function bounded(limit: number) {
	let running = 0
	const waiting: (() => void)[] = []
	const next = () => {
		if (running >= limit) return
		const start = waiting.shift()
		if (start) start()
	}
	return function run<T>(task: () => Promise<T>): Promise<T> {
		return new Promise<T>((resolve, reject) => {
			waiting.push(() => {
				running++
				let p: Promise<T>
				try {
					p = task()
				} catch (error) {
					p = Promise.reject(error)
				}
				p.then(resolve, reject).finally(() => {
					running--
					next()
				})
			})
			next()
		})
	}
}

// ---------------------------------------------------------------------------------------------------------
// More titles

/**
 * Paging the person's titles: one request at a time, a stop after `MISSES_MAX` batches the filters let nothing
 * through from, and an end once a request brought nothing new. `endAt` is the exclusion set (`exclusionKey`) that
 * request named: asking again with the same set would bring the same nothing, so it isn't asked again until the set
 * changes.
 */
export interface Paging {
	fetching: boolean
	failed: boolean
	misses: number
	endAt: string | null
}
export const INITIAL_PAGING: Paging = { fetching: false, failed: false, misses: 0, endAt: null }
export const MISSES_MAX = 3

/** The titles a request for more names as known, as one string: what makes two requests the same. */
export const exclusionKey = (keys: Iterable<string>) => [...new Set(keys)].sort().join(",")

/**
 * The next request for more titles: every title of this visit's answers (`answered`, oldest first) and of the list
 * (`pool`, bounded) named as known, none cut off, so a batch never brings back a title the list already has.
 */
export function moreRequest(answered: readonly string[], pool: readonly string[]): { excludeIds: ExcludeItem[]; exclusion: string } {
	return {
		excludeIds: excludeIdsFor(answered, pool, answered.length + pool.length),
		exclusion: exclusionKey([...answered, ...pool]),
	}
}

/** Whether the list may ask for more titles now, with this exclusion set. */
export const mayAsk = (p: Paging, exclusion: string) =>
	!p.fetching && !p.failed && p.misses < MISSES_MAX && p.endAt !== exclusion

/** After a batch: `added` new titles, `passing` of them through the filters, for the request naming `exclusion`. */
export function afterBatch(p: Paging, exclusion: string, added: number, passing: number): Paging {
	return {
		fetching: false,
		failed: false,
		misses: passing ? 0 : p.misses + 1,
		endAt: added === 0 ? exclusion : null,
	}
}

/**
 * "Look further" (or Try again): another try, unless the last request named this same exclusion set and brought
 * nothing new: then it stays at the end and asks nothing.
 */
export function lookFurther(p: Paging, exclusion: string): Paging {
	if (p.endAt === exclusion) return p.failed ? { ...p, failed: false } : p
	return { ...p, failed: false, misses: 0 }
}

/** At the end of the person's titles for now: the last request brought nothing new, and nothing changed since. */
export const atEnd = (p: Paging, exclusion: string) => p.endAt === exclusion
