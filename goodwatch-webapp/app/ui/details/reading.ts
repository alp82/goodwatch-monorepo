// The reading state of the title page: which sections are on screen (several at once) and how far each one is read.
// The on-screen list is React state and changes only when the list changes; the progress lines are written straight
// to the DOM once per frame (transform only), so scrolling never renders the page again.
//
// A progress line is any element with `data-read-progress="<section id>"`; it gets `scaleX(p)`, or `scaleY(p)` when it
// also has `data-read-axis="y"`. Give it `origin-left` (or `origin-top`).
import { useCallback, useEffect, useState } from "react"
import { useBelowFold } from "~/ui/details/below-fold"

export interface ReadingOptions {
	/** Pixels of sticky bars at the top of the window (the site header and the page's own bars). */
	offset: number
	/** A section counts as on screen when it fills at least this share of the window below the bars... */
	minWindowShare?: number
	/** ...or when at least this share of the section itself is visible (short sections). */
	minSectionShare?: number
}

export interface ReadingState {
	/** Every section that is on screen by the rule above, in page order. */
	visible: string[]
	/** The section at the reading line: the one a single highlight would pick. */
	current: string | null
}

export function useReading(
	ids: string[],
	{ offset, minWindowShare = 0.25, minSectionShare = 0.6 }: ReadingOptions,
): ReadingState {
	const [state, setState] = useState<ReadingState>({
		visible: [],
		current: null,
	})
	const key = ids.join("|")
	useEffect(() => {
		let frame = 0
		let last = ""
		const read = () => {
			frame = 0
			const vh = window.innerHeight
			const view = Math.max(1, vh - offset)
			// A section counts as read once its end passes the reading line, 40% down the window.
			const line = Math.max(offset + 40, vh * 0.4)
			const atEnd =
				window.innerHeight + window.scrollY >=
				document.documentElement.scrollHeight - 4
			const visible: string[] = []
			let current: string | null = null
			for (const id of ids) {
				const el = document.getElementById(id)
				if (!el) continue
				const r = el.getBoundingClientRect()
				const shown = Math.max(
					0,
					Math.min(r.bottom, vh) - Math.max(r.top, offset),
				)
				if (
					shown >= view * minWindowShare ||
					(r.height > 0 && shown >= r.height * minSectionShare)
				)
					visible.push(id)
				if (r.top <= line) current = id
				const p = atEnd
					? 1
					: Math.min(1, Math.max(0, (line - r.top) / Math.max(1, r.height)))
				for (const bar of document.querySelectorAll<HTMLElement>(
					`[data-read-progress="${id}"]`,
				))
					bar.style.transform =
						bar.dataset.readAxis === "y" ? `scaleY(${p})` : `scaleX(${p})`
			}
			if (atEnd && ids.length) current = ids[ids.length - 1]
			const next = `${visible.join(",")}|${current}`
			if (next !== last) {
				last = next
				setState({ visible, current })
			}
		}
		const onScroll = () => {
			if (!frame) frame = requestAnimationFrame(read)
		}
		read()
		window.addEventListener("scroll", onScroll, { passive: true })
		window.addEventListener("resize", onScroll)
		// Sections that load late (the related map, the cast) change heights without a scroll.
		const ro = new ResizeObserver(onScroll)
		ro.observe(document.body)
		return () => {
			if (frame) cancelAnimationFrame(frame)
			window.removeEventListener("scroll", onScroll)
			window.removeEventListener("resize", onScroll)
			ro.disconnect()
		}
	}, [key, offset, minWindowShare, minSectionShare])
	return state
}

const smooth = (): ScrollBehavior =>
	window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
		? "auto"
		: "smooth"

/**
 * Scrolls to a section and puts it in the address. Every section is laid out first (below-fold.tsx), so the jump lands
 * where the section really is. Sections carry a scroll margin (scroll-mt-*) that clears the sticky bars.
 */
export function useJump() {
	const { layOutAll } = useBelowFold()
	return useCallback(
		(id: string) => {
			layOutAll()
			const el = document.getElementById(id)
			if (!el) return
			el.scrollIntoView({ block: "start", behavior: smooth() })
			history.replaceState(history.state, "", `#${id}`)
		},
		[layOutAll],
	)
}

/** Back to the top of the page. */
export const scrollToTop = () => window.scrollTo({ top: 0, behavior: smooth() })

/** Whether an element is on screen below the site header; true until the first report (the server's render). */
export function useOnScreen(id: string, topOffset = 64): boolean {
	const [on, setOn] = useState(true)
	useEffect(() => {
		const el = document.getElementById(id)
		if (!el) return
		const io = new IntersectionObserver(
			([entry]) => setOn(entry.isIntersecting),
			{ rootMargin: `-${topOffset}px 0px 0px 0px` },
		)
		io.observe(el)
		return () => io.disconnect()
	}, [id, topOffset])
	return on
}
