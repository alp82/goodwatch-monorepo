// PROTOTYPE (start page lab) · Round 17: whole posters only in the spotlight card's rows. The owner: "either show an
// arrow or dont show incomplete posters". Each row is a size container; per breakpoint its poster width is the largest
// that fits the row's height (colMax), shrunk just enough that a whole number fits the row's width (CSS only, from
// container queries, so the server's first paint is already right and nothing shifts). The rows snap to every poster,
// so a swipe lands on whole posters, and the arrows page by a whole set.
import { ChevronLeftIcon } from "@heroicons/react/24/outline"
import { ChevronRightIcon } from "@heroicons/react/24/solid"
import { useCallback, useEffect, useState } from "react"

/** One breakpoint of a row: the media query (empty for the base), the tallest poster width, the gap and side padding. */
export type FitSpec = { media: string; colMax: number; gap: number; pad: number }

/**
 * The CSS for a row named `name`: `.<name>-box` (a descendant of the `<name>` container) gets `--jk-n` (posters per
 * view), `--jk-g` and `--jk-p`; `.<name>-c` is a poster column whose width makes exactly `--jk-n` fit. A row needs n+1
 * once its width W (container minus padding) passes n·(colMax+gap)−gap, so every column is at most colMax.
 */
export function fitCss(name: string, specs: FitSpec[], maxN = 12) {
	const out: string[] = [
		`.${name}{container:${name}/inline-size}`,
		// --jk-cw (a poster's width) resolves 100cqw where it's used, so any descendant of the container can use it.
		`.${name}-box{--jk-cw:calc((100cqw - 2 * var(--jk-p) - (var(--jk-n) - 1) * var(--jk-g)) / var(--jk-n))}`,
		`.${name}-c{flex-shrink:0;width:var(--jk-cw)}`,
		// The scroller's box ends `--jk-e` past the whole posters (less than a gap, so the next poster never peeks into
		// it); the rest of the side padding is margin. `--jk-e` keeps room for a loved poster's ring and badge.
		`.${name}-row{margin-inline:calc(var(--jk-p) - var(--jk-e));padding-inline:var(--jk-e);gap:var(--jk-g);scroll-padding-inline:var(--jk-e)}`,
	]
	for (const s of specs) {
		const e = Math.max(0, Math.min(s.pad, 8, s.gap - 2))
		const rules = [`.${name}-box{--jk-n:1;--jk-g:${s.gap}px;--jk-p:${s.pad}px;--jk-e:${e}px}`]
		for (let n = 1; n < maxN; n++) {
			const min = n * (s.colMax + s.gap) - s.gap + 2 * s.pad + 0.5
			rules.push(`@container ${name} (min-width:${min}px){.${name}-box{--jk-n:${n + 1}}}`)
		}
		out.push(s.media ? `@media ${s.media}{${rules.join("")}}` : rules.join(""))
	}
	return out.join("\n")
}

/**
 * A snapping row's paging: whether it's at either end, which page shows and how many there are, and `step` to page
 * by one whole view (the view's width plus a gap is exactly n posters). Read on scroll (one frame at most) and resize.
 */
export function usePager() {
	const [el, setEl] = useState<HTMLElement | null>(null)
	const [st, setSt] = useState({ atStart: true, atEnd: true, page: 0, pages: 1 })
	const pageW = useCallback((e: HTMLElement) => {
		const cs = getComputedStyle(e)
		const pad = (Number.parseFloat(cs.paddingLeft) || 0) + (Number.parseFloat(cs.paddingRight) || 0)
		const gap = Number.parseFloat(cs.columnGap) || 0
		return Math.max(1, e.clientWidth - pad + gap)
	}, [])
	useEffect(() => {
		if (!el) return
		let raf = 0
		const read = () => {
			raf = 0
			const max = el.scrollWidth - el.clientWidth
			const w = pageW(el)
			const next = {
				atStart: el.scrollLeft <= 4,
				atEnd: el.scrollLeft >= max - 4,
				page: el.scrollLeft >= max - 4 ? Math.ceil(max / w - 0.02) : Math.round(el.scrollLeft / w),
				pages: Math.ceil(max / w - 0.02) + 1,
			}
			setSt((p) => (p.atStart === next.atStart && p.atEnd === next.atEnd && p.page === next.page && p.pages === next.pages ? p : next))
		}
		const later = () => {
			if (!raf) raf = requestAnimationFrame(read)
		}
		read()
		el.addEventListener("scroll", later, { passive: true })
		const ro = new ResizeObserver(later)
		ro.observe(el)
		for (const c of el.children) ro.observe(c)
		return () => {
			el.removeEventListener("scroll", later)
			ro.disconnect()
			cancelAnimationFrame(raf)
		}
	}, [el, pageW])
	const step = useCallback(
		(dir: 1 | -1) => {
			if (!el) return
			const w = pageW(el)
			const max = el.scrollWidth - el.clientWidth
			const at = Math.round(el.scrollLeft / w)
			const left = Math.min(max, Math.max(0, (at + dir) * w))
			const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
			el.scrollTo({ left, behavior: reduced ? "auto" : "smooth" })
		},
		[el, pageW],
	)
	return { ref: setEl, ...st, step }
}

