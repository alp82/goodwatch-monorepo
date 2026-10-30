// Production's title blend (app/ui/search/search-model.tsx) over the ranked list, so exact title searches still win.
// Two changes make it stricter: a partial title match counts only when the title is close to the whole query (or has
// every concrete word of the query), and a query with a word unknown to the catalog also matches the most similar
// title ("Incepton"). Titles that share an IMDb id appear once. One change makes it looser: a query of two or more
// words that a title starts with is the start of that title, as the command palette's preview reads it ("lord of"),
// and spaces don't count ("spiderman" is the exact title "Spider-Man"; see title-prefix.server.ts).
//
// Localized names (aliases.server.ts) add recall one step below the title: a lookup row the palette found by an alias
// scores its alias match ALIAS_STEP below a title match of the same kind, and the fuzzy match tries the aliases only
// when no title or original title is close enough.
import {
	ALIAS_STEP,
	BUCKETS,
	type MatchedAlias,
	aliasCharCounts,
	aliasSharedChars,
	aliasSquashed,
	charCounts,
	exactAliases,
	matchedAlias,
	squashedFold,
} from "./aliases.server.ts"
import type { SearchIndex } from "./search-index.server.ts"
import { normalized, words } from "./text-rules.server.ts"
import { sameName, startsTitle } from "./title-prefix.server.ts"

// A partial title match needs this similarity to the query (also the cutoff of fuzzy titles).
const STRICT = 0.9
// A failed strict match keeps min(lexical, CONCRETE_CAP) when every concrete query word is in the title.
const CONCRETE_CAP = 0.65
// A title that starts with a query of two or more words: level with the ranked list's first title, ahead of the rest.
const PREFIX = 0.9
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
	/** The localized name the lookup matched, when it matched by one. */
	matchedAlias?: MatchedAlias
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
	/** The localized name the title matched by, when that beat its title and original title. */
	matchedAlias?: MatchedAlias
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

// Character counts of each title name (aliases.server.ts charCounts), for a cheap upper bound of similarity() before
// the full comparison. Computed once per index build (76 bytes a name). The aliases carry theirs in the table.
const countsByNames = new WeakMap<
	SearchIndex["titleNames"],
	{ counts: Uint16Array; lengths: Uint32Array }
>()
function nameCounts(names: SearchIndex["titleNames"]) {
	let found = countsByNames.get(names)
	if (!found) {
		const counts = new Uint16Array(names.length * BUCKETS)
		const lengths = new Uint32Array(names.length)
		names.forEach(({ name }, i) => {
			charCounts(name, counts, i * BUCKETS)
			lengths[i] = [...name].length
		})
		found = { counts, lengths }
		countsByNames.set(names, found)
	}
	return found
}

/** Computes the per-build data of the fuzzy title match ahead of the first search. */
export function prepareTitleBlend(index: SearchIndex): void {
	nameCounts(index.titleNames)
}

/**
 * A query with a word unknown to the catalog: the row of the most similar eligible title (similarity >= STRICT), unless
 * it is the exact title (the title lookup finds those) or the filter excludes it. Only when no title or original title
 * is that similar, the most similar localized name, with its alias index.
 */
function fuzzyTitle(
	index: SearchIndex,
	query: string,
	rows: Uint8Array,
): { row: number; alias?: number } | null {
	const q = normalized(query)
	if (!q || q.split(" ").every((w) => index.words.df.has(w))) return null
	const qLength = [...q].length
	const counts = nameCounts(index.titleNames)
	const wanted = charCounts(q)
	const used: number[] = []
	for (let b = 0; b < BUCKETS; b++) if (wanted[b]) used.push(b)
	let best: { row: number; score: number } | null = null
	for (let i = 0; i < index.titleNames.length; i++) {
		const { name, row } = index.titleNames[i]
		// The ratio can't reach STRICT when the lengths differ this much.
		const n = name.length
		if ((2 * Math.min(n, qLength)) / (n + qLength) < STRICT - 1e-9) continue
		// Nor when the two strings share too few characters: a common subsequence matches at most min(count) of each.
		let shared = 0
		const base = i * BUCKETS
		for (const b of used) shared += Math.min(wanted[b], counts.counts[base + b])
		if ((2 * shared) / (counts.lengths[i] + qLength) < STRICT - 1e-9) continue
		const score = similarity(q, name)
		if (score >= STRICT && (!best || score > best.score)) best = { row, score }
	}
	if (best) return best.score >= 1 || !rows[best.row] ? null : { row: best.row }
	return fuzzyAlias(index, query, rows)
}

/** fuzzyTitle over the localized names, folded and without spaces on both sides. */
function fuzzyAlias(
	index: SearchIndex,
	query: string,
	rows: Uint8Array,
): { row: number; alias: number } | null {
	const table = index.aliases
	const q = squashedFold(query)
	// An exact localized name is the title lookup's to find (through the palette), as an exact title is.
	if (!q || !table.size || exactAliases(table, q).length) return null
	const qLength = [...q].length
	const wanted = aliasCharCounts(q)
	let best: { alias: number; score: number } | null = null
	// The ratio can't reach STRICT outside this length window.
	const shortest = Math.ceil((qLength * STRICT) / (2 - STRICT) - 1e-9)
	const longest = Math.min(
		table.lengthStart.length - 2,
		Math.floor((qLength * (2 - STRICT)) / STRICT + 1e-9),
	)
	if (shortest > longest) return null
	const from = table.lengthStart[shortest]
	const to = table.lengthStart[longest + 1]
	for (let k = from; k < to; k++) {
		const i = table.byLength[k]
		const n = table.lengths[i]
		const shared = aliasSharedChars(table, i, wanted)
		if ((2 * shared) / (n + qLength) < STRICT - 1e-9) continue
		const score = similarity(q, aliasSquashed(table, i))
		if (score >= STRICT && (!best || score > best.score))
			best = { alias: i, score }
	}
	if (!best || best.score >= 1) return null
	const row = table.rows[best.alias]
	return rows[row] ? { row, alias: best.alias } : null
}

