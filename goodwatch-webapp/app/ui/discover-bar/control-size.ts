// How much of Ready to watch and For you + Sort shows: 2 full labels, 1 short labels, 0 icons only. The widest size
// whose controls still leave the status line's chips the room they take. Hidden copies of both controls at every size
// (inside the element on `measureRef`, marked `data-size="ready-<n>"` and `"order-<n>"`) give the widths; the chips'
// own width is where the last chip ends. Phones keep Ready to watch on its own row, so only For you + Sort is weighed,
// at most at size 1.
import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react"

export type ControlSize = 0 | 1 | 2

/** The status line's gaps between its parts, and the least room the chips keep. */
const GAPS = 36
const CHIPS_MIN = 120
/** The chip row's own end padding (BarChips pr-8). */
const CHIPS_END = 32

const useIsomorphicLayoutEffect =
	typeof window === "undefined" ? useEffect : useLayoutEffect

export function useControlSize({
	desktop,
	chipKey,
	maxSize = 2,
}: {
	desktop: boolean
	/** Changes whenever the chips do. */
	chipKey: string
	/** Active criteria leave more room for their chips, even on a wide screen. */
	maxSize?: ControlSize
}) {
	// The status line renders in both the desktop and the phone block; only one is visible.
	const rows = useRef(new Set<HTMLElement>())
	const rowRef = useCallback((el: HTMLElement | null) => {
		if (el) rows.current.add(el)
	}, [])
	const measureRef = useRef<HTMLDivElement>(null)
	const [size, setSize] = useState<ControlSize>(2)

	useIsomorphicLayoutEffect(() => {
		const measure = measureRef.current
		if (!measure) return
		const run = () => {
			const row = [...rows.current].find(
				(el) => el.isConnected && el.clientWidth > 0,
			)
			if (!row) return
			const list = row.querySelector<HTMLElement>(
				'ul[aria-label="Active filters"]',
			)
			const last = list?.lastElementChild as HTMLElement | null | undefined
			const chips = Math.max(
				CHIPS_MIN,
				last ? last.offsetLeft + last.offsetWidth + CHIPS_END : 0,
			)
			const width = (key: string) =>
				measure.querySelector<HTMLElement>(`[data-size="${key}"]`)
					?.offsetWidth ?? 0
			const room = row.clientWidth - GAPS
			const sizes = ([2, 1, 0] as ControlSize[]).filter(
				(s) => s <= Math.min(maxSize, desktop ? 2 : 1),
			)
			const fit =
				sizes.find(
					(s) =>
						(desktop ? width(`ready-${s}`) : 0) + width(`order-${s}`) + chips <=
						room,
				) ?? 0
			setSize((was) => (was === fit ? was : fit))
		}
		run()
		const observer = new ResizeObserver(run)
		for (const el of rows.current) if (el.isConnected) observer.observe(el)
		return () => observer.disconnect()
	}, [desktop, chipKey, maxSize])

	return { size: Math.min(size, maxSize) as ControlSize, rowRef, measureRef }
}
