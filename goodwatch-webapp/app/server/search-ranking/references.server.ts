// Finds what a query refers to: people, teams and studios by name, or a "like X" title. A reference brings its own
// titles (weighted by credit), the seed titles its profile is built from, an intent, and the residual query: the
// words that remain once the names and filler words are removed ("funny" in "funny brad pitt shows").
import { looksForeign, spell, splitNegation } from "./query-parsing.server.ts"
import type { NameEntity, SearchIndex } from "./search-index.server.ts"
import {
	STOPWORDS,
	fold,
	normalized,
	tokens,
	words,
} from "./text-rules.server.ts"

export type Intent = "like" | "filmography" | "style" | "both"

export interface NamedEntity {
	entity: NameEntity
	/** Token span in the folded query. */
	span: [number, number]
}

export interface Detection {
	entities: NamedEntity[]
	/** The folded query. */
	tokens: string[]
	/** The query with every name replaced by "X", encoded to pick the intent; null when the query is only names. */
	intentText: string | null
	/** The intent when the query is only names; otherwise nearestIntent() decides from intentText. */
	intent: Intent | null
	/** "early" or "late" career. */
	era: "early" | "late" | null
}

export interface Reference {
	kind: "title" | "entity"
	intent: Intent
	/** Row -> title weight in (0, 1]: its own titles and credits. */
	weights: Map<number, number>
	/** Rows the profile is built from. */
	seeds: number[]
	/** Words of the reference, left out of the facets. */
	words: Set<string>
	/** The residual query. */
	text: string
	/** Negated clauses of the residual. */
	negated: string[]
	era: "early" | "late" | null
	detection: Detection | null
	/** Point ids of the own titles (weight 1, plus a person's co-directed films). */
	own: Set<number>
}

// Longest name tried, in words.
const NAME_MAX_WORDS = 4
// Seeds: the reference's top main-credit titles by votes.
const SEED_TITLES = 20
// "kubrickesque", "lynchian": a suffixed word resolves by its stem.
const STYLE_SUFFIX = /^(.{4,}?)(?:esque|ian|like|ish)$/u

// Words of a reference query that carry no topic: what is left once they and the names are removed is the residual.
const FILLER = new Set(
	"a an the and or und et y of in on for to me some any good great best top all every movie movies film films filme filmen show shows series tv starring stars star with featuring feat by directed director written produced voiced mit von avec de del con from filmography works work career early late later recent old older classic newer new s give want watch something anything vibe vibes vibey style styled stylish esque like feel feels feeling atmosphere atmospheric aesthetic aesthetics humor humour tone mood energy similar inspired vein sensibility touch flavor flavour spirit type sort kind way approach à la brothers bros sisters".split(
		" ",
	),
)
const ERA_WORDS = new Map<string, "early" | "late">([
	["early", "early"],
	["late", "late"],
	["later", "late"],
	["recent", "late"],
	["new", "late"],
	["newer", "late"],
	["old", "early"],
	["older", "early"],
	["classic", "early"],
	["frühe", "early"],
	["frühen", "early"],
])

// --- People, teams and studios ------------------------------------------------------------------------------------

function resolveKey(index: SearchIndex, key: string): NameEntity | null {
	const i = index.names.entityOf.get(key)
	return i === undefined ? null : index.names.entities[i]
}

/** Levenshtein distance of at most 1 (insert, delete or substitute one character). */
function withinOneEdit(a: string, b: string): number {
	if (a === b) return 0
	if (Math.abs(a.length - b.length) > 1) return 2
	if (a.length === b.length) {
		let diff = 0
		for (let i = 0; i < a.length && diff < 2; i++) if (a[i] !== b[i]) diff++
		return diff
	}
	const [short, long] = a.length < b.length ? [a, b] : [b, a]
	let i = 0
	while (i < short.length && short[i] === long[i]) i++
	return short.slice(i) === long.slice(i + 1) ? 1 : 2
}

