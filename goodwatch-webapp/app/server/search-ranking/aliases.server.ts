// The localized names of the eligible titles (`alias_table`, from `translation.title` in the launch base languages),
// for name recognition only: the command palette's prefix tiers, the fuzzy title match, "like X", and the local title
// lookup. Matching never depends on the display language: every alias is searchable for everyone. Aliases never take a
// place from a title: the palette lists them after every title tier, the title blend scores an alias match one step
// below a title match of the same kind, and the fuzzy match and "like X" ask them only after the titles. Docs:
// docs/implementation/media-language-search-aliases-plan.md.
//
// About 320,000 names, so the table is flat: typed arrays and the gram strings, no object or string per alias. The names
// and their squashed folds are UTF-16 units in one array each, and the character counts keep only the buckets a name
// uses: about 38 MB instead of 59 MB with a string per name and 64 counts per name, and the load worker hands the arrays
// over without copying them. A build without the file (older builds) loads an empty table.
import type { AliasTable, SearchIndex } from "./search-index.server.ts"
import { fold } from "./text-rules.server.ts"

/** How a result matched when it matched by a localized name: the name as stored, and its language. */
export interface MatchedAlias {
	text: string
	language: string
}

/** How far an alias match sits below a canonical match of the same kind, on the lexical title score. */
export const ALIAS_STEP = 0.01
/** Votes a title needs to be a "like X" reference, by its title or a localized name. */
export const REFERENCE_TITLE_VOTES = 10_000

// Character counts for a cheap upper bound of the fuzzy match's similarity: a, ..., z, 0, ..., 9, space, and one
// bucket for every other character. Shared with the canonical names in title-blend.server.ts.
export const BUCKETS = 38
function bucket(code: number): number {
	if (code >= 97 && code <= 122) return code - 97
	if (code >= 48 && code <= 57) return code - 22
	return code === 32 ? 36 : 37
}
export function charCounts(
	text: string,
	into = new Uint16Array(BUCKETS),
	at = 0,
) {
	for (const c of text) {
		const b = at + bucket(c.codePointAt(0) as number)
		if (into[b] < 65535) into[b]++
	}
	return into
}

// The aliases' counts split the other characters into 27 more buckets by code point: half of the names are Cyrillic,
// CJK, Hangul or Arabic, which the one shared bucket can't tell apart. Any split of the characters keeps the bound
// exact.
export const ALIAS_BUCKETS = 64
function aliasBucket(code: number): number {
	const b = bucket(code)
	return b < 37 ? b : 37 + (code % 27)
}
export function aliasCharCounts(
	text: string,
	into: Uint8Array = new Uint8Array(ALIAS_BUCKETS),
	at = 0,
) {
	for (const c of text) {
		const b = at + aliasBucket(c.codePointAt(0) as number)
		if (into[b] < 255) into[b]++
	}
	return into
}

/**
 * Each squashed name's (bucket, count) pairs of aliasCharCounts, as bucket << 8 | count: only the buckets it uses. Two
 * passes over one name's counts at a time, so the load never holds 64 counts for every name.
 */
function packCounts(squashed: string[]) {
	const counts = new Uint8Array(ALIAS_BUCKETS)
	const countAt = new Int32Array(squashed.length + 1)
	for (let i = 0; i < squashed.length; i++) {
		aliasCharCounts(squashed[i], counts.fill(0))
		let used = 0
		for (const c of counts) if (c) used++
		countAt[i + 1] = countAt[i] + used
	}
	const countPairs = new Uint16Array(countAt[squashed.length])
	for (let i = 0, k = 0; i < squashed.length; i++) {
		aliasCharCounts(squashed[i], counts.fill(0))
		for (let b = 0; b < ALIAS_BUCKETS; b++)
			if (counts[b]) countPairs[k++] = (b << 8) | counts[b]
	}
	return { countAt, countPairs }
}

/**
 * The characters alias i shares at most with a text of these aliasCharCounts: the sum over buckets of the smaller
 * count. A bucket alias i doesn't use adds nothing, so its pairs alone give the sum.
 */
export function aliasSharedChars(
	table: AliasTable,
	i: number,
	wanted: Uint8Array,
): number {
	let shared = 0
	for (let k = table.countAt[i]; k < table.countAt[i + 1]; k++) {
		const pair = table.countPairs[k]
		shared += Math.min(wanted[pair >> 8], pair & 255)
	}
	return shared
}

/** A folded name without its spaces: what the palette, the fuzzy match, and the exact lookup compare. */
export const squashedFold = (text: string) => fold(text).replace(/ /g, "")

// biome-ignore lint/suspicious/noExplicitAny: parsed JSON document
type Json = any

export function emptyAliasTable(titles: number): AliasTable {
	return aliasTable({ version: 0, rows: [], names: [], languages: [] }, titles)
}

