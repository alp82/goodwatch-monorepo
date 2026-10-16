// Every word members read in Discover's taste rows (SideRows), in one place. A group's title is its trait name from
// the server ("Bleak, tense stories"); there is no summary line under it (owner, Q44). The wording is the owner's
// (#671): "taste", never "side".

const count = (n: number) => n.toLocaleString("en-US")

export const SIDE_ROWS_COPY = {
	/** The row of the titles that fit none of the member's groups. */
	noGroup: "More for you",
	/** Narrows Discover to the row's titles. */
	seeAll: (total: number) => `More like this · ${count(total)}`,
	/** Leaves the narrowed list for the rows. */
	backToAll: "All of your taste",
	/** Opens Watch next with the group's moods. */
	watchNext: "Open in Watch next",
}
