// The final title lookup may arrive after the scored candidates. Keep the original head/tail blend unchanged.
//
// In Discover's longer list (past RESULT_LENGTH), a concept search (concept-query.server.ts) keeps its first
// CONCEPT_HEAD titles and after them only the titles that carry the concept's label: the ranked pool is wide (its top
// lists reach 500 deep), and Discover's other sorts and counts read the whole list, so "Best rated" for "time travel"
// listed every well-rated title the pool held (The Godfather Part II at 423) ahead of the time travel films. The search
// page's list (RESULT_LENGTH or shorter) is unchanged. A query with more words than a label ("funny pirates", "pirates
// not funny") is a concept search too when a phrase the reading searches for is one ("pirates"): without it, "Top
// rated" over "pirates 2020" sorted Folklore and The Owl House first. Several such phrases keep the titles of any.
import { conceptTitles } from "./concept-query.server.ts"
import {
	HEAD_LENGTH,
	RESULT_LENGTH,
	boundOwn,
	foldCuts,
} from "./ranking.server.ts"
import type { Reference } from "./references.server.ts"
import type { SearchIndex } from "./search-index.server.ts"
import { normalized, words } from "./text-rules.server.ts"
import {
	type TitleFacts,
	type TitleLookupRow,
	blend,
} from "./title-blend.server.ts"

/** How many titles of a concept search's Discover list stay whether or not they carry the label. */
export const CONCEPT_HEAD = 30

/** The titles of the query's concept, else of the searched phrases' concepts together; null when there is none. */
export function discoverConcept(
	index: Pick<SearchIndex, "negationLabels">,
	query: string,
	phrases: readonly string[],
): Set<number> | null {
	const whole = conceptTitles(index, query)
	if (whole) return whole
	// "The witches" is written as a title: its words found in a phrase don't make it a topic.
	if (/^(?:the|a|an)\s/i.test(query.trim())) return null
	let out: Set<number> | null = null
	for (const phrase of phrases) {
		const titles = conceptTitles(index, phrase)
		if (!titles) continue
		out ??= new Set()
		for (const id of titles) out.add(id)
	}
	return out
}

// Discover's mood words (discover-query.ts, the "moods" rows): Discover applies them as filters and keeps them in the
// search text ("funny pirates"), where they aren't the topic.
const MOOD_WORDS =
	/\b(?:funny|funnier|more humorous|make me laugh|hilarious|feel[- ]good|uplifting|comfort(?:ing)?|cozy|scary|scarier|frightening|mind[- ]bending|make me think|a good cry|melancholic|sad|romantic|coming[- ]of[- ]age)\b/gi

/**
 * The phrases that may name a Discover topic (discoverConcept): the reading's searched phrases, and the query and
 * each phrase without Discover's mood words ("funny pirates" → "pirates"). None that is negated ("funny no heist"),
 * and none when the query names a reference (a person, a studio, "like X").
 */
export function topicPhrases(
	query: string,
	phrases: readonly string[],
	negated: readonly string[],
	reference: boolean,
): string[] {
	if (reference) return []
	const banned = new Set(negated.flatMap((n) => words(n)))
	const withoutMoods = (text: string) => {
		const rest = normalized(text.replace(MOOD_WORDS, " "))
		return rest && rest !== normalized(text) ? [rest] : []
	}
	return [
		...new Set(
			[
				...phrases,
				...withoutMoods(query),
				...phrases.flatMap(withoutMoods),
			].filter((f) => !words(f).some((w) => banned.has(w))),
		),
	]
}

/**
 * Discover's topic for a search: discoverConcept, except that a query that is a title's name ("Funny Games") is that
 * title's search, and its words make no topic of the phrases.
 */
export function discoverTopic(
	index: Pick<SearchIndex, "negationLabels">,
	query: string,
	phrases: readonly string[],
	titles: readonly TitleLookupRow[],
): Set<number> | null {
	const named = titles.some((row) =>
		[row.title, row.original].some(
			(n) => normalized(n ?? "") === normalized(query),
		),
	)
	return discoverConcept(index, query, named ? [] : phrases)
}

export function createSearchReblend(
	index: SearchIndex,
	query: string,
	ranked: number[],
	concrete: Set<string>,
	filterRows: Uint8Array,
	outsideFacts: Map<number, TitleFacts>,
	ref: Reference | null,
	limit = RESULT_LENGTH,
	/** The phrases the reading searches for (reading-retrieval's searchedPhrases). */
	phrases: readonly string[] = [],
) {
	const blended = (
		list: number[],
		titles: TitleLookupRow[],
		length = RESULT_LENGTH,
	) =>
		foldCuts(
			index,
			blend(
				index,
				query,
				titles,
				list,
				concrete,
				filterRows,
				outsideFacts,
				length,
			),
		)
	return (titles: TitleLookupRow[]) => {
		const concept =
			limit > RESULT_LENGTH
				? discoverTopic(index, query, phrases, titles)
				: null
		let head = blended(ranked.slice(0, HEAD_LENGTH), titles)
		if (ref) head = boundOwn(head, ref)
		head = head.slice(0, HEAD_LENGTH)
		const inHead = new Set(head.map((row) => row.id))
		// Preserve the existing first 100 exactly. Extra candidates may only extend that list.
		const first = [
			...head,
			...blended(ranked.slice(0, RESULT_LENGTH), titles).filter(
				(row) => !inHead.has(row.id),
			),
		].slice(0, RESULT_LENGTH)
		if (limit <= RESULT_LENGTH) return first
		const seen = new Set(first.map((row) => row.id))
		const list = [
			...first,
			...blended(ranked, titles, limit).filter((row) => !seen.has(row.id)),
		]
		return (
			concept
				? list.filter((row, i) => i < CONCEPT_HEAD || concept.has(row.id))
				: list
		).slice(0, limit)
	}
}
