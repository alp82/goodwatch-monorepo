// Production's title blend (app/ui/search/search-model.tsx) over the ranked list, so exact title searches still win.
// Two changes make it stricter: a partial title match counts only when the title is close to the whole query (or has
// every concrete word of the query), and a query with a word unknown to the catalog also matches the most similar
// title ("Incepton"). Titles that share an IMDb id appear once.
import type { SearchIndex } from "./search-index.server.ts"
import { normalized, words } from "./text-rules.server.ts"

// A partial title match needs this similarity to the query (also the cutoff of fuzzy titles).
const STRICT = 0.9
// A failed strict match keeps min(lexical, CONCRETE_CAP) when every concrete query word is in the title.
const CONCRETE_CAP = 0.65
const BLEND_LENGTH = 100
const SHOW_POINT_IDS = 2_000_000_000_000
const TMDB_ID_RANGE = 1_000_000_000_000

/** A TMDB title lookup row, as the search's title lookup returns it. */
export interface TitleLookupRow {
	id: number
	title: string
	original?: string
	type: string
	year: string
	popularity: number
}

/** What the ranker knows of a title outside the title table (a lesser-known title), in the table's conventions. */
export interface TitleFacts {
	/** The title, else the original title. */
	title: string
	/** "" when unknown. */
	originalTitle: string
	/** 0 when unknown. */
	year: number
	votes: number
	/** NaN when unknown. */
	goodwatchScore: number
}

export interface BlendedTitle {
	id: number
	title: string
	year: string
	mediaType: "movie" | "show"
	score: number
}

export const pointId = (mediaType: string, tmdbId: number) =>
	(mediaType === "show" || mediaType === "tv" ? 2 : 1) * TMDB_ID_RANGE + tmdbId

/** Production's lexical title score: exact 2, phrase 1.05, all words 0.9, word coverage, last-word prefix 0.15. */
export function titleMatch(title: string, query: string): number {
	const name = normalized(title)
	const request = normalized(query)
	if (!name || !request) return 0
	if (name === request) return 2
	const target = words(title)
	const wanted = words(query)
	const unique = new Set(wanted)
	let hits = 0
	for (const w of unique) if (target.includes(w)) hits++
	const coverage = hits / unique.size
	if (` ${name} `.includes(` ${request} `)) return 1.05
	if (coverage === 1) return 0.9
	if (hits) return 0.65 * coverage
	const last = wanted[wanted.length - 1]
	if (
		wanted.length &&
		[...last].length >= 2 &&
		target.some((w) => w.startsWith(last))
	)
		return 0.15
	return 0
}

/** rapidfuzz's ratio: 1 - Indel distance / total length, from the longest common subsequence. */
export function similarity(a: string, b: string): number {
	const x = [...a]
	const y = [...b]
	const total = x.length + y.length
	if (!total) return 1
	if (!x.length || !y.length) return 0
	let prev = new Uint16Array(y.length + 1)
	let row = new Uint16Array(y.length + 1)
	for (let i = 1; i <= x.length; i++) {
		for (let j = 1; j <= y.length; j++)
			row[j] =
				x[i - 1] === y[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], row[j - 1])
		;[prev, row] = [row, prev]
	}
	return (2 * prev[y.length]) / total
}

/**
 * A query with a word unknown to the catalog: the row of the most similar eligible title (similarity >= STRICT), unless
 * it is the exact title (the title lookup finds those) or the filter excludes it.
 */
function fuzzyTitle(
	index: SearchIndex,
	query: string,
	rows: Uint8Array,
): number | null {
	const q = normalized(query)
	if (!q || q.split(" ").every((w) => index.words.df.has(w))) return null
	const qLength = [...q].length
	let best: { row: number; score: number } | null = null
	for (const { name, row } of index.titleNames) {
		// The ratio can't reach STRICT when the lengths differ this much.
		const n = name.length
		if ((2 * Math.min(n, qLength)) / (n + qLength) < STRICT - 1e-9) continue
		const score = similarity(q, name)
		if (score >= STRICT && (!best || score > best.score)) best = { row, score }
	}
	if (!best || best.score >= 1 || !rows[best.row]) return null
	return best.row
}

interface Row {
	id: number
	title: string
	mediaType: "movie" | "show"
	year: string
	popularity: number
	lexical: number
	rank: number | null
	score: number
}

