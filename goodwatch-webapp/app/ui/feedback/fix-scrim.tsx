// Fix mode's page layer, shared by the desktop drawer and the phone sheet:
// - Scrim: a dark layer over everything that can't be picked, with cut-outs around [data-fix-overlay] and
//   [data-fix-badge]. It lives in page coordinates (absolute in <body>), so it scrolls with the page for free and never
//   moves the layout. Clicks pass through.
// - reveal(): brings an element into the visible area (below the header, clear of a phone's feedback drawer), smoothly.
//   Rapid hovering doesn't make scrolls fight: each call aims at an absolute position, a new aim replaces the running
//   one, and "is it on screen" is judged against where the running scroll will end, not where it is now.
// - DimHeader: in fix mode the site header and the title page's sticky bar scroll away with the page.
import { useEffect, useState } from "react"
import { createPortal } from "react-dom"

/** The page's own sticky bars (the title page's header), which stop sticking in fix mode. */
const STICKY = "[data-details-header]"

export const shown = (el: Element | null | undefined): el is HTMLElement => {
	if (!el) return false
	const r = el.getBoundingClientRect()
	return r.width > 0 && r.height > 0
}
export const first = (
	sel: string,
	test: (el: HTMLElement) => boolean = () => true,
) =>
	Array.from(document.querySelectorAll<HTMLElement>(sel)).find(
		(el) => shown(el) && test(el),
	) ?? null

export const reduced = () =>
	typeof window !== "undefined" &&
	window.matchMedia("(prefers-reduced-motion: reduce)").matches

/** The part of the window the page shows: below the fixed header and sticky bars, clear of a phone's feedback drawer. */
export function clearArea() {
	const header =
		document.querySelector("[data-site-header]")?.getBoundingClientRect()
			.bottom ?? 0
	// Phones: the bar or sheet at the bottom (with its handle) ends the clear part; while answering, the page's sticky
	// bar steps aside, so the part can sit right under the header.
	const sheet = document.querySelector<HTMLElement>("[data-fix-sheet]")
	if (sheet) {
		const answering =
			document.documentElement.getAttribute("data-fix-phone") === "answer"
		const stickyBottom = answering
			? header
			: Array.from(document.querySelectorAll<HTMLElement>(STICKY)).reduce(
					(m, el) => {
						const r = el.getBoundingClientRect()
						return r.top <= header + 1 && r.bottom > m ? r.bottom : m
					},
					header,
				)
		// Where the sheet rests (handle included), not where a running slide has it now.
		const panel = sheet.querySelector<HTMLElement>("[data-fix-panel]")
		const row = Number(sheet.dataset.fixRow) || 56
		const handle = Number(sheet.dataset.fixHandleH) || 0
		const rest = panel
			? window.innerHeight -
				(sheet.hasAttribute("data-mini") ? row : panel.offsetHeight) -
				handle
			: sheet.getBoundingClientRect().top
		return { top: stickyBottom + 12, bottom: rest - 12 }
	}
	const sticky = Array.from(
		document.querySelectorAll<HTMLElement>(STICKY),
	).reduce((m, el) => {
		const r = el.getBoundingClientRect()
		return r.top <= header + 1 && r.bottom > m ? r.bottom : m
	}, header)
	const top = sticky + 12
	const bottom = window.innerHeight - 12
	// A phone's feedback drawer covers most of the width: the clear part is the larger one above or below it.
	const card = document
		.querySelector("[data-feedback-panel][data-open] [data-feedback-card]")
		?.getBoundingClientRect()
	if (!card || card.width < window.innerWidth * 0.6) return { top, bottom }
	return card.top - 12 - top >= bottom - (card.bottom + 12)
		? { top, bottom: card.top - 12 }
		: { top: card.bottom + 12, bottom }
}

/** Where the running smooth scroll will end; null when the page isn't scrolling for us. */
let aim: number | null = null

/** Brings an element into the clear area when it's (partly) outside it; a sideways row scrolls to it too. */
export function reveal(el: HTMLElement | null) {
	if (!el) return
	const behavior: ScrollBehavior = reduced() ? "auto" : "smooth"
	for (
		let p = el.parentElement;
		p && p !== document.body;
		p = p.parentElement
	) {
		const st = getComputedStyle(p)
		if (
			(st.overflowX === "auto" || st.overflowX === "scroll") &&
			p.scrollWidth > p.clientWidth
		) {
			const pr = p.getBoundingClientRect()
			const r = el.getBoundingClientRect()
			if (r.left < pr.left || r.right > pr.right)
				p.scrollBy({
					left: r.left - pr.left - (pr.width - r.width) / 2,
					behavior,
				})
			break
		}
	}
	const { top, bottom } = clearArea()
	// A phone sheet can leave next to no room above it; then the sheet shows the part, not the page.
	if (bottom - top < 64) return
	const r = el.getBoundingClientRect()
	const now = window.scrollY
	const end = aim ?? now
	// The element's place in the window once the running scroll ends.
	const at = r.top + now - end
	if (at >= top && at + r.height <= bottom) return
	const room = bottom - top
	const offset = r.height > room ? top : top + (room - r.height) / 2
	const max = document.documentElement.scrollHeight - window.innerHeight
	const target = Math.max(0, Math.min(max, r.top + now - offset))
	if (Math.abs(target - end) < 2) return
	aim = behavior === "smooth" ? target : null
	window.scrollTo({ top: target, behavior })
}

type Hole = { x: number; y: number; w: number; h: number; r: number }

