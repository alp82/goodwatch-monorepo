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
	boundOwn,
	foldCuts,
	HEAD_LENGTH,
	RESULT_LENGTH,
} from "./ranking.server.ts"
import type { Reference } from "./references.server.ts"
import type { SearchIndex } from "./search-index.server.ts"
import {
	blend,
	type TitleFacts,
	type TitleLookupRow,
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
	const concept =
		limit > RESULT_LENGTH ? discoverConcept(index, query, phrases) : null
	return (titles: TitleLookupRow[]) => {
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
