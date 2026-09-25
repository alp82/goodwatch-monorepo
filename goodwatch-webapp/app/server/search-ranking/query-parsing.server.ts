// Reads the search text: language, negated clauses, a decade or year, spelling, and the facets of Jev's searched
// phrases. Pure functions over the query and the loaded search index.
import negationWords from "./negation-words.json"
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
// ("than": "more getaway driver than superheroes"; "less": "like david lynch but less weird"). Spanish and French
// "ni" starts a second clause inside one ("sin animación ni detectives"). An ordinal ("2.") doesn't end a clause.
//
// Turkish negates after the element. A postposition ("zombi olmadan", "zombi yok", "robot olmayan") negates the
// content word before it when that names a known element, skipping function words ("ile ilgili"). A compound head
// ("seks sahnesi", "dünya savaşı") or the start of a known phrase ("süper kahraman", "2. dünya savaşı") takes the word
// before it too, and an ordinal before that ("ikinci"). A "-sız / -siz / -suz / -süz" word negates its stem when the
// stem is a known element ("zombisiz").
const NEGATION_WORDS = new Set(
	"no not without except minus nothing than less fewer isn't aren't don't doesn't ohne nicht kein keine keinen keiner sans pas aucun aucune ni sin nada".split(
		" ",
	),
)
const CLAUSE_END = new Set(
	"but and aber und mais et pero y ama fakat ancak ve".split(" "),
)
// Folded, like the negation word list
const NEGATION_AFTER = new Set("olmadan olmayan yok degil icermeyen".split(" "))
const NEGATION_SUFFIXES = ["siz", "suz"]
// "Fearless", and Daredevil's Turkish title
const NEGATION_SUFFIX_EXCEPT = new Set(["korkusuz"])
const TRIM = /^[,.;:!?\-()"]+|[,.;:!?\-()"]+$/g
const ORDINAL = /^\d+\.$/
const clean = (token: string) => token.replace(TRIM, "").toLowerCase()
const endsClause = (token: string) =>
	",.;!?".includes(token[token.length - 1]) && !ORDINAL.test(token)

/** Lowercase, no diacritics, Turkish dotless i as i, ß as ss: the form of the negation word list. */
export function foldWord(word: string): string {
	return word
		.toLowerCase()
		.replace(/ı/g, "i")
		.replace(/ß/g, "ss")
		.normalize("NFKD")
		.replace(/\p{Mn}/gu, "")
}

type ElementForms = Record<string, Record<string, string[]>>

interface ElementIndex {
	forms: Map<string, string>
	byLanguage: Map<string, Map<string, string>>
}

function elementIndex(elements: ElementForms): ElementIndex {
	const forms = new Map<string, string>()
	const byLanguage = new Map<string, Map<string, string>>()
	for (const [english, languages] of Object.entries(elements)) {
		for (const [language, list] of Object.entries(languages)) {
			if (!byLanguage.has(language)) byLanguage.set(language, new Map())
			for (const form of list) {
				forms.set(form, english)
				byLanguage.get(language)?.set(form, english)
			}
		}
	}
	return { forms, byLanguage }
}

const allWords = (lists: Record<string, string[]>) =>
	new Set(Object.values(lists).flat())

// German, French, Spanish and Turkish words for common content elements (#169). The arena prototype reads the same
// file. The nonEnglish lists apply only to searches routed non-English, because their words are English words too.
const NEGATION_LIST = {
	all: elementIndex(negationWords.elements),
	nonEnglish: elementIndex(negationWords.nonEnglishElements as ElementForms),
	functionWords: allWords(negationWords.functionWords),
	nonEnglishFunctionWords: allWords(negationWords.nonEnglishFunctionWords),
	phrases: new Map(Object.entries(negationWords.phrases)),
	// Every start of 2 or more words of a phrase
	phraseStarts: new Set(
		Object.keys(negationWords.phrases).flatMap((k) => {
			const ws = k.split(" ")
			return ws.slice(1).map((_, i) => ws.slice(0, i + 2).join(" "))
		}),
	),
	suffixes: Object.entries(negationWords.suffixes),
}
const LISTED = new Set([
	...NEGATION_LIST.all.forms.keys(),
	...NEGATION_LIST.nonEnglish.forms.keys(),
	...NEGATION_LIST.functionWords,
	...NEGATION_LIST.nonEnglishFunctionWords,
	...[...NEGATION_LIST.phrases.keys()].flatMap((k) => k.split(" ")),
])

