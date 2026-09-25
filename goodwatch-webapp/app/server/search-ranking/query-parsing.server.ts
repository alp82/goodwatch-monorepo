// Reads the search text: language, negated clauses, a decade or year, spelling, and the facets of Jev's searched
// phrases. Pure functions over the query and the loaded search index.
import type { SearchIndex } from "./search-index.server.ts"
import {
	STOPWORDS,
	length,
	singular,
	stem,
	tokens,
	words,
} from "./text-rules.server.ts"

// --- Language -----------------------------------------------------------------------------------------------------

const FOREIGN_MARKERS = [
	"un une le la les des du de pour avec sans et est pas qui que toute tout tous dans sur drôle film série",
	"ich ein eine einen der die das und nicht aber mit ohne etwas mich für ist sehr am ende",
	"una uno el la los las y con sin que quiero para por serie película muy algo",
].map((list) => new Set(list.split(" ")))
const ENGLISH_MARKERS = new Set(
	"the a an and with without of for to in on is it that this something i me my".split(
		" ",
	),
)

/** Two or more French, German or Spanish marker words, and more of them than English ones. */
export function looksForeign(text: string): boolean {
	const ws = words(text)
	const english = ws.filter((w) => ENGLISH_MARKERS.has(w)).length
	const best = Math.max(
		...FOREIGN_MARKERS.map(
			(markers) => ws.filter((w) => markers.has(w)).length,
		),
	)
	return best >= 2 && best > english
}

export interface ReadingChipLike {
	text: string
	kind: string
}

/** The English text of Jev's chips: what the reading wants, and the avoided terms. */
export function englishFromChips(chips: ReadingChipLike[]): {
	positive: string
	avoided: string[]
} {
	const positive: string[] = []
	const avoided: string[] = []
	for (const chip of chips) {
		if (chip.kind === "want" || chip.kind === "attribute")
			positive.push(chip.text)
		else if (chip.kind === "avoid" || chip.kind === "excluded")
			avoided.push(chip.text.replace(/^Low /, "").replace(/^Not /, ""))
	}
	return { positive: positive.join(", "), avoided }
}

// --- Negation -----------------------------------------------------------------------------------------------------

// A marker word opens a negated clause; the clause runs to a clause-end word or a token ending in , . ; ! ?
// ("than": "more getaway driver than superheroes"; "less": "like david lynch but less weird").
const NEGATION_WORDS = new Set(
	"no not without except minus nothing than less fewer isn't aren't don't doesn't ohne nicht kein keine keinen keiner sans pas ni sin".split(
		" ",
	),
)
const CLAUSE_END = new Set("but and aber und mais et pero y".split(" "))
const TRIM = /^[,.;:!?\-()"]+|[,.;:!?\-()"]+$/g

/** (positive text, negated clauses), over whitespace tokens. Without a marker: (text, []). */
export function splitNegation(text: string): {
	positive: string
	negated: string[]
} {
	const positive: string[] = []
	const negated: string[][] = []
	let clause: string[] | null = null
	for (const token of text.replace(/’/g, "'").split(/\s+/).filter(Boolean)) {
		const w = token.replace(TRIM, "").toLowerCase()
		if (clause !== null && CLAUSE_END.has(w)) clause = null
		if (clause === null && NEGATION_WORDS.has(w)) {
			clause = []
			negated.push(clause)
			// "tense but not bleak" -> "tense"
			if (
				positive.length &&
				CLAUSE_END.has(
					positive[positive.length - 1].replace(/^,+|,+$/g, "").toLowerCase(),
				)
			)
				positive.pop()
		} else if (clause === null) positive.push(token)
		else if (w) clause.push(w)
		if (clause !== null && ",.;!?".includes(token[token.length - 1]))
			clause = null
	}
	return {
		positive: positive.join(" ") || text,
		negated: negated.filter((c) => c.length).map((c) => c.join(" ")),
	}
}

/**
 * Per point id, the share (capped at 1) of 2 keyword or essence-tag labels that hold every content stem of a negated
 * phrase ("aliens" hits "alien" and "alien invasion"). Stems compare in their singular() form, so "zombies" hits
 * "zombie". Titles without a hit are absent.
 */
export function labelNegation(
	index: SearchIndex,
	phrase: string,
): Map<number, number> {
	const out = new Map<number, number>()
	const want = [...new Set(tokens(phrase).map(singular))]
	if (!want.length) return out
	const { labelsWithStem, titles } = index.negationLabels
	let hit: Set<number> | null = null
	for (const s of want) {
		const labels = labelsWithStem.get(s) ?? []
		hit =
			hit === null
				? new Set(labels)
				: new Set(labels.filter((l) => hit?.has(l)))
		if (!hit.size) return out
	}
	for (const label of hit ?? []) {
		for (const id of titles[label]) out.set(id, (out.get(id) ?? 0) + 1)
	}
	for (const [id, n] of out) out.set(id, Math.min(1, n / 2))
	return out
}

// --- Era ----------------------------------------------------------------------------------------------------------