/** People, teams and studios named in the query, longest names first, or null. */
export function detect(index: SearchIndex, query: string): Detection | null {
	const toks = fold(query).split(" ").filter(Boolean)
	// The words that make a key common are English: in other languages only names of two or more words count.
	const foreign = looksForeign(query)
	const found: NamedEntity[] = []
	const used = new Set<number>()
	const take = (entity: NameEntity, i: number, j: number) => {
		found.push({ entity, span: [i, j] })
		for (let k = i; k < j; k++) used.add(k)
	}
	for (let n = NAME_MAX_WORDS; n >= 1; n--) {
		for (let i = 0; i + n <= toks.length; i++) {
			const j = i + n
			let overlaps = false
			for (let k = i; k < j; k++) if (used.has(k)) overlaps = true
			if (overlaps || (n === 1 && foreign)) continue
			const key = toks.slice(i, j).join(" ")
			let entity = resolveKey(index, key)
			if (!entity && n === 1) {
				const m = STYLE_SUFFIX.exec(key)
				entity = m ? resolveKey(index, m[1]) : null
			}
			if (entity) take(entity, i, j)
		}
	}
	if (!found.length && !foreign) {
		// A typo: a word that appears nowhere in the catalog, one edit from a full name
		const df = index.words.df
		for (let n = NAME_MAX_WORDS; n >= 2 && !found.length; n--) {
			for (let i = 0; i + n <= toks.length && !found.length; i++) {
				const span = toks.slice(i, i + n)
				if (!span.some((w) => (df.get(w) ?? 0) === 0)) continue
				const text = span.join(" ")
				let best: string | null = null
				let bestDistance = 2
				for (const key of index.names.fullNames) {
					const d = withinOneEdit(text, key)
					if (d < bestDistance) {
						best = key
						bestDistance = d
						if (d === 0) break
					}
				}
				const entity = best ? resolveKey(index, best) : null
				if (entity) take(entity, i, i + n)
			}
		}
	}
	if (!found.length) return null
	found.sort((a, b) => a.span[0] - b.span[0] || a.span[1] - b.span[1])
	const rest = toks.filter((_, k) => !used.has(k))
	const era = rest.map((w) => ERA_WORDS.get(w)).find(Boolean) ?? null
	let intentText: string | null = null
	let intent: Intent | null = null
	if (!rest.length)
		intent = found.every((e) => e.entity.kind === "studio")
			? "filmography"
			: "both"
	else {
		const out: string[] = [...toks]
		for (const e of [...found].sort((a, b) => b.span[0] - a.span[0]))
			out.splice(e.span[0], e.span[1] - e.span[0], "X")
		intentText = out.join(" ")
	}
	return { entities: found, tokens: toks, intentText, intent, era }
}

/** The intent of the example phrase nearest to the query vector (multilingual-e5-small of the intent text). */
export function nearestIntent(
	index: SearchIndex,
	vector: Float32Array,
): Intent {
	const { labels, dim, vectors } = index.intents
	let best = 0
	let bestScore = Number.NEGATIVE_INFINITY
	for (let e = 0; e < labels.length; e++) {
		let s = 0
		for (let d = 0; d < dim; d++) s += vectors[e * dim + d] * vector[d]
		if (s > bestScore) {
			bestScore = s
			best = e
		}
	}
	return labels[best] as Intent
}

/**
 * Row -> weight in (0, 1]: the mean over the entities of each one's credit weight (a title with both Bud Spencer and
 * Terence Hill scores 1, a title with one of them 0.5).
 */
function titleWeights(
	index: SearchIndex,
	entities: NamedEntity[],
): Map<number, number> {
	const { rowOf } = index.titleTable
	const sums = new Map<number, number>()
	for (const { entity } of entities) {
		for (const [id, w] of entity.titles) {
			const row = rowOf.get(id)
			if (row !== undefined) sums.set(row, (sums.get(row) ?? 0) + w)
		}
	}
	for (const [row, w] of sums) sums.set(row, w / entities.length)
	return sums
}

/** The top SEED_TITLES titles by votes among the main credits (all credits when there are none). */
function seedRows(index: SearchIndex, weights: Map<number, number>): number[] {
	const { votes, pointIds } = index.titleTable
	let rows = [...weights].filter(([, w]) => w >= 1).map(([row]) => row)
	if (!rows.length) rows = [...weights.keys()]
	rows.sort((a, b) => votes[b] - votes[a] || pointIds[a] - pointIds[b])
	return rows.slice(0, SEED_TITLES)
}

// --- "like X" titles ----------------------------------------------------------------------------------------------

const LIKE_MARKERS = [
	"similar to",
	"in the vein of",
	"in the style of",
	"reminiscent of",
	"along the lines of",
	"same vibe as",
	"if i liked",
	"if i loved",
	"for fans of",
	"like",
].map((m) => m.split(" "))
// "i'd like", "feels like"
const NOT_LIKE = new Set(
	"feel feels felt look looks sound sounds d would i you we just t not".split(
		" ",
	),
)
const NOT_AFTER_BUT = new Set("not no without never less".split(" "))
const TITLE_MAX_WORDS = 8

/**
 * The longest title (up to 8 words) right after a like-marker, or at the start of the query running up to "but"
 * ("breaking bad but funny", not "... but not ..."): (row, used token positions), or null.
 */