// The kind of a lexical match (exact, phrase or fuzzy, prefix, word share, ...) is its score; an alias match of a kind
// scores ALIAS_STEP less. Rounded, so the subtraction's float error doesn't split a kind.
const kindOf = (lexical: number) => Math.round(lexical * 1e6)
// How far below the title rows of its kind an alias row's blended score is kept.
const BELOW_TITLES = ALIAS_STEP / 100

/**
 * A row matched by a localized name stays below every title row of the same kind, whatever the ranked list adds: the
 * fusion lifts a row by its rank, so a ranked alias row could otherwise pass a title row of its kind that the ranker
 * placed lower or not at all. Its score is capped just below the lowest title row of its kind; title rows keep theirs.
 */
function keepAliasesBelowTitles(rows: Iterable<Row>): void {
	const lowest = new Map<number, number>()
	const byAlias: Row[] = []
	for (const row of rows) {
		if (row.matchedAlias) {
			byAlias.push(row)
			continue
		}
		const kind = kindOf(row.lexical)
		lowest.set(kind, Math.min(lowest.get(kind) ?? row.score, row.score))
	}
	for (const row of byAlias) {
		const floor = lowest.get(kindOf(row.lexical + ALIAS_STEP))
		if (floor !== undefined && row.score > floor - BELOW_TITLES)
			row.score = floor - BELOW_TITLES
	}
}

interface Row {
	id: number
	title: string
	mediaType: "movie" | "show"
	year: string
	popularity: number
	lexical: number
	matchedAlias?: MatchedAlias
	/** Matched or found by a localized name only: after the titles of the same score. */
	byAlias: boolean
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
	limit = BLEND_LENGTH,
): BlendedTitle[] {
	const t = index.titleTable
	const q = normalized(query)
	const queryWords = new Set(words(query))
	const strictLexical = (title: string, original: string | undefined) => {
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
	const canonical = (title: string, original: string | undefined) => {
		const names = [normalized(title), normalized(original ?? "")]
		if (names.some((name) => sameName(name, q))) return 2
		const strict = strictLexical(title, original)
		return names.some((name) => startsTitle(name, q))
			? Math.max(strict, PREFIX)
			: strict
	}
	// The title's match, or its localized name's one step below when that is better (with the alias). A row the lookup
	// found by a localized name that neither name matches here ranks after the titles of its score.
	const lexical = (
		title: string,
		original: string | undefined,
		alias?: MatchedAlias,
	): { lex: number; alias?: MatchedAlias; byAlias?: boolean } => {
		const lex = canonical(title, original)
		if (!alias) return { lex }
		const byAlias = canonical(alias.text, undefined) - ALIAS_STEP
		return byAlias > lex
			? { lex: byAlias, alias, byAlias: true }
			: { lex, byAlias: lex === 0 }
	}
	const fromTable = (
		row: number,
		popularity: number,
		{ lex, alias }: { lex: number; alias?: MatchedAlias },
	): Row => ({
		id: t.pointIds[row],
		title: t.titles[row],
		mediaType: t.pointIds[row] >= SHOW_POINT_IDS ? "show" : "movie",
		year: t.years[row] ? String(t.years[row]) : "",
		popularity,
		lexical: lex,
		matchedAlias: alias,
		byAlias: Boolean(alias),
		rank: null,
		score: 0,
	})
	const rows = new Map<number, Row>()
	for (const title of titleLookup) {
		if (title.type !== "movie" && title.type !== "tv") continue
		const id = pointId(title.type, title.id)
		const { lex, alias, byAlias } = lexical(
			title.title,
			title.original,
			title.matchedAlias,
		)
		rows.set(id, {
			id,
			title: title.title,
			mediaType: title.type === "tv" ? "show" : "movie",
			year: title.year || "",
			popularity: title.popularity || 0,
			lexical: lex,
			matchedAlias: alias,
			byAlias: Boolean(byAlias),
			rank: null,
			score: 0,
		})
	}
	const fuzzy = fuzzyTitle(index, query, filterRows)
	if (fuzzy !== null) {
		const id = t.pointIds[fuzzy.row]
		const existing = rows.get(id)
		const match =
			fuzzy.alias === undefined
				? { lex: 1.05 }
				: {
						lex: 1.05 - ALIAS_STEP,
						alias: matchedAlias(index.aliases, fuzzy.alias),
					}
		if (!existing || existing.lexical < match.lex)
			rows.set(id, fromTable(fuzzy.row, t.popularity[fuzzy.row], match))
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
					lexical: lexical(facts.title, facts.originalTitle).lex,
					byAlias: false,
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
	keepAliasesBelowTitles(rows.values())
	const key = (row: Row) => `${row.mediaType}:${row.id % TMDB_ID_RANGE}`
	const ordered = [...rows.values()]
		.sort(
			(a, b) =>
				b.score - a.score ||
				Number(a.byAlias) - Number(b.byAlias) ||
				b.popularity - a.popularity ||
				(key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0),
		)
		.slice(0, limit)
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
			...(row.matchedAlias ? { matchedAlias: row.matchedAlias } : {}),
		})
	}
	return out
}