/** The decoded `alias_table` of a build whose title table has `titles` rows. Rows are ascending in the file. */
export function aliasTable(d: Json | undefined, titles: number): AliasTable {
	if (!d) return emptyAliasTable(titles)
	const columns = [d.rows, d.names, d.languages]
	if (
		!columns.every(Array.isArray) ||
		columns.some((column) => column.length !== d.names.length)
	)
		throw new Error("alias_table columns differ in length")
	const names = d.names as string[]
	const size = names.length
	const rows = Int32Array.from(d.rows as number[])
	const languageNames = [...new Set(d.languages as string[])]
	const languages = Uint8Array.from(d.languages as string[], (l) =>
		languageNames.indexOf(l),
	)
	const squashed: string[] = new Array(size)
	const startAt = new Int32Array(size + 1)
	const starts: number[] = []
	const lengths = new Uint16Array(size)
	for (let i = 0; i < size; i++) {
		const row = rows[i]
		if (row < 0 || row >= titles || (i && row < rows[i - 1]))
			throw new Error("alias_table rows don't match the title table")
		if (typeof names[i] !== "string")
			throw new Error("alias_table names aren't strings")
		const folded = fold(names[i])
		let at = 0
		for (const word of folded.split(" ")) {
			if (!word) continue
			starts.push(at)
			at += word.length
		}
		startAt[i + 1] = starts.length
		squashed[i] = folded.replace(/ /g, "")
		lengths[i] = Math.min(65535, [...squashed[i]].length)
	}
	const wordStarts = Uint16Array.from(starts)
	const packedNames = packTexts(names)
	const packedSquashed = packTexts(squashed)
	return {
		version: size ? Number(d.version) || 1 : 0,
		size,
		rows,
		nameUnits: packedNames.units,
		nameAt: packedNames.at,
		languages,
		languageNames,
		squashedUnits: packedSquashed.units,
		squashedAt: packedSquashed.at,
		wordStarts,
		startAt,
		...gramIndex(squashed, wordStarts, startAt),
		...lengthOrder(lengths),
		...packCounts(squashed),
		lengths,
	}
}

/** Texts as their UTF-16 units in one array: text i is units[at[i]] to [at[i + 1]]. Lossless for any string. */
function packTexts(texts: string[]) {
	const at = new Int32Array(texts.length + 1)
	for (let i = 0; i < texts.length; i++) at[i + 1] = at[i] + texts[i].length
	const units = new Uint16Array(at[texts.length])
	for (let i = 0; i < texts.length; i++) {
		const text = texts[i]
		for (let j = 0, k = at[i]; j < text.length; j++, k++)
			units[k] = text.charCodeAt(j)
	}
	return { units, at }
}

const unitsText = (units: Uint16Array, from: number, to: number) =>
	String.fromCharCode.apply(
		null,
		units.subarray(from, to) as unknown as number[],
	)

/** Alias i's name as stored. */
export const aliasName = (table: AliasTable, i: number) =>
	unitsText(table.nameUnits, table.nameAt[i], table.nameAt[i + 1])

/** Alias i's squashed fold (squashedFold). */
export const aliasSquashed = (table: AliasTable, i: number) =>
	unitsText(table.squashedUnits, table.squashedAt[i], table.squashedAt[i + 1])

/** Whether alias i's squashed fold has `text` at `from` (an offset into it), as String.startsWith. */
function squashedHas(
	table: AliasTable,
	i: number,
	text: string,
	from: number,
): boolean {
	const start = table.squashedAt[i] + from
	if (start + text.length > table.squashedAt[i + 1]) return false
	const units = table.squashedUnits
	for (let j = 0; j < text.length; j++)
		if (units[start + j] !== text.charCodeAt(j)) return false
	return true
}

// The first two characters (UTF-16 units) at a word start of a squashed name: a name matches a typed prefix only from
// a word start (title-prefix.server.ts nameTier), so the prefix's first two characters pick its candidates.
const GRAM = 2

/** For each gram, the aliases with it at a word start, in table order. */
function gramIndex(
	squashed: string[],
	wordStarts: Uint16Array,
	startAt: Int32Array,
): Pick<AliasTable, "grams" | "gramStart" | "gramAliases"> {
	const lists = new Map<string, number[]>()
	for (let i = 0; i < squashed.length; i++) {
		const seen = new Set<string>()
		for (let k = startAt[i]; k < startAt[i + 1]; k++) {
			const gram = squashed[i].slice(wordStarts[k], wordStarts[k] + GRAM)
			if (!gram || seen.has(gram)) continue
			seen.add(gram)
			const list = lists.get(gram)
			if (list) list.push(i)
			else lists.set(gram, [i])
		}
	}
	const grams = [...lists.keys()].sort()
	const gramStart = new Int32Array(grams.length + 1)
	grams.forEach((gram, g) => {
		gramStart[g + 1] = gramStart[g] + (lists.get(gram) as number[]).length
	})
	const gramAliases = new Int32Array(gramStart[grams.length])
	grams.forEach((gram, g) => {
		gramAliases.set(lists.get(gram) as number[], gramStart[g])
	})
	return { grams, gramStart, gramAliases }
}

