// PROTOTYPE - throwaway (#659). The one place for the words (owner, 2026-10-16): everything is "taste". A title in
// one of the member's groups is "In your taste"; near one, "Close to your taste" (the edge). A group is shown by the
// posters of titles the member loved; its trait name ("Bleak, tense stories") is descriptive, so it shows only behind
// the names toggle until the words test (#656) passes. No share line anywhere.

export const TASTE = {
	in: "In your taste",
	/** Round 4's badge on a title in the taste picked. */
	fits: "Fits your taste",
	close: "Close to your taste",
	/** For the middle of a sentence. */
	inline: "in your taste",
	/** The cluster or control that holds the groups. */
	heading: "Your taste",
} as const

/** What a group is called in words: its trait name with the names on, else "In your taste" (its posters tell it apart). */
export const groupTitle = (group: { name: string }, names: boolean) =>
	names ? group.name : TASTE.in
