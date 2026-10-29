// Paging for the spotlight card's whole-poster rows (poster-fit.ts sizes them in CSS). A row snaps to every poster,
// so a swipe lands on whole posters, and the arrows page by one whole view (the view's width plus a gap is exactly n
// posters). A row holds at most MAX_PAGES views, so → pages once and ← back, nothing further.
//
// From 640 px the title page rows' round blue arrows sit over the first and last poster (EdgeArrows); on phones page
// dots and small arrows sit under the row (PageDots, SmallArrows). Arrows only fade (opacity), so they never take
// room.
import { ChevronLeftIcon } from "@heroicons/react/24/outline"
import { ChevronRightIcon } from "@heroicons/react/24/solid"
import { useCallback, useEffect, useLayoutEffect, useState } from "react"

const useIsoLayoutEffect =
	typeof window === "undefined" ? useEffect : useLayoutEffect

/** The most views a row holds: the arrows page once each way (owner, 2026-10-28). */
export const MAX_PAGES = 2

/** How many items a row holds before its posters per view are known (the server's and the first render). */
const UNKNOWN_CAP = 16

type PagerState = {
	atStart: boolean
	atEnd: boolean
	page: number
	pages: number
	/** The row's posters per view (its `--poster-n`), 0 until read. */
	perPage: number
}

const START: PagerState = {
	atStart: true,
	atEnd: true,
	page: 0,
	pages: 1,
	perPage: 0,
}

/** One view's width: the scroller's inner width plus a gap is n whole posters. */
function viewWidth(el: HTMLElement) {
	const style = getComputedStyle(el)
	const pad =
		(Number.parseFloat(style.paddingLeft) || 0) +
		(Number.parseFloat(style.paddingRight) || 0)
	const gap = Number.parseFloat(style.columnGap) || 0
	return Math.max(1, el.clientWidth - pad + gap)
}

/**
 * A snapping row's paging: whether it's at either end, which view shows and how many there are, `step` to page by one
 * view, and `cap` for how many items the row may hold. Read before paint (so a capped row never shows its uncapped
 * length), then on scroll (at most once a frame) and on resize.
 */
export function usePager() {
	const [el, setEl] = useState<HTMLElement | null>(null)
	const [state, setState] = useState<PagerState>(START)
	useIsoLayoutEffect(() => {
		if (!el) return
		let frame = 0
		const read = () => {
			frame = 0
			const max = el.scrollWidth - el.clientWidth
			const w = viewWidth(el)
			const atEnd = el.scrollLeft >= max - 4
			const pages = Math.ceil(max / w - 0.02) + 1
			const next: PagerState = {
				atStart: el.scrollLeft <= 4,
				atEnd,
				page: atEnd ? pages - 1 : Math.round(el.scrollLeft / w),
				pages,
				perPage:
					Math.round(
						Number.parseFloat(
							getComputedStyle(el).getPropertyValue("--poster-n"),
						),
					) || 0,
			}
			setState((p) =>
				p.atStart === next.atStart &&
				p.atEnd === next.atEnd &&
				p.page === next.page &&
				p.pages === next.pages &&
				p.perPage === next.perPage
					? p
					: next,
			)
		}
		const later = () => {
			if (!frame) frame = requestAnimationFrame(read)
		}
		read()
		el.addEventListener("scroll", later, { passive: true })
		const resize = new ResizeObserver(later)
		resize.observe(el)
		for (const child of el.children) resize.observe(child)
		// Items come and go (the cap, a new answer): the row's length changes without a resize.
		const items = new MutationObserver(later)
		items.observe(el, { childList: true })
		return () => {
			el.removeEventListener("scroll", later)
			resize.disconnect()
			items.disconnect()
			cancelAnimationFrame(frame)
		}
	}, [el])
	const step = useCallback(
		(dir: 1 | -1) => {
			if (!el) return
			const w = viewWidth(el)
			const max = el.scrollWidth - el.clientWidth
			const at = Math.round(el.scrollLeft / w)
			const reduced = window.matchMedia(
				"(prefers-reduced-motion: reduce)",
			).matches
			el.scrollTo({
				left: Math.min(max, Math.max(0, (at + dir) * w)),
				behavior: reduced ? "auto" : "smooth",
			})
		},
		[el],
	)
	/** How many items the row may hold: MAX_PAGES whole views, less `extra` for tiles after the titles (See all). */
	const cap = useCallback(
		(extra = 0) =>
			state.perPage
				? Math.max(1, state.perPage * MAX_PAGES - extra)
				: UNKNOWN_CAP,
		[state.perPage],
	)
	return { ref: setEl, ...state, step, cap }
}

