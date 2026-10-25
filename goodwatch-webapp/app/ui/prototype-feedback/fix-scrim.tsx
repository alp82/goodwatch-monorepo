// PROTOTYPE - throwaway. Fix mode's page layer parts that need no fixture, so the root layout's dock can use them too:
// - Scrim: a dark layer over everything that can't be picked, with cut-outs around [data-fix-overlay] and
//   [data-fix-badge]. It lives in page coordinates (absolute in <body>), so it scrolls with the page for free and never
//   moves the layout. Clicks pass through.
// - reveal(): brings an element into the visible area (below the header, above a phone sheet), smoothly, at once.
//   Rapid hovering doesn't make scrolls fight: each call aims at an absolute position, a new aim replaces the running
//   one, and "is it on screen" is judged against where the running scroll will end, not where it is now.
import { useEffect, useState } from "react"
import { createPortal } from "react-dom"

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

/** The part of the window the page shows: below the fixed header and sticky bars, above a phone sheet. */
function clearArea() {
	const header =
		document.querySelector("[data-site-header]")?.getBoundingClientRect()
			.bottom ?? 0
	const sticky = Array.from(
		document.querySelectorAll<HTMLElement>("[data-feedback-page] .sticky"),
	).reduce((m, el) => {
		const r = el.getBoundingClientRect()
		return r.top <= header + 1 && r.bottom > m ? r.bottom : m
	}, header)
	const panel = document
		.querySelector("[data-feedback-panel]")
		?.getBoundingClientRect()
	const sheet =
		panel &&
		panel.width >= window.innerWidth - 1 &&
		panel.top < window.innerHeight
			? panel.top
			: window.innerHeight
	return { top: sticky + 12, bottom: sheet - 12 }
}

/** Where the running smooth scroll will end; null when the page isn't scrolling for us. */
let aim: number | null = null
if (typeof window !== "undefined")
	window.addEventListener("scrollend", () => {
		aim = null
	})

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
			"[data-block], [data-fix-overlay]",
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
	// Stays mounted for the fade out.
	const [mounted, setMounted] = useState(on)
	const [visible, setVisible] = useState(false)
	useEffect(() => {
		if (on) {
			setMounted(true)
			const f = requestAnimationFrame(() =>
				requestAnimationFrame(() => setVisible(true)),
			)
			return () => cancelAnimationFrame(f)
		}
		setVisible(false)
		const t = window.setTimeout(() => setMounted(false), reduced() ? 0 : 240)
		return () => window.clearTimeout(t)
	}, [on])
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

/** While fix mode is on, the fixed site header dims itself, so a cut-out scrolled under it never lights it up. */
export const DimHeader = () => (
	<style>
		{
			"[data-site-header],[data-feedback-page] .sticky{filter:brightness(.28);transition:filter .2s ease-out}"
		}
	</style>
)
