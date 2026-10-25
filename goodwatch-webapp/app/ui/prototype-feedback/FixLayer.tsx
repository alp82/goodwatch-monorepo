// PROTOTYPE - throwaway. Fix mode's page layer (round 3):
// - A dark scrim over everything that can't be picked, with cut-outs around the choosable blocks. It lives in page
//   coordinates (absolute in <body>), so it scrolls with the page for free and never moves the layout. Clicks pass
//   through; only the look changes.
// - A spotlight ring on the part of a block a chip stands for (a provider tile, a cast card, a score, an episode), while
//   the chip is hovered or focused, or for the picked answer.
// - The scrim and reveal() live in fix-scrim.tsx (no fixtures), shared with the root layout's dock.
import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import {
	DimHeader,
	Scrim,
	first,
	reveal,
	useFadePresence,
} from "~/ui/prototype-feedback/fix-scrim"
import person from "~/ui/prototype-feedback/fixture-person.json"
import { CAST, SCORE_SOURCES } from "~/ui/prototype-feedback/model"
import { useFeedback } from "~/ui/prototype-feedback/store"

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

export function revealArea(area: string) {
	reveal(first(`[data-fix-overlay="${area}"]`))
}

function Spotlight({ spot: next }: { spot: string | null }) {
	// The last spot stays for the fade out, so the ring never just vanishes.
	const { mounted, shown } = useFadePresence(Boolean(next), 160)
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
			className="pointer-events-none absolute top-0 left-0 z-[1000] overflow-clip"
			style={{
				width: document.documentElement.clientWidth,
				height: document.documentElement.scrollHeight,
			}}
		>
			<div
				data-fix-spot={spot}
				data-feedback-private
				aria-hidden
				className="pointer-events-none absolute top-0 left-0 z-[1000] rounded-xl ring-2 ring-amber-300 shadow-[0_0_0_4px_rgba(251,191,36,.25),0_0_24px_4px_rgba(251,191,36,.35)] transition-opacity duration-150 ease-out motion-reduce:transition-none"
				style={{
					transform: `translate(${box.x - 4}px, ${box.y - 4}px)`,
					width: box.w + 8,
					height: box.h + 8,
					opacity: shown ? 1 : 0,
				}}
			/>
		</div>,
		document.body,
	)
}

/** Mounted by the prototype route: the scrim while fix mode is on, and the chip spotlight. */
export function FixLayer() {
	const { fixMode, fixDone, variant, spot, pinned } = useFeedback()
	// A sent report ends the page layer too; the panel keeps its thanks.
	const on = variant === "C" && fixMode && !fixDone
	// A hovered chip's part comes into view at once, as it lights up (reveal() keeps rapid sweeps from fighting).
	useEffect(() => {
		if (on && spot) reveal(findSpot(spot))
	}, [on, spot])
	return (
		<>
			{/* The fixed site header (above the scrim) and the page's sticky bar dim themselves, so a cut-out scrolled under
			    them never lights them up. */}
			<DimHeader on={on} />
			<Scrim on={on} />
			<Spotlight spot={on ? (spot ?? pinned) : null} />
		</>
	)
}