// A decade ("80s", "1980s", "'80s", "80er", "2000s") or a year ("1994").
const ERA =
	/(?<![\p{L}\p{N}_])(?:(19|20)?(\d)0(?:'?s|’s|er)|(19\d\d|20\d\d))(?![\p{L}\p{N}_])/iu

/** The years a decade or year in the query names, or null. */
export function eraRange(text: string): { from: number; to: number } | null {
	const m = ERA.exec(text)
	if (!m) return null
	if (m[3]) return { from: Number(m[3]), to: Number(m[3]) }
	const century = m[1] ? Number(m[1]) : Number(m[2]) >= 2 ? 19 : 20
	const from = century * 100 + 10 * Number(m[2])
	return { from, to: from + 9 }
}

// --- Spelling -----------------------------------------------------------------------------------------------------

const ASCII_LETTERS = /^[A-Za-z]+$/

/** True when a and b are one edit apart: one insertion, deletion, substitution or swap of adjacent letters. */
function oneEdit(a: string, b: string): boolean {
	if (a === b) return false
	if (a.length === b.length) {
		let i = 0
		while (a[i] === b[i]) i++
		if (a.slice(i + 1) === b.slice(i + 1)) return true
		return (
			a[i] === b[i + 1] &&
			a[i + 1] === b[i] &&
			a.slice(i + 2) === b.slice(i + 2)
		)
	}
	const [short, long] = a.length < b.length ? [a, b] : [b, a]
	if (long.length - short.length !== 1) return false
	let i = 0
	while (i < short.length && short[i] === long[i]) i++
	return short.slice(i) === long.slice(i + 1)
}

/**
 * An unknown word (ASCII letters, 4 or more, in fewer than 3 titles) becomes the vocabulary word one edit away with
 * the most titles; ties go to the first in vocabulary order.
 */
export function correctWord(index: SearchIndex, w: string): string {
	const { df, spellVocabulary, spellByLength } = index.words
	if (!ASCII_LETTERS.test(w) || w.length < 4 || (df.get(w) ?? 0) >= 3) return w
	let best = -1
	let bestDf = -1
	for (const len of [w.length - 1, w.length, w.length + 1]) {
		for (const i of spellByLength.get(len) ?? []) {
			const candidate = spellVocabulary[i]
			if (!oneEdit(w, candidate)) continue
			const d = df.get(candidate) ?? 0
			if (d > bestDf || (d === bestDf && i < best)) {
				best = i
				bestDf = d
			}
		}
	}
	return best < 0 ? w : spellVocabulary[best]
}

/** The text with each word spell-corrected (see correctWord); unchanged words keep their case. */
export function spell(index: SearchIndex, text: string): string {
	return text.replace(/[\p{L}\p{N}]+/gu, (w) => {
		const corrected = correctWord(index, w.toLowerCase())
		return corrected !== w.toLowerCase() ? corrected : w
	})
}

// --- Facets ---------------------------------------------------------------------------------------------------------

// Facets need at least this many searched phrases.
const FACET_MIN_PHRASES = 2
const GENERIC = new Set(
	"good great best nice watch movie film show series something kind type style whole takes place one stuff story stories tv people person big two first short absolutely".split(
		" ",
	),
)

/** Jev's searched phrases without negated words or the reference's words; [] when fewer than 2 remain. */
export function facets(
	searchedPhrases: string[],
	negated: string[],
	skip: Set<string>,
): string[] {
	const banned = new Set([...negated.flatMap((n) => words(n)), ...skip])
	const out = searchedPhrases.filter(
		(f) => !words(f).some((w) => banned.has(w)),
	)
	return out.length >= FACET_MIN_PHRASES ? out : []
}

/**
 * The content units of Jev's searched phrases: spell-corrected content words, with two adjacent words that form a
 * collocation kept as one unit, deduplicated and without negated words; [] when fewer than 2.
 */
export function facetUnits(
	index: SearchIndex,
	searchedPhrases: string[],
	negated: string[],
): string[] {
	const banned = new Set(negated.flatMap((n) => words(n)))
	const units: string[] = []
	for (const phrase of searchedPhrases) {
		const ws = words(phrase)
			.map((w) => correctWord(index, w))
			.filter(
				(w) =>
					!STOPWORDS.has(w) &&
					!GENERIC.has(w) &&
					!banned.has(w) &&
					length(w) > 1 &&
					!/^\p{Nd}/u.test(w),
			)
		let i = 0
		while (i < ws.length) {
			let unit: string
			if (
				i + 1 < ws.length &&
				index.collocations.has(`${stem(ws[i])}_${stem(ws[i + 1])}`)
			) {
				unit = `${ws[i]} ${ws[i + 1]}`
				i += 2
			} else {
				unit = ws[i]
				i += 1
			}
			const overlaps = units.some(
				(x) =>
					(x.includes(" ") || unit.includes(" ")) &&
					(x.split(" ").includes(unit) || unit.split(" ").includes(x)),
			)
			if (!units.includes(unit) && !overlaps) units.push(unit)
		}
	}
	return units.length >= 2 ? units : []
}