/**
 * The English words for one word when it's a known element form, else null. A word that isn't listed as it is may be
 * a listed form plus one of its language's suffixes ("Außerirdischen", "sahnesi").
 */
export function elementEnglish(
	word: string,
	nonEnglish = false,
): string | null {
	const w = foldWord(word)
	const indexes = nonEnglish
		? [NEGATION_LIST.all, NEGATION_LIST.nonEnglish]
		: [NEGATION_LIST.all]
	for (const { forms, byLanguage } of indexes) {
		const direct = forms.get(w)
		if (direct !== undefined) return direct
		for (const [language, suffixes] of NEGATION_LIST.suffixes) {
			for (const suffix of suffixes) {
				if (!w.endsWith(suffix) || length(w) - suffix.length < 3) continue
				const base = byLanguage.get(language)?.get(w.slice(0, -suffix.length))
				if (base !== undefined) return base
			}
		}
	}
	return null
}

/** The stem of a Turkish "-sız" word ("zombisiz" -> "zombi"), else null. The stem isn't checked. */
function suffixStem(word: string): string | null {
	const f = foldWord(word)
	if (
		NEGATION_SUFFIXES.some((s) => f.endsWith(s)) &&
		length(f) > 5 &&
		!NEGATION_SUFFIX_EXCEPT.has(f)
	)
		return [...word.toLowerCase()].slice(0, -3).join("")
	return null
}

/**
 * A word spell correction leaves alone: a negation or clause-end marker, a word of the negation word list, or a known
 * element with a Turkish "-sız" suffix ("seks" stays, not "seeks"; "kein" stays, not "keen").
 */
function negationForm(word: string): boolean {
	const f = foldWord(word)
	const stem = suffixStem(word)
	return (
		NEGATION_WORDS.has(word) ||
		CLAUSE_END.has(word) ||
		NEGATION_AFTER.has(f) ||
		LISTED.has(f) ||
		elementEnglish(word, true) !== null ||
		(stem !== null && elementEnglish(stem) !== null)
	)
}

/**
 * A negated phrase with its known non-English element words and phrases in English and, when it has one, its
 * non-English function words dropped ("de zombis" -> "zombie", "zweiten weltkrieg" -> "ii world war"). A phrase
 * without a known element comes back as it is. nonEnglish: the search is routed non-English, which adds the words that
 * are also English words ("terror" -> "horror").
 */
export function englishNegation(phrase: string, nonEnglish = false): string {
	const { english, hit } = englishElements(phrase, nonEnglish)
	return hit ? english : phrase
}

/** (the phrase with known elements in English and function words dropped, whether it holds a known element). */
function englishElements(
	phrase: string,
	nonEnglish: boolean,
): { english: string; hit: boolean } {
	const ws = words(phrase.replace(/\u0307/g, "")) // "İkinci" lowercases to i + a combining dot
	const isFunction = (w: string) =>
		NEGATION_LIST.functionWords.has(w) ||
		(nonEnglish && NEGATION_LIST.nonEnglishFunctionWords.has(w))
	const out: string[] = []
	let hit = false
	let i = 0
	while (i < ws.length) {
		let matched = false
		for (const n of [3, 2]) {
			if (i + n > ws.length) continue
			const english = NEGATION_LIST.phrases.get(
				ws
					.slice(i, i + n)
					.map(foldWord)
					.join(" "),
			)
			if (english !== undefined) {
				out.push(english)
				hit = true
				i += n
				matched = true
				break
			}
		}
		if (matched) continue
		const w = ws[i++]
		const english = elementEnglish(w, nonEnglish)
		if (english !== null) {
			out.push(english)
			hit = true
		} else if (!isFunction(foldWord(w))) out.push(w)
	}
	return { english: out.join(" "), hit }
}

/**
 * The words before a Turkish postposition that it negates, taken off the end of positive. [] when they don't name a
 * known element: "aşırı duygusal olmayan" (not too emotional) stays positive, since a negated Turkish tone word would
 * mostly push away Turkish titles in the multilingual embedding.
 */