export type Pager = ReturnType<typeof usePager>

/** The title page rows' arrow (ListSwiper, as browse d's rails): a round blue button with a chevron. */
const ARROW =
	"rounded-full bg-blue-600 text-white shadow-md hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-opacity-50 transition-[opacity,background-color] duration-200 ease-in-out cursor-pointer"

/** Edge arrows over the first and last whole poster; each fades out at its end (opacity only, never takes room). */
export function EdgeArrows({ nav, name, className = "", top }: { nav: Pager; name: string; className?: string; top: string }) {
	const edge = `${ARROW} absolute z-[40] -translate-y-1/2 p-2 disabled:pointer-events-none disabled:opacity-0`
	if (nav.pages < 2) return null
	return (
		<>
			<button type="button" data-jk-arrow="" aria-label={`Previous: ${name}`} disabled={nav.atStart} onClick={() => nav.step(-1)} className={`${edge} left-1 ${className}`} style={{ top }}>
				<ChevronLeftIcon className="h-6 w-6" aria-hidden />
			</button>
			<button type="button" data-jk-arrow="" aria-label={`Next: ${name}`} disabled={nav.atEnd} onClick={() => nav.step(1)} className={`${edge} right-1 ${className}`} style={{ top }}>
				<ChevronRightIcon className="h-6 w-6" aria-hidden />
			</button>
		</>
	)
}

/** Compact arrows for a row's header or foot (browse d's phone arrows); they stay in place, dimmed at an end. */
export function SmallArrows({ nav, name, size = "h-8 w-8", className = "" }: { nav: Pager; name: string; size?: string; className?: string }) {
	const cls = `${ARROW} flex ${size} items-center justify-center disabled:cursor-default disabled:opacity-30 disabled:hover:bg-blue-600`
	const off = nav.pages < 2
	return (
		<span className={`flex gap-1.5 ${off ? "invisible" : ""} ${className}`}>
			<button type="button" data-jk-arrow="" aria-label={`Previous: ${name}`} disabled={nav.atStart} tabIndex={off ? -1 : undefined} onClick={() => nav.step(-1)} className={cls}>
				<ChevronLeftIcon className="h-[18px] w-[18px]" aria-hidden />
			</button>
			<button type="button" data-jk-arrow="" aria-label={`Next: ${name}`} disabled={nav.atEnd} tabIndex={off ? -1 : undefined} onClick={() => nav.step(1)} className={cls}>
				<ChevronRightIcon className="h-[18px] w-[18px]" aria-hidden />
			</button>
		</span>
	)
}

/** Which page of the row shows, as dots (amber for the current one); transform/opacity only. */
export function PageDots({ nav }: { nav: Pager }) {
	if (nav.pages < 2) return null
	return (
		<span aria-hidden className="flex items-center gap-1.5">
			{Array.from({ length: Math.min(nav.pages, 10) }, (_, i) => (
				<span
					// biome-ignore lint/suspicious/noArrayIndexKey: page positions
					key={i}
					className={`block h-1.5 w-1.5 rounded-full transition-[opacity,transform] duration-200 ${i === nav.page ? "scale-125 bg-amber-400 opacity-100" : "bg-white opacity-25"}`}
				/>
			))}
		</span>
	)
}
