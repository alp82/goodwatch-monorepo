// Every word members read in Discover's Sides of you rows (SideRows), in one place: the wording is still being
// decided (#671), and side names wait on the words gate (#656), so they arrive from the server only when it's on.

const count = (n: number) => n.toLocaleString("en-US")

export const SIDE_ROWS_COPY = {
	/** A side's label when the server sends no name: "Side 2". */
	side: (number: number) => `Side ${number}`,
	/** The row of titles that fit no side. */
	noSide: "More for you",
	/** Under a side's label: its share of what the member loves and its titles in this list. */
	sideLine: (share: number, total: number) =>
		`${Math.round(share * 100)}% of what you love · ${count(total)} in this list`,
	/** Under the no-side row's label. */
	noSideLine: (total: number) =>
		`Fits none of your sides · ${count(total)} in this list`,
	/** Narrows Discover to the row's titles. */
	seeAll: (total: number) => `See all ${count(total)}`,
	/** Leaves the narrowed list for the rows. */
	allSides: "All sides",
	/** Opens Watch next with the side's moods. */
	watchNext: "Open in Watch next",
}
