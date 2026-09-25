// The text rules the search indexes were built with. They must match Windmill's f/search/terms and
// f/search/index_builders exactly, or query terms and name keys won't find their index entries. See "Index files" in
// docs/implementation/search-ranking/README.md.
//
// Python's `[^\W_]+` matches runs of Unicode letters and numbers, which is `[\p{L}\p{N}]+` here. Lengths count code
// points, as Python's len() does.

const WORD = /[\p{L}\p{N}]+/gu

/** The lowercased runs of letters and digits. */
export function words(text: string | null | undefined): string[] {
	return (text ?? "").toLowerCase().match(WORD) ?? []
}

/** The words joined with single spaces. */
export function normalized(text: string | null | undefined): string {
	return words(text).join(" ")
}

const COMBINING = /\p{Mn}/gu
// A possessive 's (', ’ or `), when the s ends a word.
const POSSESSIVE = /['’`]s(?![\p{L}\p{N}_])/gu

/** Name keys: lowercase, strip diacritics, drop a possessive 's, "&" becomes "and", "+" a space. */
export function fold(text: string | null | undefined): string {
	const s = (text ?? "")
		.toLowerCase()
		.normalize("NFKD")
		.replace(COMBINING, "")
		.replace(POSSESSIVE, "")
		.replace(/&/g, " and ")
		.replace(/\+/g, " ")
	return (s.match(WORD) ?? []).join(" ")
}

export const STOPWORDS: ReadonlySet<string> = new Set(
	`a an the and or of to in on at for with without by from as is are was were be been being it its
this that these those there their them they he she his her him i me my we our you your do does did done not no nor but so
than too very can could would should will just about into over under after before through between during against up down
out off again further then once here where when why how all any both each few more most other some such only own same s t
don now also who whom which what while if because until get got make give want wants like something anything some kind
movie movies film films show shows series watch watching one ones really lot lots bit thing things feel feels`.split(
		/\s+/,
	),
)

const SUFFIXES: [string, string, number][] = [
	["ies", "y", 5],
	["sses", "ss", 5],
	["ness", "", 7],
	["ings", "", 7],
	["ing", "", 6],
	["edly", "", 7],
	["ed", "", 5],
	["ly", "", 6],
	["es", "e", 5],
	["s", "", 4],
]
const DIGITS = /^\p{Nd}+$/u

export const length = (s: string) => {
	let n = 0
	for (const _ of s) n++
	return n
}

/** Light suffix stemmer: plurals, -ing, -ed, -ly. */
export function stem(word: string): string {
	const n = length(word)
	if (n <= 3 || DIGITS.test(word)) return word
	for (const [suffix, replacement, minLength] of SUFFIXES) {
		if (word.endsWith(suffix) && n >= minLength) {
			if (
				suffix === "s" &&
				(word.endsWith("ss") || word.endsWith("us") || word.endsWith("is"))
			)
				return word
			if (
				suffix === "es" &&
				!["ches", "shes", "xes", "sses", "zes"].some((x) => word.endsWith(x))
			)
				return word.slice(0, -1)
			if (suffix === "es") return word.slice(0, -2)
			return word.slice(0, -suffix.length) + replacement
		}
	}
	return word
}

/** The stemmed content words of a text, in order, without stopwords. */
export function tokens(text: string | null | undefined): string[] {
	const out: string[] = []
	for (const word of words(text)) {
		if (STOPWORDS.has(word) || length(word) < 2) continue
		out.push(stem(word))
	}
	return out
}

/** Unigrams and adjacent bigrams of one text span. */
export function terms(text: string | null | undefined): string[] {
	const t = tokens(text)
	const out = [...t]
	for (let i = 0; i + 1 < t.length; i++) out.push(`${t[i]}_${t[i + 1]}`)
	return out
}

/** The distinct terms of a query text, in first-seen order. */
export function queryTerms(text: string): string[] {
	return [...new Set(terms(text))]
}