/** The aliases ordered by length, and where each length starts, for the fuzzy match's length window. */
function lengthOrder(
	lengths: Uint16Array,
): Pick<AliasTable, "byLength" | "lengthStart"> {
	let longest = 0
	for (const n of lengths) longest = Math.max(longest, n)
	const lengthStart = new Int32Array(longest + 2)
	for (const n of lengths) lengthStart[n + 1]++
	for (let n = 0; n <= longest; n++) lengthStart[n + 1] += lengthStart[n]
	const byLength = new Int32Array(lengths.length)
	const next = lengthStart.slice(0, longest + 1)
	lengths.forEach((n, i) => {
		byLength[next[n]++] = i
	})
	return { byLength, lengthStart }
}

/**
 * The aliases a squashed prefix can match (nameTier still decides): those with its first two characters at a word
 * start; every alias for a one-character prefix.
 */
export function aliasCandidates(
	table: AliasTable,
	prefix: string,
): ArrayLike<number> {
	if (prefix.length < GRAM)
		return Int32Array.from({ length: table.size }, (_, i) => i)
	const g = gramOf(table, prefix.slice(0, GRAM))
	return g < 0
		? new Int32Array(0)
		: table.gramAliases.subarray(table.gramStart[g], table.gramStart[g + 1])
}

function gramOf(table: AliasTable, gram: string): number {
	const { grams } = table
	let lo = 0
	let hi = grams.length
	while (lo < hi) {
		const mid = (lo + hi) >>> 1
		if (grams[mid] < gram) lo = mid + 1
		else hi = mid
	}
	return grams[lo] === gram ? lo : -1
}

/**
 * The build's alias table, or none when its file is missing or doesn't fit the title table: the localized names are
 * extra recall, so they never keep a build from loading. Logs the loaded table (`readMs`: the file's read before), or
 * a warning when it is skipped.
 */
export function buildAliasTable(
	d: Json | undefined,
	titles: number,
	buildId: string,
	readMs = 0,
): AliasTable {
	if (!d) return emptyAliasTable(titles)
	const started = performance.now()
	try {
		const table = aliasTable(d, titles)
		console.info(
			`Search index build ${buildId} alias_table (alias_version ${table.version}, ${table.size} aliases) loaded in ${Math.round(readMs + performance.now() - started)} ms`,
		)
		return table
	} catch (error) {
		console.warn(
			`Search index build ${buildId}: alias_table skipped, searching without localized names`,
			error,
		)
		return emptyAliasTable(titles)
	}
}

export const matchedAlias = (table: AliasTable, i: number): MatchedAlias => ({
	text: aliasName(table, i),
	language: table.languageNames[table.languages[i]],
})

/**
 * Where a squashed prefix starts alias i: 0 at its start, 1 at the start of a later word, -1 nowhere (nameTier in
 * title-prefix.server.ts, without building the word list).
 */
export function aliasTier(
	table: AliasTable,
	i: number,
	prefix: string,
): 0 | 1 | -1 {
	if (!prefix) return -1
	if (squashedHas(table, i, prefix, 0)) return 0
	for (let k = table.startAt[i] + 1; k < table.startAt[i + 1]; k++)
		if (squashedHas(table, i, prefix, table.wordStarts[k])) return 1
	return -1
}

/** The aliases whose squashed fold is exactly `key`, in table order (which is row order). */
export function exactAliases(table: AliasTable, key: string): number[] {
	if (!key) return []
	const out: number[] = []
	const g = gramOf(table, key.slice(0, GRAM))
	if (g < 0) return out
	for (let k = table.gramStart[g]; k < table.gramStart[g + 1]; k++) {
		const i = table.gramAliases[k]
		if (
			table.squashedAt[i + 1] - table.squashedAt[i] === key.length &&
			squashedHas(table, i, key, 0)
		)
			out.push(i)
	}
	return out
}

/**
 * The "like X" reference a normalized key names by a localized name: the row with the most votes among the titles with
 * an alias that is the key (folded, spaces aside) and enough votes, or undefined. Asked only after the titles.
 */
export function aliasReference(
	index: SearchIndex,
	key: string,
): number | undefined {
	const { votes } = index.titleTable
	let best: number | undefined
	for (const i of exactAliases(index.aliases, squashedFold(key))) {
		const row = index.aliases.rows[i]
		if (votes[row] < REFERENCE_TITLE_VOTES) continue
		if (best === undefined || votes[row] > votes[best]) best = row
	}
	return best
}
