// The expanded view's motion, with the Web Animations API on transform and opacity only: a FLIP of poster cards from
// one set of rects to where they are now, cards that had no place on screen streaming in. With reduced motion,
// nothing moves.

export const IN = 300
export const OUT = 240
/** Ease-out: fast start, soft landing. */
export const EASE = "cubic-bezier(.22,.8,.24,1)"

export const reducedMotion = () =>
	typeof window !== "undefined" &&
	window.matchMedia("(prefers-reduced-motion: reduce)").matches

export type Rects = Map<string, DOMRect>

const near = (r: DOMRect, margin = 120) =>
	r.bottom > -margin &&
	r.top < window.innerHeight + margin &&
	r.right > -margin &&
	r.left < window.innerWidth + margin

/** The rects of the cards (`[data-shelf-key]`) under `root`, by key. */
export function rectsOf(root: ParentNode | null | undefined): Rects {
	const out: Rects = new Map()
	if (!root) return out
	for (const el of root.querySelectorAll<HTMLElement>("[data-shelf-key]")) {
		const key = el.dataset.shelfKey
		if (key && !out.has(key)) out.set(key, el.getBoundingClientRect())
	}
	return out
}

/**
 * Cards under `root` move from their `from` rect to where they are now (translate + scale from the top left). Cards
 * that had no rect on screen fade and rise in after the movers, a few at a time, so they "stream in".
 */
export function flipIn(
	root: ParentNode | null | undefined,
	from: Rects,
	duration = IN,
): Animation[] {
	if (!root) return []
	const out: Animation[] = []
	if (reducedMotion()) return out
	let fresh = 0
	for (const el of root.querySelectorAll<HTMLElement>("[data-shelf-key]")) {
		const last = el.getBoundingClientRect()
		if (!near(last)) continue
		const first = from.get(el.dataset.shelfKey ?? "")
		el.style.transformOrigin = "0 0"
		if (first && near(first, 400) && last.width > 0) {
			const dx = first.left - last.left
			const dy = first.top - last.top
			const s = first.width / last.width
			out.push(
				el.animate(
					[
						{ transform: `translate(${dx}px, ${dy}px) scale(${s})` },
						{ transform: "none" },
					],
					{
						duration,
						easing: EASE,
					},
				),
			)
		} else {
			out.push(
				el.animate(
					[
						{ opacity: 0, transform: "translateY(10px)" },
						{ opacity: 1, transform: "none" },
					],
					{
						duration: duration * 0.8,
						delay: duration * 0.35 + Math.min(fresh++ * 14, 220),
						easing: EASE,
						fill: "backwards",
					},
				),
			)
		}
	}
	return out
}

export const settle = (as: Animation[]) =>
	Promise.all(as.map((a) => a.finished.catch(() => undefined)))

/** Puts the page back at `y`, instantly (the page scrolls smoothly otherwise: `scroll-smooth` on <html>). */
export function restoreScroll(y: number) {
	if (Math.abs(window.scrollY - y) < 1) return
	window.scrollTo({
		top: y,
		left: window.scrollX,
		behavior: "instant" as ScrollBehavior,
	})
}
