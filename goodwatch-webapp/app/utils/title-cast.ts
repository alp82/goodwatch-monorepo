// The cast carousel moves in groups of 3, 4, 5, 6, 7 or 8 slides, depending on the width, and pads its
// last group with blank slides. 24 slides fill whole groups at 3, 4, 6 and 8, which covers phones and
// wide screens. So the document holds 24 slides: the whole cast if it has 24 people at most, or the
// first 23 people and one more slide for the rest.
export const CAST_DOCUMENT_SIZE = 24
/** How many people the document shows when the cast has more than CAST_DOCUMENT_SIZE people. */
export const CAST_FIRST_OFFSET = CAST_DOCUMENT_SIZE - 1
/** The people of a cast that the document shows, out of the top-billed CAST_DOCUMENT_SIZE. */
export function documentCast<T>(topBilled: T[], total: number): T[] {
	return total > CAST_DOCUMENT_SIZE
		? topBilled.slice(0, CAST_FIRST_OFFSET)
		: topBilled
}
