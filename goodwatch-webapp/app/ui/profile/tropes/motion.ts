// How a trope band opens and closes without jumping. `snap(tapped)` right before the change records where the tapped
// band and every `[data-flip]` element in the list are on screen. After the next render the page scrolls by however
// far the tapped band moved (it stays put), then every other element that moved starts at its old place (an inverse
// translateY) and slides to its new one. Only transform runs, through the Web Animations API, so it stays on the
// compositor. Nothing animates with reduced motion.
import {
	type RefObject,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react"

/** useLayoutEffect in the browser, useEffect on the server (which runs neither). */
export const useIso =
	typeof window === "undefined" ? useEffect : useLayoutEffect

export const EASE_OUT = "cubic-bezier(0.2, 0.7, 0.2, 1)"
export const EASE = [0.2, 0.7, 0.2, 1] as const
export const DURATION = 340

export const reducedMotion = () =>
	typeof window !== "undefined" &&
	window.matchMedia("(prefers-reduced-motion: reduce)").matches

export function useBandMotion(
	list: RefObject<HTMLElement | null>,
	dep: unknown,
) {
	const shot = useRef<{
		tapped: HTMLElement | null
		tappedTop: number
		tops: Map<HTMLElement, number>
	} | null>(null)
	// Runs after the change `dep` names.
	useIso(() => {
		const s = shot.current
		shot.current = null
		if (!s) return
		if (s.tapped?.isConnected) {
			const moved = s.tapped.getBoundingClientRect().top - s.tappedTop
			if (Math.abs(moved) > 0.5)
				window.scrollBy({ top: moved, behavior: "instant" as ScrollBehavior })
		}
		if (reducedMotion()) return
		for (const [el, top] of s.tops) {
			if (!el.isConnected || el === s.tapped) continue
			const r = el.getBoundingClientRect()
			const dy = top - r.top
			// Only what's on screen (now or before) and moved.
			if (
				Math.abs(dy) < 1 ||
				(r.bottom < -200 && top < -200) ||
				(r.top > innerHeight + 200 && top > innerHeight + 200)
			)
				continue
			el.animate(
				[{ transform: `translateY(${dy}px)` }, { transform: "translateY(0)" }],
				{ duration: DURATION, easing: EASE_OUT },
			)
		}
	}, [dep])
	return (tapped: HTMLElement | null) => {
		const tops = new Map<HTMLElement, number>()
		for (const el of list.current?.querySelectorAll<HTMLElement>(
			"[data-flip]",
		) ?? [])
			tops.set(el, el.getBoundingClientRect().top)
		shot.current = {
			tapped,
			tappedTop: tapped?.getBoundingClientRect().top ?? 0,
			tops,
		}
	}
}

/** True from `min` px wide on. The server and the first paint assume desktop. */
export function useWide(min: number) {
	const [wide, setWide] = useState(true)
	useIso(() => {
		const mq = window.matchMedia(`(min-width: ${min}px)`)
		const on = () => setWide(mq.matches)
		on()
		mq.addEventListener("change", on)
		return () => mq.removeEventListener("change", on)
	}, [min])
	return wide
}

/** Scrolls `el` into view when it isn't, with `top` px kept clear for the sticky header and tabs. */
export function reveal(el: HTMLElement | null, top = 140) {
	if (!el) return
	const r = el.getBoundingClientRect()
	const room = window.innerHeight - 16
	if (r.bottom <= room && r.top >= top) return
	const by = r.height > room - top ? r.top - top : r.bottom - room
	window.scrollBy({
		top: by,
		behavior: reducedMotion() ? ("instant" as ScrollBehavior) : "smooth",
	})
}