function findReference(
	index: SearchIndex,
	toks: string[],
): { row: number; used: Set<number> } | null {
	const starts: [number, number, number | null][] = []
	for (let i = 0; i < toks.length; i++) {
		for (const m of LIKE_MARKERS) {
			const matches = m.every((w, k) => toks[i + k] === w)
			const isLikeAfterVerb =
				m.length === 1 && m[0] === "like" && i > 0 && NOT_LIKE.has(toks[i - 1])
			if (matches && !isLikeAfterVerb) starts.push([i, i + m.length, null])
		}
	}
	const but = toks.indexOf("but", 1)
	if (but > 0 && but + 1 < toks.length && !NOT_AFTER_BUT.has(toks[but + 1]))
		starts.push([0, 0, but])
	for (const [markerStart, s, end] of starts) {
		for (let k = Math.min(toks.length - s, TITLE_MAX_WORDS); k >= 1; k--) {
			const key = toks.slice(s, s + k).join(" ")
			if (
				key.length < 3 ||
				STOPWORDS.has(key) ||
				(end !== null && s + k !== end)
			)
				continue
			const row = index.referenceTitles.get(key)
			if (row !== undefined) {
				const used = new Set<number>()
				for (let p = markerStart; p < s + k; p++) used.add(p)
				return { row, used }
			}
		}
	}
	return null
}

/** The reference and the titles whose title contains its the-less title, when that is distinctive. */
function franchiseRows(index: SearchIndex, row: number): Set<number> {
	const title = normalized(index.titleTable.titles[row])
	const stem = title.startsWith("the ") ? title.slice(4) : title
	const out = new Set([row])
	if (stem.split(" ").length >= 2 || stem.length >= 6) {
		const pattern = ` ${stem} `
		for (const t of index.franchiseTitles)
			if (t.title.includes(pattern) || t.original.includes(pattern))
				out.add(t.row)
	}
	return out
}

// --- The reference --------------------------------------------------------------------------------------------------

/**
 * (residual text, negated clauses): the tokens outside the reference, spell-corrected (English only), negated clauses
 * split off, filler words dropped; the text is empty when no content word is left.
 */
function residual(
	index: SearchIndex,
	toks: string[],
	used: Set<number>,
	nonEnglish: boolean,
): { text: string; negated: string[] } {
	const text = toks.filter((_, i) => !used.has(i)).join(" ")
	const { positive, negated } = splitNegation(
		nonEnglish ? text : spell(index, text),
	)
	const content = tokens(positive).filter(
		(w) => !FILLER.has(w) && !STOPWORDS.has(w),
	)
	return {
		text: content.length
			? positive
					.split(/\s+/)
					.filter((w) => w && !FILLER.has(w))
					.join(" ")
			: "",
		negated,
	}
}

/**
 * The person, team, studio or "like X" title the query names, or null. `intent` of an entity reference with a
 * residual stays null until the caller has encoded detection.intentText (see nearestIntent).
 */
export function resolveReference(
	index: SearchIndex,
	query: string,
	text: string,
	nonEnglish: boolean,
): (Omit<Reference, "intent"> & { intent: Intent | null }) | null {
	const t = index.titleTable
	const det = detect(index, query)
	let ref: Omit<Reference, "intent" | "own"> & { intent: Intent | null }
	if (det) {
		const weights = titleWeights(index, det.entities)
		const used = new Set<number>()
		const ws = new Set<string>()
		for (const e of det.entities) {
			for (let i = e.span[0]; i < e.span[1]; i++) {
				used.add(i)
				ws.add(det.tokens[i])
			}
			for (const w of fold(e.entity.name).split(" ")) if (w) ws.add(w)
		}
		ref = {
			kind: "entity",
			intent: det.intent,
			weights,
			seeds: seedRows(index, weights),
			words: ws,
			...residual(index, det.tokens, used, nonEnglish),
			era: det.era,
			detection: det,
		}
	} else {
		const toks = words(text)
		const hit = findReference(index, toks)
		if (!hit) return null
		const ws = new Set([
			...[...hit.used].map((i) => toks[i]),
			...words(t.titles[hit.row]),
		])
		ref = {
			kind: "title",
			intent: "like",
			weights: new Map(
				[...franchiseRows(index, hit.row)].map((row) => [row, 1]),
			),
			seeds: [hit.row],
			words: ws,
			...residual(index, toks, hit.used, nonEnglish),
			era: null,
			detection: null,
		}
	}
	const own = new Set<number>()
	for (const [row, w] of ref.weights) if (w >= 1) own.add(t.pointIds[row])
	// Co-directed films count as own titles for the bounds
	for (const e of det?.entities ?? [])
		for (const id of e.entity.codirected) own.add(id)
	return { ...ref, own }
}
