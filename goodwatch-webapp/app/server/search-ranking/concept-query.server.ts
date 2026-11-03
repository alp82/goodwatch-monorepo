// A concept search: a query whose words are exactly the words of a keyword or essence-tag label that many titles
// carry ("time travel", "heist", "zombies"). Such a query asks for the subject, so a title merely named after it isn't
// what was asked for (see title-blend.server.ts). The labels are the index's negation labels (search-index.server.ts),
// which the "without X" search reads too.
import type { SearchIndex } from "./search-index.server.ts"
import {
	STOPWORDS,
	length,
	singular,
	tokens,
	words,
} from "./text-rules.server.ts"

/** A label needs this many titles before its words read as a concept rather than a name. */
export const CONCEPT_MIN_TITLES = 15
// In a concept search, an exact title lifts its title only with this many votes (the title table's votes, summed over
// the sources: Inception has 7.7M, Submarine (2011), which isn't about submarines, 113k).
export const CONCEPT_TITLE_VOTES = 500_000

const stemCounts = new WeakMap<SearchIndex["negationLabels"], Uint16Array>()
function labelStemCounts(labels: SearchIndex["negationLabels"]): Uint16Array {
	let counts = stemCounts.get(labels)
	if (!counts) {
		counts = new Uint16Array(labels.titles.length)
		for (const list of labels.labelsWithStem.values())
			for (const label of list) counts[label]++
		stemCounts.set(labels, counts)
	}
	return counts
}

/**
 * The query's content stems in the labels' singular form, without digits; none when a word is neither a content word
 * nor a stopword ("hunter x hunter": the "x" says it's a name).
 */
function conceptStems(query: string): string[] {
	if (
		words(query).some(
			(w) => !STOPWORDS.has(w) && !/^\p{Nd}+$/u.test(w) && length(w) < 2,
		)
	)
		return []
	return [
		...new Set(
			tokens(query)
				.filter((t) => !/^\p{Nd}+$/u.test(t))
				.map(singular),
		),
	]
}

/**
 * The point ids of the titles that carry a label named exactly by the query's content words, when such labels hold
 * at least CONCEPT_MIN_TITLES titles together; else null. Format words ("movies", "shows") don't count, as in tokens().
 * A query that starts with an article reads as a title.
 */
export function conceptTitles(
	index: Pick<SearchIndex, "negationLabels">,
	query: string,
): Set<number> | null {
	// "the witches" is written as a title.
	if (/^(?:the|a|an)\s/i.test(query.trim())) return null
	const stems = conceptStems(query)
	if (!stems.length) return null
	const { labelsWithStem, titles } = index.negationLabels
	const counts = labelStemCounts(index.negationLabels)
	let candidates: number[] | null = null
	for (const s of stems) {
		const labels = labelsWithStem.get(s)
		if (!labels) return null
		candidates =
			candidates === null
				? labels
				: labels.filter((l) => (candidates as number[]).includes(l))
		if (!candidates.length) return null
	}
	const out = new Set<number>()
	for (const label of candidates ?? [])
		if (counts[label] === stems.length)
			for (const id of titles[label]) out.add(id)
	return out.size >= CONCEPT_MIN_TITLES ? out : null
}

/**
 * Whether the title matches shown before the ranking may show a title, by the blend's concept rule: in a concept
 * search only the exact title of a well-known title (pointId, its lexical title match). Null when every match may show.
 */
export function earlyTitleRule(
	index: SearchIndex,
	query: string,
): ((pointId: number, lexical: number) => boolean) | null {
	if (!conceptTitles(index, query)) return null
	const t = index.titleTable
	return (pointId, lexical) => {
		const row = t.rowOf.get(pointId)
		return (
			lexical >= 2 && row !== undefined && t.votes[row] >= CONCEPT_TITLE_VOTES
		)
	}
}
