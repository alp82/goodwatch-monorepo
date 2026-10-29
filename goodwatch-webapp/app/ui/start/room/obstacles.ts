// Which shelf slots a control covers, compared where both are drawn: on screen, in the stage's pixels.
//
// The covers sit in the camera, which scales the room about its origin; the controls sit in the search block, which
// waits moved down until the card opens. A layout box (offsetLeft/offsetTop) counts none of that, so each side is
// mapped through the CSS transforms of its element and its ancestors up to the stage.
//
// - Each transform is read at its end: while a transition runs (the block's 0.9 s lift), the transition's last
//   keyframe counts, not the frame on screen, so the slots are decided once for where things come to rest, not frame
//   by frame.
// - The card counts at its open box even while only its ledge shows: the slots under it stay empty before it opens,
//   so no poster vanishes from under the card when it grows.
import { type Rect, overlaps } from "./homography.ts"

/** A 2D CSS transform about an origin in the stage's px: p' = o + M(p - o), M = [a c e; b d f]. */
export type Transform2D = {
	a: number
	b: number
	c: number
	d: number
	e: number
	f: number
	ox: number
	oy: number
}

type Matrix = [number, number, number, number, number, number]

/** A computed `transform` (`none`, `matrix(…)`, `matrix3d(…)`) as its 2D part, or null for anything else. */
export function parseMatrix(css: string): Matrix | null {
	const s = css.trim()
	if (s === "" || s === "none") return [1, 0, 0, 1, 0, 0]
	const m = /^matrix(3d)?\(([^)]*)\)$/.exec(s)
	if (!m) return null
	const v = m[2].split(",").map(Number)
	if (v.some((n) => !Number.isFinite(n))) return null
	if (m[1])
		return v.length === 16 ? [v[0], v[1], v[4], v[5], v[12], v[13]] : null
	return v.length === 6 ? (v as Matrix) : null
}

/** A computed `transform-origin` ("12px 34px" or "12px 34px 0px"). */
export function parseOrigin(css: string): { x: number; y: number } {
	const [x = 0, y = 0] = css
		.trim()
		.split(/\s+/)
		.map((p) => Number.parseFloat(p))
		.map((n) => (Number.isFinite(n) ? n : 0))
	return { x, y }
}

export const isIdentity = ([a, b, c, d, e, f]: Matrix) =>
	a === 1 && b === 0 && c === 0 && d === 1 && e === 0 && f === 0

/** A rectangle through one transform: the box around its mapped corners. */
export function mapRect(rect: Rect, t: Transform2D): Rect {
	const corners = [
		[rect.left, rect.top],
		[rect.left + rect.width, rect.top],
		[rect.left, rect.top + rect.height],
		[rect.left + rect.width, rect.top + rect.height],
	].map(([x, y]) => {
		const dx = x - t.ox
		const dy = y - t.oy
		return [t.ox + t.a * dx + t.c * dy + t.e, t.oy + t.b * dx + t.d * dy + t.f]
	})
	const xs = corners.map((p) => p[0])
	const ys = corners.map((p) => p[1])
	const left = Math.min(...xs)
	const top = Math.min(...ys)
	return {
		left,
		top,
		width: Math.max(...xs) - left,
		height: Math.max(...ys) - top,
	}
}

/** A layout box on screen: through its element's transforms, innermost first. */
export const onScreen = (rect: Rect, chain: readonly Transform2D[]) =>
	chain.reduce(mapRect, rect)

/**
 * Which slots stay empty: a slot (its box in the stage's layout px, under the camera's `camera` chain) is hidden when
 * a control's on-screen box comes within `pad` px of the slot's on-screen box.
 */
export function coveredSlots(
	slots: readonly Rect[],
	camera: readonly Transform2D[],
	obstacles: readonly Rect[],
	pad: number,
): boolean[] {
	return slots.map((slot) => {
		const box = onScreen(slot, camera)
		return obstacles.some((o) => overlaps(box, o, pad))
	})
}

/** An element's box in `stop`'s pixels, from the offset chain: transforms (the camera, a lifted block) don't count. */
export function layoutRect(el: HTMLElement, stop: HTMLElement): Rect {
	let left = 0
	let top = 0
	let node: HTMLElement | null = el
	while (node && node !== stop) {
		left += node.offsetLeft
		top += node.offsetTop
		node = node.offsetParent as HTMLElement | null
	}
	return { left, top, width: el.offsetWidth, height: el.offsetHeight }
}

/** The transform an element comes to rest at: a running transition's end, else its computed transform. */
function restingMatrix(el: Element, style: CSSStyleDeclaration): Matrix | null {
	let css = style.transform
	const running = el
		.getAnimations?.()
		.find(
			(a) =>
				(a as Animation & { transitionProperty?: string })
					.transitionProperty === "transform",
		)
	const end = (running?.effect as KeyframeEffect | null | undefined)
		?.getKeyframes()
		.at(-1)?.transform
	if (typeof end === "string") css = end
	const parsed = parseMatrix(css)
	if (parsed || typeof DOMMatrixReadOnly === "undefined") return parsed
	try {
		const m = new DOMMatrixReadOnly(css)
		return [m.a, m.b, m.c, m.d, m.e, m.f]
	} catch {
		return parseMatrix(style.transform)
	}
}

/** The transforms from `el` up to `stage` (not counting the stage's own), innermost first, at rest. */
export function restingChain(
	el: HTMLElement,
	stage: HTMLElement,
): Transform2D[] {
	const chain: Transform2D[] = []
	for (
		let node: HTMLElement | null = el;
		node && node !== stage;
		node = node.parentElement
	) {
		const style = getComputedStyle(node)
		const m = restingMatrix(node, style)
		if (!m || isIdentity(m)) continue
		const box = layoutRect(node, stage)
		const o = parseOrigin(style.transformOrigin)
		const [a, b, c, d, e, f] = m
		chain.push({ a, b, c, d, e, f, ox: box.left + o.x, oy: box.top + o.y })
	}
	return chain
}

/** A control's box on screen, at rest. */
export function obstacleBox(el: HTMLElement, stage: HTMLElement): Rect {
	return onScreen(layoutRect(el, stage), restingChain(el, stage))
}
