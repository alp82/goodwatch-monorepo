// The cast carousel moves in groups of 3, 4, 5, 6, 7 or 8 slides, depending on the width, and pads its
// last group with blank slides. 24 slides fill whole groups at 3, 4, 6 and 8, which covers phones and
// wide screens. So the document holds 24 slides: the whole cast if it has 24 people at most, or the
// first 23 people and the button that loads more.
export const CAST_DOCUMENT_SIZE = 24
/** How many people the document shows when the cast has more than CAST_DOCUMENT_SIZE people. */
export const CAST_FIRST_OFFSET = CAST_DOCUMENT_SIZE - 1
/** How many people one request for more loads. */
export const CAST_PAGE_SIZE = 120

/** The people of a cast that the document shows, out of the top-billed CAST_DOCUMENT_SIZE. */
export function documentCast<T>(topBilled: T[], total: number): T[] {
	return total > CAST_DOCUMENT_SIZE
		? topBilled.slice(0, CAST_FIRST_OFFSET)
		: topBilled
}

export function isTitleCastOffset(offset: number): boolean {
	return (
		Number.isSafeInteger(offset) &&
		offset >= CAST_FIRST_OFFSET &&
		Number.isSafeInteger(offset + CAST_PAGE_SIZE) &&
		(offset - CAST_FIRST_OFFSET) % CAST_PAGE_SIZE === 0
	)
}
export function nextCastOffset(offset: number, total: number): number | null {
	return offset + CAST_PAGE_SIZE < total ? offset + CAST_PAGE_SIZE : null
}
export interface TitleCastParams {
	mediaType: "movie" | "show"
	tmdbId: string
	offset: number
}
export function titleCastUrl({
	mediaType,
	tmdbId,
	offset,
}: TitleCastParams): string {
	return `/api/title-cast?${new URLSearchParams({ mediaType, tmdbId: String(tmdbId), offset: String(offset) })}`
}
export function parseTitleCastParams(search: URLSearchParams): TitleCastParams {
	const mediaType = search.get("mediaType")
	const tmdbId = search.get("tmdbId") ?? ""
	const rawOffset = search.get("offset") ?? ""
	const offset = Number(rawOffset)
	if (
		(mediaType !== "movie" && mediaType !== "show") ||
		!/^\d+$/.test(tmdbId) ||
		!Number.isSafeInteger(Number(tmdbId)) ||
		!/^\d+$/.test(rawOffset) ||
		!isTitleCastOffset(offset)
	)
		throw new Response("Invalid cast parameters", { status: 400 })
	return { mediaType, tmdbId, offset }
}

/** One page of the cast beyond the document's part, as /api/title-cast answers. */
export interface TitleCastPage {
	cast: {
		id: number
		name: string
		characters: string[]
		profile_path: string
	}[]
	total: number
	offset: number
	nextOffset: number | null
}

/**
 * How many more people the carousel can still load. `hasMore` is what the last loaded page says
 * about a next page; before any page is loaded, the total alone decides.
 */
export function remainingCast({
	shown,
	total,
	hasMore,
}: {
	shown: number
	total: number
	hasMore?: boolean
}): number {
	if (hasMore === false) return 0
	// A page can hold fewer people than the total promised (the cast changed in between): keep at
	// least one, so the button stays while another page exists.
	return Math.max(hasMore ? 1 : 0, total - shown)
}