/**
 * The blended list: title lookup matches, a fuzzy title, and the ranked list (point ids in rank order), scored by
 * production's rank fusion. Ranked ids outside the title table take their title and year from `outside`.
 */
export function blend(
	index: SearchIndex,
	query: string,
	titleLookup: TitleLookupRow[],
	ranked: number[],
	concreteWords: Set<string>,
	filterRows: Uint8Array,
	outside: Map<number, TitleFacts> = new Map(),
): BlendedTitle[] {
	const t = index.titleTable
	const q = normalized(query)
	const queryWords = new Set(words(query))
	const lexical = (title: string, original: string | undefined) => {
		let lex = titleMatch(title, query)
		let source = title
		const originalLex = titleMatch(original ?? "", query)
		if (originalLex > lex) {
			lex = originalLex
			source = original ?? ""
		}
		const close = Math.max(
			similarity(normalized(title), q),
			similarity(normalized(original ?? ""), q),
		)
		if (lex && lex < 2 && close < STRICT) {
			// A partial match that isn't close to the whole title: kept (capped) only when it has every concrete word
			const sourceWords = new Set(words(source))
			const all = [...concreteWords].every(
				(w) => queryWords.has(w) && sourceWords.has(w),
			)
			if (concreteWords.size && all) return Math.min(lex, CONCRETE_CAP)
			return 0
		}
		return lex
	}
	const fromTable = (row: number, popularity: number, lex: number): Row => ({
		id: t.pointIds[row],
		title: t.titles[row],
		mediaType: t.pointIds[row] >= SHOW_POINT_IDS ? "show" : "movie",
		year: t.years[row] ? String(t.years[row]) : "",
		popularity,
		lexical: lex,
		rank: null,
		score: 0,
	})
	const rows = new Map<number, Row>()
	for (const title of titleLookup) {
		if (title.type !== "movie" && title.type !== "tv") continue
		const id = pointId(title.type, title.id)
		rows.set(id, {
			id,
			title: title.title,
			mediaType: title.type === "tv" ? "show" : "movie",
			year: title.year || "",
			popularity: title.popularity || 0,
			lexical: lexical(title.title, title.original),
			rank: null,
			score: 0,
		})
	}
	const fuzzy = fuzzyTitle(index, query, filterRows)
	if (fuzzy !== null) {
		const id = t.pointIds[fuzzy]
		const existing = rows.get(id)
		if (!existing || existing.lexical < 1.05)
			rows.set(id, fromTable(fuzzy, t.popularity[fuzzy], 1.05))
	}
	ranked.forEach((id, i) => {
		let row = rows.get(id)
		if (!row) {
			const r = t.rowOf.get(id)
			if (r !== undefined)
				row = fromTable(r, 0, lexical(t.titles[r], t.originalTitles[r]))
			else {
				const facts = outside.get(id) as TitleFacts
				row = {
					id,
					title: facts.title,
					mediaType: id >= SHOW_POINT_IDS ? "show" : "movie",
					year: facts.year ? String(facts.year) : "",
					popularity: 0,
					lexical: lexical(facts.title, facts.originalTitle),
					rank: null,
					score: 0,
				}
			}
			rows.set(id, row)
		}
		row.rank = i + 1
	})
	for (const row of rows.values()) {
		const fingerprint = row.rank ? 10 / (9 + row.rank) : 0
		const lex = row.lexical
		row.score =
			lex === 2
				? 3 + 0.1 * fingerprint
				: Math.max(lex, fingerprint * 0.9) + Math.min(lex, fingerprint) * 0.15
	}
	const key = (row: Row) => `${row.mediaType}:${row.id % TMDB_ID_RANGE}`
	const ordered = [...rows.values()]
		.sort(
			(a, b) =>
				b.score - a.score ||
				b.popularity - a.popularity ||
				(key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0),
		)
		.slice(0, BLEND_LENGTH)
	const seen = new Set<string>()
	const out: BlendedTitle[] = []
	for (const row of ordered) {
		const r = t.rowOf.get(row.id)
		const imdb = r === undefined ? null : t.imdbIds[r]
		const identity = imdb ? `imdb:${imdb}` : key(row)
		if (seen.has(identity)) continue
		seen.add(identity)
		out.push({
			id: row.id,
			title: row.title,
			year: row.year,
			mediaType: row.mediaType,
			score: Math.round(row.score * 1e4) / 1e4,
		})
	}
	return out
}
