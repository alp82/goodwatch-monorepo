// The final title lookup may arrive after the scored candidates. Keep the original head/tail blend unchanged.
import { boundOwn, foldCuts, HEAD_LENGTH, RESULT_LENGTH } from "./ranking.server.ts"
import type { Reference } from "./references.server.ts"
import type { SearchIndex } from "./search-index.server.ts"
import { blend, type TitleFacts, type TitleLookupRow } from "./title-blend.server.ts"

export function createSearchReblend(
	index: SearchIndex,
	query: string,
	ranked: number[],
	concrete: Set<string>,
	filterRows: Uint8Array,
	outsideFacts: Map<number, TitleFacts>,
	ref: Reference | null,
) {
	const blended = (list: number[], titles: TitleLookupRow[]) =>
		foldCuts(index, blend(index, query, titles, list, concrete, filterRows, outsideFacts))
	return (titles: TitleLookupRow[]) => {
		let head = blended(ranked.slice(0, HEAD_LENGTH), titles)
		if (ref) head = boundOwn(head, ref)
		head = head.slice(0, HEAD_LENGTH)
		const inHead = new Set(head.map(row => row.id))
		return [...head, ...blended(ranked, titles).filter(row => !inHead.has(row.id))].slice(0, RESULT_LENGTH)
	}
}
