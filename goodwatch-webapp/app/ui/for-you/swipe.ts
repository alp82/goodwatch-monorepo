// The gestures and the step shared by the desktop pop-out card and the phone title drawer.
// - useSwipe: sideways = next / previous with the content following the finger (rubber band at the ends), down = close
//   (where allowed). The axis locks after 8 px; a click right after a swipe is swallowed.
// - stepTo: swaps once the next images are decoded; the content crossfades (crossfade.tsx).
// - preload: decodes images ahead, one promise per URL.
import { type MotionValue, animate } from "framer-motion"
import { useRef } from "react"
import { flushSync } from "react-dom"

const cache = new Map<string, Promise<void>>()

/** Loads and decodes each URL once; resolves when all are ready (errors count as ready). */
export function preload(urls: (string | null | undefined)[]): Promise<void> {
	if (typeof window === "undefined") return Promise.resolve()
	return Promise.all(
		urls
			.filter((u): u is string => !!u)
			.map((url) => {
				let p = cache.get(url)
				if (!p) {
					const img = new Image()
					img.decoding = "async"
					img.src = url
					p = img.decode().catch(() => {})
					cache.set(url, p)
				}
				return p
			}),
	).then(() => {})
}

const wait = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms))

/** Waits until the next title's images are decoded (220 ms at most), swaps synchronously, and hands the swipe values
 * to the new layer. When `live()` is false by then (closed, unmounted, another title opened), nothing swaps. Returns
 * whether it swapped. */
export async function stepTo({
	cx,
	co,
	ready,
	swap,
	live,
}: {
	cx: MotionValue<number>
	co: MotionValue<number>
	ready: Promise<void>
	swap: () => void
	live: () => boolean
}): Promise<boolean> {
	await Promise.race([ready, wait(220)])
	if (!live()) return false
	flushSync(swap)
	cx.set(0)
	co.set(1)
	return true
}

/**
 * A generation token for steps: a step that waits (for images, for scrolling) runs on only while the token it took
 * is current. `bump` invalidates every step in flight.
 */
export function useStepToken() {
	const gen = useRef(0)
	return useRef({
		take: () => {
			const at = gen.current
			return () => gen.current === at
		},
		bump: () => {
			gen.current++
		},
	}).current
}

type Gesture = {
	id: number
	x0: number
	y0: number
	t0: number
	axis: "x" | "y" | null
	target: Element
}

const BACK = { type: "spring", stiffness: 420, damping: 36 } as const

/** Pointer handlers for a card or drawer: sideways steps, down closes. */
export function useSwipe({
	cx,
	co,
	dy,
	canPrev,
	canNext,
	onStep,
	onClose,
}: {
	/** The content's sideways offset and opacity (it follows the finger). */
	cx: MotionValue<number>
	co: MotionValue<number>
	/** The whole drawer's downward offset; omit where a swipe down shouldn't close. */
	dy?: MotionValue<number>
	canPrev: boolean
	canNext: boolean
	onStep: (d: -1 | 1) => void
	onClose?: () => void
}) {
	const g = useRef<Gesture | null>(null)
	const swallow = useRef(false)

	const onPointerDown = (e: React.PointerEvent<HTMLElement>) => {
		if (e.button !== 0 || g.current) return
		const hit = (e.target as Element).closest("a,button,[data-no-swipe]")
		if (hit && hit !== e.currentTarget) return
		swallow.current = false
		g.current = {
			id: e.pointerId,
			x0: e.clientX,
			y0: e.clientY,
			t0: performance.now(),
			axis: null,
			target: e.currentTarget,
		}
	}
	const onPointerMove = (e: React.PointerEvent<HTMLElement>) => {
		const s = g.current
		if (!s || s.id !== e.pointerId) return
		const dx = e.clientX - s.x0
		const ddy = e.clientY - s.y0
		if (!s.axis) {
			if (Math.hypot(dx, ddy) < 8) return
			s.axis = Math.abs(dx) > Math.abs(ddy) ? "x" : "y"
			if (s.axis === "y" && (!dy || ddy < 0)) {
				g.current = null
				return
			}
			swallow.current = true
			try {
				;(s.target as HTMLElement).setPointerCapture(e.pointerId)
			} catch {}
		}
		if (s.axis === "x") {
			const blocked = (dx > 0 && !canPrev) || (dx < 0 && !canNext)
			const x = blocked ? dx * 0.2 : dx * 0.85
			cx.set(x)
			co.set(Math.max(0.35, 1 - Math.abs(x) / 420))
		} else if (dy) dy.set(Math.max(0, ddy))
	}
	const end = (e: React.PointerEvent<HTMLElement>, cancel: boolean) => {
		const s = g.current
		if (!s || s.id !== e.pointerId) return
		g.current = null
		if (!s.axis) return
		const dx = e.clientX - s.x0
		const ddy = e.clientY - s.y0
		const fast = performance.now() - s.t0 < 280
		if (s.axis === "y" && dy) {
			if (!cancel && onClose && (ddy > 110 || (fast && ddy > 40))) onClose()
			else animate(dy, 0, BACK)
			return
		}
		const d: -1 | 1 = dx < 0 ? 1 : -1
		const ok = d === 1 ? canNext : canPrev
		if (!cancel && ok && (Math.abs(dx) > 70 || (fast && Math.abs(dx) > 30)))
			onStep(d)
		else {
			animate(cx, 0, BACK)
			animate(co, 1, BACK)
		}
	}
	return {
		onPointerDown,
		onPointerMove,
		onPointerUp: (e: React.PointerEvent<HTMLElement>) => end(e, false),
		onPointerCancel: (e: React.PointerEvent<HTMLElement>) => end(e, true),
		onClickCapture: (e: React.MouseEvent) => {
			if (!swallow.current) return
			swallow.current = false
			e.preventDefault()
			e.stopPropagation()
		},
	}
}
