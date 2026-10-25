// Fix mode's marks on the page: the page parts (found by areas.ts selectors), their dashed outlines with a Fix or Flag
// badge over the scrim, and the spotlight ring on the piece a chip stands for (a service tile, a cast card, a score, an
// episode). Everything is drawn in page coordinates in <body>, so nothing on the page moves.
import { FlagIcon, PencilSquareIcon } from "@heroicons/react/20/solid"
import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { type PageArea, kindOf } from "./areas"
import { first, shown, useFadePresence } from "./fix-scrim"

/** "Rows on the TV" → "rows on the TV". */
export const lc = (name: string) => name[0].toLowerCase() + name.slice(1)

const own = (el: HTMLElement) => !el.closest("[data-feedback-private]")

/**
 * The part's elements on the page. A part a page marks with data-feedback-area may be several elements (cast and
 * crew): all of them. Otherwise, per selector in order, the visible matches minus those holding another match, the
 * first in page order.
 */
export function areaElements(a: PageArea): HTMLElement[] {
	for (const sel of [a.selector].flat()) {
		const all = Array.from(document.querySelectorAll<HTMLElement>(sel)).filter(
			(el) => shown(el) && own(el),
		)
		if (!all.length) continue
		if (sel.startsWith("[data-feedback-area")) return all
		const el = all.find((e) => !all.some((o) => o !== e && e.contains(o)))
		if (el) return [el]
	}
	return []
}

export const findArea = (a: PageArea): HTMLElement | null =>
	areaElements(a)[0] ?? null

type Box = { id: string; x: number; y: number; w: number; h: number }

/** The found parts' boxes in page coordinates, kept current through resizes, late content and sticky bars. */
function useBoxes(areas: PageArea[], on: boolean) {
	const [boxes, setBoxes] = useState<Box[]>([])
	useEffect(() => {
		if (!on) {
			setBoxes((b) => (b.length ? [] : b))
			return
		}
		let frame = 0
		let last = ""
		const measure = () => {
			frame = 0
			const next: Box[] = []
			for (const a of areas) {
				const els = areaElements(a)
				if (!els.length) continue
				const rects = els.map((el) => el.getBoundingClientRect())
				const left = Math.min(...rects.map((r) => r.left))
				const top = Math.min(...rects.map((r) => r.top))
				const right = Math.max(...rects.map((r) => r.right))
				const bottom = Math.max(...rects.map((r) => r.bottom))
				next.push({
					id: a.id,
					x: Math.round(left + window.scrollX),
					y: Math.round(top + window.scrollY),
					w: Math.round(right - left),
					h: Math.round(bottom - top),
				})
			}
			const key = JSON.stringify(next)
			if (key === last) return
			last = key
			setBoxes(next)
			// The scrim measures its cut-outs from these boxes once they've rendered.
			requestAnimationFrame(() => window.dispatchEvent(new Event("fix-layout")))
		}
		const later = () => {
			if (!frame) frame = requestAnimationFrame(measure)
		}
		measure()
		const ro = new ResizeObserver(later)
		ro.observe(document.body)
		window.addEventListener("resize", later)
		window.addEventListener("scroll", later, { passive: true })
		const t = window.setTimeout(later, 500)
		return () => {
			ro.disconnect()
			window.removeEventListener("resize", later)
			window.removeEventListener("scroll", later)
			window.clearTimeout(t)
			cancelAnimationFrame(frame)
		}
	}, [areas, on])
	return boxes
}

/** Fix mode's outlines and badges, above the scrim. Mounted while fix mode's page layer is (fading included). */
export function Outlines({
	areas,
	lit,
	setHot,
	pick,
	shown: visible,
}: {
	areas: PageArea[]
	lit: string | null
	setHot: (id: string | null) => void
	pick: (id: string) => void
	/** False while fading out (and for the frame before fading in). */
	shown: boolean
}) {
	const boxes = useBoxes(areas, true)
	// Clipped to the page's width, so an outline round a full-width part never makes the page scroll sideways.
	return createPortal(
		<div
			data-feedback-private
			data-fix-outlines
			{...(!visible && { inert: "" })}
			className={`pointer-events-none absolute top-0 left-0 z-[1000] overflow-clip transition-opacity duration-200 ease-out motion-reduce:transition-none ${visible ? "opacity-100" : "opacity-0"}`}
			style={{
				width: document.documentElement.clientWidth,
				height: document.documentElement.scrollHeight,
			}}
		>
			{boxes.map((b) => {
				const a = areas.find((x) => x.id === b.id)
				if (!a) return null
				const flagOnly = kindOf(a) === "flag"
				const on = lit === b.id
				return (
					<button
						key={b.id}
						type="button"
						data-fix-overlay={b.id}
						data-lit={on || undefined}
						aria-label={`${flagOnly ? "Flag" : "Fix"} ${lc(a.name)}`}
						onPointerEnter={() => setHot(b.id)}
						onPointerLeave={() => setHot(null)}
						onFocus={() => setHot(b.id)}
						onBlur={() => setHot(null)}
						onClick={() => pick(b.id)}
						className={`absolute top-0 left-0 cursor-pointer rounded-2xl border-2 border-dashed transition-[opacity,background-color,border-color] duration-100 ${visible ? "pointer-events-auto" : ""} ${on ? "border-solid border-amber-400 bg-amber-400/[0.07]" : flagOnly ? "border-white/40" : "border-amber-500/70"}`}
						style={{
							transform: `translate(${b.x - 4}px, ${b.y - 4}px)`,
							width: b.w + 8,
							height: b.h + 8,
						}}
					>
						<span
							data-fix-badge
							className={`absolute -top-3 right-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold shadow-lg transition-transform duration-100 ${on ? "scale-110" : ""} ${flagOnly ? "bg-gray-200 text-gray-950" : "bg-amber-400 text-gray-950"}`}
						>
							{flagOnly ? (
								<FlagIcon className="size-3.5" aria-hidden />
							) : (
								<PencilSquareIcon className="size-3.5" aria-hidden />
							)}
							{flagOnly ? "Flag" : "Fix"} {lc(a.name)}
						</span>
					</button>
				)
			})}
		</div>,
		document.body,
	)
}

