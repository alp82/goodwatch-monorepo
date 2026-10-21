/**
 * The font size (px) at which a query fills `room` px, given its width when set at 100 px: as large as `range.max`, never
 * under `range.min`. `overflows` says the text needs less than the floor, so it scrolls in its field.
 */
export function fitSize(
	widthAt100: number,
	room: number,
	range: { max: number; min: number },
): { size: number; overflows: boolean } {
	const ideal = widthAt100 > 0 ? (room / widthAt100) * 100 : range.max
	return {
		size: Math.max(range.min, Math.min(range.max, Math.floor(ideal))),
		overflows: ideal < range.min,
	}
}