export type Pager = ReturnType<typeof usePager>

/** The title page rows' arrow (ListSwiper): a round blue button with a chevron. */
const ARROW =
	"rounded-full bg-blue-600 text-white shadow-md hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-opacity-50 transition-[opacity,background-color] duration-200 ease-in-out cursor-pointer"

/** Arrows over the first and last whole poster; each fades out at its end. `top` is the posters' middle. */
export function EdgeArrows({
	nav,
	name,
	top,
	className = "",
}: {
	nav: Pager
	/** What the row is, for the arrows' names. */
	name: string
	top: string
	className?: string
}) {
	if (nav.pages < 2) return null
	const edge = `${ARROW} absolute z-[40] -translate-y-1/2 p-2 disabled:pointer-events-none disabled:opacity-0 ${className}`
	return (
		<>
			<button
				type="button"
				aria-label={`Previous: ${name}`}
				disabled={nav.atStart}
				onClick={() => nav.step(-1)}
				className={`${edge} left-1`}
				style={{ top }}
			>
				<ChevronLeftIcon className="h-6 w-6" aria-hidden />
			</button>
			<button
				type="button"
				aria-label={`Next: ${name}`}
				disabled={nav.atEnd}
				onClick={() => nav.step(1)}
				className={`${edge} right-1`}
				style={{ top }}
			>
				<ChevronRightIcon className="h-6 w-6" aria-hidden />
			</button>
		</>
	)
}

/** Small arrows for a row's foot or label line; they stay in place, dimmed at an end, unseen with one view. */
export function SmallArrows({
	nav,
	name,
	size = "h-8 w-8",
	className = "",
}: {
	nav: Pager
	name: string
	size?: string
	className?: string
}) {
	const off = nav.pages < 2
	const cls = `${ARROW} flex ${size} items-center justify-center disabled:cursor-default disabled:opacity-30 disabled:hover:bg-blue-600`
	return (
		<span className={`flex gap-1.5 ${off ? "invisible" : ""} ${className}`}>
			<button
				type="button"
				aria-label={`Previous: ${name}`}
				disabled={nav.atStart}
				tabIndex={off ? -1 : undefined}
				onClick={() => nav.step(-1)}
				className={cls}
			>
				<ChevronLeftIcon className="h-[18px] w-[18px]" aria-hidden />
			</button>
			<button
				type="button"
				aria-label={`Next: ${name}`}
				disabled={nav.atEnd}
				tabIndex={off ? -1 : undefined}
				onClick={() => nav.step(1)}
				className={cls}
			>
				<ChevronRightIcon className="h-[18px] w-[18px]" aria-hidden />
			</button>
		</span>
	)
}

/** Which view of the row shows, as dots (amber for the current one). */
export function PageDots({ nav }: { nav: Pager }) {
	if (nav.pages < 2) return null
	return (
		<span aria-hidden className="flex items-center gap-1.5">
			{Array.from({ length: Math.min(nav.pages, MAX_PAGES) }, (_, i) => (
				<span
					// biome-ignore lint/suspicious/noArrayIndexKey: page positions
					key={i}
					className={`block h-1.5 w-1.5 rounded-full transition-[opacity,transform] duration-200 ${i === nav.page ? "scale-125 bg-amber-400 opacity-100" : "bg-white opacity-25"}`}
				/>
			))}
		</span>
	)
}
