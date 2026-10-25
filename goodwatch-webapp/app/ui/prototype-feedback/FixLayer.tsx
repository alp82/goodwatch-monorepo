// PROTOTYPE - throwaway. Fix mode's page layer (round 3):
// - A dark scrim over everything that can't be picked, with cut-outs around the choosable blocks. It lives in page
//   coordinates (absolute in <body>), so it scrolls with the page for free and never moves the layout. Clicks pass
//   through; only the look changes.
// - A spotlight ring on the part of a block a chip stands for (a provider tile, a cast card, a score, an episode), while
//   the chip is hovered or focused, or for the picked answer.
// - reveal(): scrolls a block or part into the visible area (below the header, above a phone sheet), gently.
import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import person from "~/ui/prototype-feedback/fixture-person.json"
import { CAST, SCORE_SOURCES } from "~/ui/prototype-feedback/model"
import { useFeedback } from "~/ui/prototype-feedback/store"

const shown = (el: Element | null | undefined): el is HTMLElement => {
	if (!el) return false
	const r = el.getBoundingClientRect()
	return r.width > 0 && r.height > 0
}
const first = (sel: string, test: (el: HTMLElement) => boolean = () => true) =>
	Array.from(document.querySelectorAll<HTMLElement>(sel)).find(
		(el) => shown(el) && test(el),
	) ?? null

const SOURCE_ALT: Record<string, string> = {
	imdb: "IMDb",
	mc: "Metacritic",
	mcu: "Metacritic",
	rt: "Rotten Tomatoes",
	rtu: "Rotten Tomatoes",
}

/** The element a chip's spot names, or null when the page doesn't show it (a service it isn't listed on). */
export function findSpot(spot: string): HTMLElement | null {
	const [kind, ...parts] = spot.split(":")
	const [a, b] = parts
	switch (kind) {
		case "provider":
			return first(`[data-block="watch"] [data-provider-id="${a}"]`)
		case "offer":
			return first(`[data-block="watch"] [data-replay-tap="offer:${a}"]`)
		case "country":
			return first(`[data-block="watch"] button[data-country]`)
		case "person": {
			const name = CAST.find((c) => String(c.id) === a)?.name
			return name
				? first(`[data-block="cast"] [data-cast-index]`, (el) =>
						Boolean(el.querySelector(`[title="${CSS.escape(name)}"]`)),
					)
				: null
		}
		case "source": {
			if (a === "gw")
				return first(`[data-block="scores"] [data-hero-ratings] > div`)
			const alt = SOURCE_ALT[a]
			if (!alt || !SCORE_SOURCES.some((s) => s.id === a)) return null
			return (
				first(`[data-block="scores"] img[alt="${alt}"]`)?.closest<HTMLElement>(
					"a",
				) ?? null
			)
		}
		case "season":
			return first(`[data-block="episodes"] [aria-label^="Season ${a}"]`)
		case "episode":
			return first(
				`[data-block="episodes"] button[aria-label^="S${a} E${b} ·"]`,
			)
		case "credit": {
			const title = person.knownFor.find(
				(c) => c.key === parts.join(":"),
			)?.title
			if (!title) return null
			const card = first(
				`[data-block="credits"] a`,
				(el) =>
					(el.textContent ?? "").includes(title) ||
					Boolean(el.querySelector(`img[alt*="${CSS.escape(title)}"]`)),
			)
			return card
		}
	}
	return null
}

const reduced = () =>
	typeof window !== "undefined" &&
	window.matchMedia("(prefers-reduced-motion: reduce)").matches

/** The part of the window the page shows: below the fixed header, above a phone sheet. */
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

/** Brings an element into the clear area when it's (partly) outside it; a horizontal row scrolls to it too. */
export function reveal(el: HTMLElement | null) {
	if (!el) return
	const behavior: ScrollBehavior = reduced() ? "auto" : "smooth"
	// A card in a sideways row: scroll the row first.
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
	if (r.top >= top && r.bottom <= bottom) return
	const room = bottom - top
	const target =
		r.height > room ? r.top - top : r.top - top - (room - r.height) / 2
	window.scrollBy({ top: target, behavior })
}

export function revealArea(area: string) {
	reveal(first(`[data-fix-overlay="${area}"]`))
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
		for (const el of document.querySelectorAll("[data-block]")) ro.observe(el)
		window.addEventListener("resize", later)
		// Fonts and lazy images settle a moment later.
		const t = window.setTimeout(later, 400)
		return () => {
			ro.disconnect()
			window.removeEventListener("resize", later)
			window.clearTimeout(t)
			cancelAnimationFrame(frame)
		}
	}, [on])
	return state
}

function Scrim({ on }: { on: boolean }) {
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

function Spotlight({ spot }: { spot: string | null }) {
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
	if (!box) return null
	return createPortal(
		<div
			data-fix-spot={spot}
			data-feedback-private
			aria-hidden
			className="pointer-events-none absolute top-0 left-0 z-[1000] rounded-xl ring-2 ring-amber-300 shadow-[0_0_0_4px_rgba(251,191,36,.25),0_0_24px_4px_rgba(251,191,36,.35)] motion-safe:animate-[fixspot_.2s_ease-out]"
			style={{
				transform: `translate(${box.x - 4}px, ${box.y - 4}px)`,
				width: box.w + 8,
				height: box.h + 8,
			}}
		>
			<style>{"@keyframes fixspot{from{opacity:0}}"}</style>
		</div>,
		document.body,
	)
}

/** Mounted by the prototype route: the scrim while fix mode is on, and the chip spotlight. */
export function FixLayer() {
	const { fixMode, variant, spot, pinned } = useFeedback()
	const on = variant === "C" && fixMode
	// Reveal a hovered chip's part after a short rest, so sweeping across chips doesn't scroll the page around.
	useEffect(() => {
		if (!on || !spot) return
		const t = window.setTimeout(() => reveal(findSpot(spot)), 350)
		return () => window.clearTimeout(t)
	}, [on, spot])
	return (
		<>
			{/* The fixed site header (above the scrim) and the page's sticky bar dim themselves, so a cut-out scrolled under
			    them never lights them up. */}
			{on && (
				<style>
					{
						"[data-site-header],[data-feedback-page] .sticky{filter:brightness(.28);transition:filter .2s ease-out}"
					}
				</style>
			)}
			<Scrim on={on} />
			<Spotlight spot={on ? (spot ?? pinned) : null} />
		</>
	)
}
