// Where a dialog of the Seen and score control sits from md up: beside what opened it, under it when there is room
// and over it when not, inside the screen. A phone keeps the sheet from the bottom edge, and an opener outside the
// screen (the rate prompt further down asks for the score) keeps the dialog in the middle.
import { type RefObject, useLayoutEffect, useState } from "react"

const GAP = 8
const EDGE = 16

export function useAnchoredPanel(
	panel: RefObject<HTMLElement | null>,
	anchor: () => Element | null | undefined,
) {
	const [at, setAt] = useState<{ top: number; left: number } | null>(null)
	useLayoutEffect(() => {
		const place = () => {
			const box = panel.current
			const rect = anchor()?.getBoundingClientRect()
			const outside = !rect || rect.bottom < 0 || rect.top > window.innerHeight
			if (!box || outside || !window.matchMedia("(min-width: 768px)").matches)
				return setAt(null)
			const width = box.offsetWidth
			const height = box.offsetHeight
			const left = Math.max(
				EDGE,
				Math.min(rect.left, window.innerWidth - width - EDGE),
			)
			const below = rect.bottom + GAP
			const top =
				below + height <= window.innerHeight - EDGE
					? below
					: Math.max(EDGE, rect.top - GAP - height)
			setAt((was) =>
				was && was.top === top && was.left === left ? was : { top, left },
			)
		}
		place()
		// The panel changes height when a step takes the picker's place.
		const observer = new ResizeObserver(place)
		if (panel.current) observer.observe(panel.current)
		window.addEventListener("resize", place)
		return () => {
			observer.disconnect()
			window.removeEventListener("resize", place)
		}
	}, [])
	return at
}