function useHoles(on: boolean) {
	const [state, setState] = useState<{ w: number; h: number; holes: Hole[] }>({
		w: 0,
		h: 0,
		holes: [],
	})
	useEffect(() => {
		if (!on) return
		let frame = 0
		const measure = () => {
			frame = 0
			const sx = window.scrollX
			const sy = window.scrollY
			const holes: Hole[] = []
			for (const el of document.querySelectorAll<HTMLElement>(
				"[data-fix-overlay], [data-fix-badge]",
			)) {
				const r = el.getBoundingClientRect()
				if (!r.width || !r.height) continue
				const pad = el.hasAttribute("data-fix-badge") ? 3 : 2
				holes.push({
					x: r.left + sx - pad,
					y: r.top + sy - pad,
					w: r.width + pad * 2,
					h: r.height + pad * 2,
					r: el.hasAttribute("data-fix-badge") ? 999 : 18,
				})
			}
			// The page's own height, measured without this layer, so the scrim never makes the page longer.
			const self = document.querySelector<SVGElement>("[data-fix-scrim]")
			if (self) self.style.display = "none"
			const h = document.documentElement.scrollHeight
			if (self) self.style.display = ""
			setState({ w: document.documentElement.clientWidth, h, holes })
		}
		const later = () => {
			if (!frame) frame = requestAnimationFrame(measure)
		}
		measure()
		const ro = new ResizeObserver(later)
		ro.observe(document.body)
		for (const el of document.querySelectorAll(
			"[data-feedback-area], [data-fix-overlay]",
		))
			ro.observe(el)
		window.addEventListener("resize", later)
		window.addEventListener("fix-layout", later)
		// Fonts and lazy images settle a moment later.
		const t = window.setTimeout(later, 400)
		return () => {
			ro.disconnect()
			window.removeEventListener("resize", later)
			window.removeEventListener("fix-layout", later)
			window.clearTimeout(t)
			cancelAnimationFrame(frame)
		}
	}, [on])
	return state
}

export function Scrim({ on }: { on: boolean }) {
	useEffect(() => {
		if (!on) return
		const reset = () => {
			aim = null
		}
		window.addEventListener("scrollend", reset)
		return () => {
			window.removeEventListener("scrollend", reset)
			reset()
		}
	}, [on])
	// Stays mounted for the fade out.
	const { mounted, shown: visible } = useFadePresence(on, 240)
	const { w, h, holes } = useHoles(mounted)
	if (!mounted || !w) return null
	return createPortal(
		<svg
			data-fix-scrim
			data-feedback-private
			aria-hidden="true"
			role="presentation"
			width={w}
			height={h}
			className="pointer-events-none absolute top-0 left-0 z-[999] transition-opacity duration-200 ease-out motion-reduce:transition-none"
			style={{ opacity: visible ? 1 : 0 }}
		>
			<defs>
				<mask
					id="fix-scrim-mask"
					maskUnits="userSpaceOnUse"
					x="0"
					y="0"
					width={w}
					height={h}
				>
					<rect width={w} height={h} fill="white" />
					{holes.map((o) => (
						<rect
							key={`${o.x},${o.y},${o.w}`}
							x={o.x}
							y={o.y}
							width={o.w}
							height={o.h}
							rx={Math.min(o.r, o.h / 2)}
							fill="black"
						/>
					))}
				</mask>
			</defs>
			<rect
				width={w}
				height={h}
				fill="rgb(3 7 18)"
				fillOpacity={0.72}
				mask="url(#fix-scrim-mask)"
			/>
		</svg>,
		document.body,
	)
}

/**
 * Mounted while `on`, and for a short fade after: `shown` turns true a frame after mounting (so the fade in runs) and
 * false at once when `on` ends; `mounted` follows `ms` later. Everything fix mode puts on the page uses it, so nothing
 * lingers and nothing pops.
 */
export function useFadePresence(on: boolean, ms = 200) {
	const [mounted, setMounted] = useState(on)
	const [shown, setShown] = useState(false)
	useEffect(() => {
		if (on) {
			setMounted(true)
			const f = requestAnimationFrame(() =>
				requestAnimationFrame(() => setShown(true)),
			)
			return () => cancelAnimationFrame(f)
		}
		setShown(false)
		const t = window.setTimeout(() => setMounted(false), reduced() ? 0 : ms)
		return () => window.clearTimeout(t)
	}, [on, ms])
	return { mounted, shown }
}

/**
 * While fix mode is on, the site header and the page's sticky bar stop following the page: the header stays at the
 * top of the page and the bar in its place, so both scroll away like the rest. A picked part can then sit at the very
 * top of the window, and nothing draws over it. Neither changes size, so nothing on the page moves. Their scrim-colored
 * tint fades (opacity) before the rule goes.
 */
export function DimHeader({ on }: { on: boolean }) {
	const { mounted, shown } = useFadePresence(on, 220)
	if (!mounted) return null
	const bars = `[data-site-header],${STICKY}`
	return (
		<style data-fix-dim>
			{`[data-site-header]{position:absolute!important}
${STICKY}{position:relative!important}
${bars
	.split(",")
	.map((b) => `${b}::after`)
	.join(
		",",
	)}{content:"";position:absolute;inset:0;pointer-events:none;z-index:2;background:rgb(3 7 18);opacity:${shown ? 0.72 : 0};transition:opacity .2s ease-out}
html[data-fix-phone="answer"] [data-site-header]::after{opacity:0}`}
		</style>
	)
}
