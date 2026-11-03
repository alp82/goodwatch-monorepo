// The geometry of the season overview's rows (SeasonOverview.tsx): every season is one row of the same height in
// both views, so switching between Grid and Spread never moves the page, and one square size serves the whole show.

/** A season row's drawing height, in both views. */
export const ROW = 24
/** The space between two squares. */
export const GAP = 2
/** The season label's column and the season chip's column. */
export const LABEL_W = 40
export const CHIP_W = 40
/** The width the row loses to its label, its chip and the gaps between them. */
export const ROW_CHROME = LABEL_W + CHIP_W + 8
/** Squares at least this big carry their score, and the open season needs no tiles of its own. */
export const READABLE = 20

/** How many lines of squares of size `cell` fit a row, and how many squares a line of `plot` width holds. */
export function stripLines(cell: number, plot: number) {
	return {
		lines: Math.max(1, Math.floor((ROW + GAP) / (cell + GAP))),
		perLine: Math.max(1, Math.floor((plot + GAP) / (cell + GAP))),
	}
}

/** The biggest square that fits the longest season into one row of `plot` width (at most ROW - 2, at least 2). */
export function stripCell(longest: number, plot: number): number {
	const most = Math.max(1, longest)
	for (let c = ROW - 2; c > 2; c--) {
		const { lines, perLine } = stripLines(c, plot)
		if (lines * perLine >= most) return c
	}
	return 2
}

/** The narrowest plot that lets squares of size `cell` hold the longest season: the skeleton's container queries. */
export function plotFor(longest: number, cell: number): number {
	const { lines } = stripLines(cell, 0)
	return Math.ceil(Math.max(1, longest) / lines) * (cell + GAP) - GAP
}

/** The Spread view's axis: scores 4 to 10 across the plot, with a little room at both ends. */
export const AXIS = { lo: 4, hi: 10 }
export const axisX = (score: number, plot: number) =>
	((Math.max(AXIS.lo, Math.min(AXIS.hi, score)) - AXIS.lo) /
		(AXIS.hi - AXIS.lo)) *
		(plot - 8) +
	4

/** A season's average and spread of rated episodes, or null when none is rated. */
export function spreadOf(
	ratings: number[],
): { avg: number; sd: number } | null {
	if (!ratings.length) return null
	const avg = ratings.reduce((a, r) => a + r, 0) / ratings.length
	const sd = Math.sqrt(
		ratings.reduce((a, r) => a + (r - avg) ** 2, 0) / ratings.length,
	)
	return { avg, sd }
}