function turkishElement(positive: string[]): string[] {
	const core: string[] = []
	const skipped: string[] = []
	while (positive.length && core.length < 3) {
		const prev = positive[positive.length - 1]
		const pw = clean(prev)
		if (
			CLAUSE_END.has(pw) ||
			(endsClause(prev) && (core.length || skipped.length))
		)
			break
		if (!core.length && NEGATION_LIST.functionWords.has(foldWord(pw)))
			skipped.unshift(pw)
		else if (!core.length) core.push(pw)
		else {
			const f0 = foldWord(core[0])
			const fp = foldWord(pw)
			const head =
				!NEGATION_LIST.all.forms.has(f0) &&
				["si", "su", "i", "u"].some((s) => f0.endsWith(s)) &&
				length(f0) >= 5
			if (
				!(
					NEGATION_LIST.phraseStarts.has(`${fp} ${f0}`) ||
					head ||
					elementEnglish(pw) === "ii"
				)
			)
				break
			core.unshift(pw)
		}
		positive.pop()
	}
	if (!core.length || !englishElements(core.join(" "), false).hit) {
		positive.push(...core, ...skipped)
		return []
	}
	return [...core, ...skipped]
}

/** (positive text, negated clauses), over whitespace tokens. Without a marker: (text, []). */
export function splitNegation(text: string): {
	positive: string
	negated: string[]
} {
	const positive: string[] = []
	const negated: string[][] = []
	let clause: string[] | null = null
	const popClauseEnd = () => {
		if (
			positive.length &&
			CLAUSE_END.has(
				positive[positive.length - 1].replace(/^,+|,+$/g, "").toLowerCase(),
			)
		)
			positive.pop()
	}
	for (const token of text.replace(/’/g, "'").split(/\s+/).filter(Boolean)) {
		const w = clean(token)
		if (clause !== null && CLAUSE_END.has(w)) clause = null
		if (clause === null && NEGATION_AFTER.has(foldWord(w)) && positive.length) {
			const element = turkishElement(positive)
			if (element.length) {
				negated.push(element)
				popClauseEnd()
			} else positive.push(token)
			continue
		}
		const stem = clause === null ? suffixStem(w) : null
		if (stem !== null) {
			const before = positive.length
				? clean(positive[positive.length - 1])
				: null
			if (
				before !== null &&
				NEGATION_LIST.phrases.has(`${foldWord(before)} ${foldWord(stem)}`)
			) {
				// "süper kahramansız"
				positive.pop()
				negated.push([before, stem])
				continue
			}
			if (elementEnglish(stem) !== null) {
				negated.push([stem])
				continue
			}
		}
		if (clause?.length && w === "ni") {
			clause = []
			negated.push(clause)
		} else if (clause === null && NEGATION_WORDS.has(w)) {
			clause = []
			negated.push(clause)
			// "tense but not bleak" -> "tense"
			popClauseEnd()
		} else if (clause === null) positive.push(token)
		else if (w) clause.push(w)
		if (clause !== null && endsClause(token)) clause = null
	}
	return {
		positive: positive.join(" ") || text,
		negated: negated.filter((c) => c.length).map((c) => c.join(" ")),
	}
}

/**
 * Per point id, the share (capped at 1) of 2 keyword or essence-tag labels that hold every content stem of a negated
 * phrase ("aliens" hits "alien" and "alien invasion"). Stems compare in their singular() form, so "zombies" hits
 * "zombie". Known non-English element words match as their English words ("ohne Mord" hits "murder"); nonEnglish: the
 * search is routed non-English. Titles without a hit are absent.
 */
export function labelNegation(
	index: SearchIndex,
	phrase: string,
	nonEnglish = false,
): Map<number, number> {
	const out = new Map<number, number>()
	const want = [
		...new Set(tokens(englishNegation(phrase, nonEnglish)).map(singular)),
	]
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
 * An unknown word (ASCII letters, 4 or more, in fewer than 3 titles, not a word of the negation word list) becomes the vocabulary word one edit away with
 * the most titles; ties go to the first in vocabulary order.
 */
export function correctWord(index: SearchIndex, w: string): string {
	const { df, spellVocabulary, spellByLength } = index.words
	if (
		!ASCII_LETTERS.test(w) ||
		w.length < 4 ||
		(df.get(w) ?? 0) >= 3 ||
		negationForm(w)
	)
		return w
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
