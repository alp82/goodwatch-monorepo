// The TV's direction rule: which item takes the focus when a direction is pressed.
//
// Pure: it gets the boxes of the items on show and never reads the page. The rule is the approved prototype's:
// Left and Right stay in the row, Up and Down take the nearest row in that direction and in it the item with the
// least sideways offset, and with nothing in that direction the focus stays. The TV's machine (`tv-machine.ts`)
// calls it for a `move`; the hook measures the boxes at the moment of the key press.

export type TvDir = "up" | "down" | "left" | "right"

/** Where an item sits on the screen. Any one coordinate space, as long as every box of a call shares it. */
export type TvBox = {
	id: string
	left: number
	top: number
	width: number
	height: number
}

/** How far an item may reach back over the focused one and still count as ahead of it, in TV canvas pixels. */
const OVERLAP = 8
/** Items this much further ahead than the nearest one are still its row, in TV canvas pixels. */
const ROW_DEPTH = 40

/**
 * The item the focus moves to from `from` in the direction `dir`, or null when there is none and the focus stays.
 * `scale` is how many pixels of the boxes one TV canvas pixel is (the TV is drawn on a canvas and scaled into the
 * room), so the rule's two tolerances keep their size on the canvas.
 */
export function nextInDirection(
	boxes: readonly TvBox[],
	from: string,
	dir: TvDir,
	scale = 1,
): string | null {
	const a = boxes.find((box) => box.id === from)
	if (!a) return null
	const horizontal = dir === "left" || dir === "right"
	const candidates = boxes
		.filter((b) => b !== a)
		.map((b) => {
			// How far ahead the item is, and how far off to the side (0 while the two overlap sideways).
			const ahead =
				dir === "right"
					? b.left - (a.left + a.width)
					: dir === "left"
						? a.left - (b.left + b.width)
						: dir === "down"
							? b.top - (a.top + a.height)
							: a.top - (b.top + b.height)
			const [a0, a1, b0, b1] = horizontal
				? [a.top, a.top + a.height, b.top, b.top + b.height]
				: [a.left, a.left + a.width, b.left, b.left + b.width]
			const aside = Math.max(0, Math.max(a0, b0) - Math.min(a1, b1))
			const centers = Math.abs((a0 + a1) / 2 - (b0 + b1) / 2)
			return { box: b, ahead, aside, centers }
		})
		// Left and Right stay in the row; Up and Down take whatever row comes next.
		.filter((c) => c.ahead > -OVERLAP * scale && (!horizontal || c.aside === 0))
	if (!candidates.length) return null
	const nearest = Math.min(...candidates.map((c) => c.ahead))
	const row = candidates.filter((c) => c.ahead <= nearest + ROW_DEPTH * scale)
	// From a wide item (a picture over a row of tiles) the focus starts at the row's left end, as a TV does.
	const wide =
		!horizontal &&
		row.filter((c) => c.aside === 0).length > 1 &&
		row.every((c) => c.box.width < a.width / 2)
	row.sort((x, y) =>
		horizontal
			? x.ahead - y.ahead
			: wide
				? x.box.left - y.box.left
				: x.aside - y.aside || x.centers - y.centers,
	)
	return row[0].box.id
}
