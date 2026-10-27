/** Every show and season uses the same IMDb score axis, including the spread around its average. */
export function consistencyScale(width: number, padding: number) {
	return {
		ticks: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
		x: (score: number) =>
			padding +
			((Math.min(10, Math.max(1, score)) - 1) / 9) * (width - 2 * padding),
	}
}
