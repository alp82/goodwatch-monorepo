// Where a browse rail's arrow scrolls to (Rail.tsx). Pure, so the rule is tested without a browser.
//
// One step is about one view of cards, card-aligned: forward, the first card not wholly in view becomes the first;
// back, the card now first becomes about the last in view. A step never leaves a tiny last move: when less than a card
// and a gap (or about a third of the view) would be left before an end, it goes straight to that end.

export type RailCard = {
	/** Where the rail scrolls to put the card first, in scroll coordinates. */
	at: number
	/** The card's right edge, in scroll coordinates. */
	right: number
	width: number
}

export type RailBox = {
	/** The rail's scroll position now. */
	left: number
	/** The rail's largest scroll position. */
	max: number
	/** The rail's visible width. */
	width: number
	/** The rail's padding at each side, which the cards scroll under. */
	pad: number
	/** The space between cards. */
	gap: number
}

/** The scroll position one step forward (1) or back (-1). */
export function railTarget(
	box: RailBox,
	cards: readonly RailCard[],
	dir: 1 | -1,
): number {
	const { left, max, width, pad, gap } = box
	const view = width - pad * 2
	const cardWidth = cards[0]?.width ?? 120
	const tail = Math.max(cardWidth + gap, view * 0.35)
	let target: number
	if (dir === 1) {
		const edge = left + width - pad + 1
		target =
			cards.find((card) => card.right > edge && card.at > left + 4)?.at ??
			left + view
		if (max - target < tail) target = max
	} else {
		const want = left - view
		target = cards.find((card) => card.at >= want - 1)?.at ?? want
		if (target >= left - 4) target = want
		if (target < tail) target = 0
	}
	return Math.min(max, Math.max(0, target))
}

/** Whether the rail is at its start and at its end, within a few pixels. */
export const railEnds = (left: number, max: number) => ({
	atStart: left <= 4,
	atEnd: left >= max - 4,
})
