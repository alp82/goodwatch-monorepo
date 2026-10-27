// PROTOTYPE (start page lab): layout helpers: measure a box, notice a hero that brings its own room, and crop a room so its TV lands where the layout wants it.
import { type RefObject, useEffect, useLayoutEffect, useState } from "react"
import { pickMeta } from "../../scene/SceneStage"
import type { ScenePair } from "../../scene/types"

const useIso = typeof window === "undefined" ? useEffect : useLayoutEffect

/** The element's size in px; null on the server and before the first measure. */
export function useSize(ref: RefObject<HTMLElement | null>) {
	const [size, setSize] = useState<{ w: number; h: number } | null>(null)
	useIso(() => {
		const el = ref.current
		if (!el) return
		const measure = () =>
			setSize((s) =>
				s && s.w === el.clientWidth && s.h === el.clientHeight
					? s
					: { w: el.clientWidth, h: el.clientHeight },
			)
		measure()
		const ro = new ResizeObserver(measure)
		ro.observe(el)
		return () => ro.disconnect()
	}, [ref])
	return size
}

/** True when the block inside `ref` placed its own <Room/> (the "ask the room" hero), so the layout can leave its room out. */
export function useHasRoom(ref: RefObject<HTMLElement | null>) {
	const [has, setHas] = useState(false)
	useIso(() => {
		const el = ref.current
		if (!el) return
		const check = () => setHas(!!el.querySelector("[data-lab-room]"))
		check()
		const mo = new MutationObserver(check)
		mo.observe(el, { childList: true, subtree: true })
		return () => mo.disconnect()
	}, [ref])
	return has
}

/**
 * focal/zoom for a <Room/> of size `box` so the TV's center sits at `targetY` px from the box's top (or as close as
 * the image allows), horizontally centered on the TV. Zooms in only as much as needed, up to `maxZoom`.
 */
export function tvAt(
	pair: ScenePair,
	box: { w: number; h: number } | null,
	targetY: number,
	maxZoom = 1.8,
) {
	if (!box || box.w <= 0 || box.h <= 0) return { focal: undefined, zoom: 1 }
	const meta = pickMeta(pair, box.w / box.h)
	const fx = meta.tv.box[0] + meta.tv.box[2] / 2
	const fy = meta.tv.box[1] + meta.tv.box[3] / 2
	const base = Math.max(box.w / meta.width, box.h / meta.height) * meta.height
	// The image's top can't come below the box's top, so the TV sits at most fy * height down: zoom until that reaches targetY.
	const zoom = Math.min(maxZoom, Math.max(1, targetY / Math.max(1, fy * base)))
	const sh = base * zoom
	const focalY = Math.min(1, Math.max(0, fy + (box.h / 2 - targetY) / sh))
	return { focal: [fx, focalY] as [number, number], zoom }
}

/** zoom for a <Room/> of w × h px (landscape scene) so the TV fills about `fill` of the box's width or height. */
export function tvFill(pair: ScenePair, w: number, h: number, fill = 0.7) {
	const meta = pair.landscape
	const base = Math.max(w / meta.width, h / meta.height)
	const tvW = meta.tv.box[2] * meta.width * base
	const tvH = meta.tv.box[3] * meta.height * base
	return Math.max(
		1,
		Math.min((fill * w) / Math.max(1, tvW), (fill * h) / Math.max(1, tvH)),
	)
}