const SCORE_ALT: Record<string, string> = {
	imdb: "IMDb",
	metacritic: "Metacritic",
	"metacritic-user": "Metacritic",
	"rotten-tomatoes": "Rotten Tomatoes",
	"rotten-tomatoes-audience": "Rotten Tomatoes",
}
const TAB_OF: Record<string, string> = {
	flatrate: "flatrate",
	free: "flatrate",
	ads: "flatrate",
	rent: "rent",
	buy: "buy",
}

/** The element a chip's spot names, or null when the page doesn't show it (a service it isn't listed on). */
export function findSpot(spot: string): HTMLElement | null {
	const [kind, a, b] = spot.split(":")
	const area = (id: string) => `[data-feedback-area="${id}"]`
	switch (kind) {
		case "provider":
			return first(`${area("watch")} [data-provider-id="${CSS.escape(a)}"]`)
		case "offer":
			return first(
				`${area("watch")} [data-replay-tap="offer:${TAB_OF[a] ?? "flatrate"}"]`,
			)
		case "country":
			return first(`${area("watch")} button[data-country]`)
		case "person":
			return first(`${area("cast")} [data-person-id="${CSS.escape(a)}"]`)
		case "source": {
			if (a === "goodwatch")
				return first(
					`${area("scores")} [data-hero-ratings] > div:not([data-hero-sites])`,
				)
			const alt = SCORE_ALT[a]
			return alt
				? (first(`${area("scores")} img[alt="${alt}"]`)?.closest<HTMLElement>(
						"a",
					) ?? null)
				: null
		}
		case "season":
			return first(
				`${area("episodes")} [aria-label^="Season ${CSS.escape(a)}"]`,
			)
		case "episode":
			return first(
				`${area("episodes")} button[aria-label^="S${a} E${b} ·"], ${area("episodes")} [data-episode="${a}:${b}"]`,
			)
		case "credit":
			return first(
				`${area("credits")} a[href^="/${a === "tv" ? "show" : "movie"}/${CSS.escape(b)}-"]`,
			)
	}
	return null
}

/** The ring on the page piece a chip stands for, while the chip is hovered or focused, or for the picked answer. */
export function Spotlight({ spot: next }: { spot: string | null }) {
	// The last spot stays for the fade out, so the ring never just vanishes.
	const { mounted, shown: visible } = useFadePresence(Boolean(next), 160)
	const [kept, setKept] = useState(next)
	useEffect(() => {
		if (next) setKept(next)
	}, [next])
	const spot = mounted ? (next ?? kept) : null
	const [box, setBox] = useState<{
		x: number
		y: number
		w: number
		h: number
	} | null>(null)
	useEffect(() => {
		if (!spot) {
			setBox(null)
			return
		}
		let frame = 0
		const measure = () => {
			frame = 0
			const el = findSpot(spot)
			if (!el) return setBox(null)
			const r = el.getBoundingClientRect()
			setBox({
				x: r.left + window.scrollX,
				y: r.top + window.scrollY,
				w: r.width,
				h: r.height,
			})
		}
		const later = () => {
			if (!frame) frame = requestAnimationFrame(measure)
		}
		measure()
		// A sideways row (cast) scrolls under it.
		document.addEventListener("scroll", later, { capture: true, passive: true })
		window.addEventListener("resize", later)
		return () => {
			document.removeEventListener("scroll", later, { capture: true })
			window.removeEventListener("resize", later)
			cancelAnimationFrame(frame)
		}
	}, [spot])
	if (!box || !spot) return null
	// Clipped to the page's width: a spot on a card scrolled out of a sideways row must not widen the page.
	return createPortal(
		<div
			aria-hidden
			data-feedback-private
			data-fix-spots
			className="pointer-events-none absolute top-0 left-0 z-[1000] overflow-clip"
			style={{
				width: document.documentElement.clientWidth,
				height: document.documentElement.scrollHeight,
			}}
		>
			<div
				data-fix-spot={spot}
				className="pointer-events-none absolute top-0 left-0 rounded-xl ring-2 ring-amber-300 shadow-[0_0_0_4px_rgba(251,191,36,.25),0_0_24px_4px_rgba(251,191,36,.35)] transition-opacity duration-150 ease-out motion-reduce:transition-none"
				style={{
					transform: `translate(${box.x - 4}px, ${box.y - 4}px)`,
					width: box.w + 8,
					height: box.h + 8,
					opacity: visible ? 1 : 0,
				}}
			/>
		</div>,
		document.body,
	)
}
