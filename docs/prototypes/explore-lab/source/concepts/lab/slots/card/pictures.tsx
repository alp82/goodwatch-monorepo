// PROTOTYPE - throwaway (prototype/explore-r5). The picture of each family: what a place IS, drawn so a person can
// tell a mood from a genre from a country without reading.
//
//   mood     its color as a light: a sun in the card's corner. A calm mood glows soft and wide, an intense one burns
//            small and sharp; a lighter mood lights more of the card.
//   genre    its form: the 74 scores of its fingerprint against the usual, in the fingerprint's own colors. What the
//            genre has more of rises, what it has less of hangs; the peaks are its words.
//   decade   its numerals, and its place on the line of decades.
//   country  its outline filled with its flag, as on a globe turned to face it.
//   service  its logo, lit by its own colors.
//   theme    a subject: a colored tab down the card's edge.   style: a way of filming: a viewfinder's corners.
import type { CSSProperties } from "react"
import type { PlaceRef } from "../../../../kit/types"
import { poster } from "../../../../kit/ui"
import { hasCountryShape } from "../../../../kit/world-map/CountryShape"
import { FlagShape } from "../../../../kit/world-map/FlagShape"
import type { Marks } from "./marks.server"

export type Size = "s" | "m" | "l"

const NAVY = "#131926"
const mix = (hue: string, share: number, into = NAVY) =>
	`color-mix(in oklab, ${hue} ${share}%, ${into})`
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

// ---------------------------------------------------------------------------------------------------------
// Mood: light

/**
 * Fills its (relative, clipped) parent. `corner` is where the sun sits: "tr" for a card, "l" for a compact row or a
 * spine's foot.
 */
export function MoodLight({
	hue,
	at,
	corner = "tr",
	strength = 1,
}: {
	hue: string
	at?: Marks["moods"][string]
	corner?: "tr" | "l" | "b"
	strength?: number
}) {
	const tone = at?.tone ?? 0.5
	const pace = at?.pace ?? 0.5
	// Lighter moods light more of the card; intense moods burn smaller and sharper.
	const reach = lerp(150, 100, tone)
	const blur = lerp(20, 3, pace)
	const size = lerp(58, 40, pace)
	const origin = corner === "tr" ? "92% -6%" : corner === "l" ? "-4% 50%" : ("50% 108%" as const)
	const orb: CSSProperties =
		corner === "tr"
			? // In a wide lead card the sun stays a sun in the corner: it doesn't grow over the text.
				{
					right: `calc(min(${size}%, 19rem) * -0.2)`,
					top: 0,
					width: `min(${size}%, 19rem)`,
					translate: "0 -42%",
				}
			: corner === "l"
				? { left: 0, top: "50%", height: "150%", translate: "-52% -50%" }
				: { left: "50%", bottom: 0, width: "min(150%, 15rem)", translate: "-50% 62%" }
	return (
		<span aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
			<span
				className="absolute inset-0 transition-opacity duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/card:opacity-100"
				style={{
					opacity: 0.86 * strength,
					background: `radial-gradient(${reach}% ${reach * 0.95}% at ${origin}, ${mix(hue, 52)} 0%, ${mix(hue, 24)} 38%, ${mix(hue, 7)} 68%, transparent 100%)`,
				}}
			/>
			<span
				className="absolute aspect-square rounded-full transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform group-hover/card:scale-110 motion-reduce:transition-none motion-reduce:group-hover/card:scale-100"
				style={{
					...orb,
					background: `radial-gradient(circle at 42% 58%, ${mix(hue, 62, "#ffffff")} 0%, ${hue} 46%, ${mix(hue, 72)} 100%)`,
					filter: `blur(${blur}px)`,
					boxShadow: `0 0 ${lerp(70, 34, pace)}px ${lerp(6, 0, pace)}px ${mix(hue, 70, "transparent")}`,
					opacity: lerp(0.82, 1, pace) * strength,
				}}
			/>
		</span>
	)
}

// ---------------------------------------------------------------------------------------------------------
// Genre: form

const UP = 45
const DOWN = 32
/** A small difference still shows; a large one doesn't dwarf the rest. 0-1. */
const reachOf = (d: number) => Math.min(1, Math.abs(d) / (d >= 0 ? UP : DOWN)) ** 0.5

/** The 74 scores in bins of `per` neighbors of one family: each bin shows its strongest difference. */
function binsOf(deltas: number[], bars: Marks["bars"], per: number, lit: string[] = []) {
	const bins: { d: number; color: string; on: boolean; id: string }[] = []
	let i = 0
	while (i < deltas.length) {
		const family = bars[i]?.family
		let end = i
		while (end < deltas.length && end < i + per && bars[end]?.family === family) end++
		const slice = deltas.slice(i, end)
		bins.push({
			d: slice.reduce((a, x) => (Math.abs(x) > Math.abs(a) ? x : a), 0),
			color: bars[i]?.color ?? "#fff",
			on: bars.slice(i, end).some((x) => lit.includes(x.key)),
			id: bars[i]?.key ?? String(i),
		})
		i = end
	}
	return bins
}

/**
 * The genre's form. `deltas` are tenths of a point from the usual, in fingerprint order. What the genre has more of
 * rises from the line, what it has less of hangs under it. The bars named in `lit` (the genre's words) are drawn at
 * full strength. Stretches to its parent's width; `height` in px.
 */
export function GenreForm({
	deltas,
	bars,
	lit,
	height = 64,
	per = 2,
	className = "",
}: {
	deltas: number[]
	bars: Marks["bars"]
	lit: string[]
	height?: number
	per?: number
	className?: string
}) {
	const bins = binsOf(deltas, bars, per, lit)
	const above = Math.round(height * 0.68)
	return (
		<span
			aria-hidden
			className={`relative flex w-full items-stretch justify-between gap-[2px] ${className}`}
			style={{ height }}
		>
			<span className="absolute inset-x-0 h-px bg-white/15" style={{ top: above }} />
			{bins.map((b, i) => {
				const reach = reachOf(b.d)
				const up = b.d >= 0
				const px = Math.max(3, reach * (up ? above - 1 : height - above - 2))
				return (
					<span key={b.id} className="relative max-w-2 min-w-0 flex-1">
						<span
							className="absolute inset-x-0 rounded-full group-hover/card:[animation:card-form_700ms_ease-out_both] motion-reduce:group-hover/card:[animation:none]"
							style={{
								height: px,
								...(up ? { bottom: height - above + 1 } : { top: above + 2 }),
								background: b.color,
								opacity: b.on ? 1 : up ? 0.42 : 0.2,
								boxShadow: b.on ? `0 0 14px ${b.color}88` : undefined,
								transformOrigin: up ? "50% 100%" : "50% 0%",
								animationDelay: `${i * 12}ms`,
							}}
						/>
					</span>
				)
			})}
		</span>
	)
}

/** The genre's form standing up, for a spine: more of it reaches right of the line, less of it left. Fills its parent's height. */
export function GenreColumn({
	deltas,
	bars,
	lit,
	className = "",
}: {
	deltas: number[]
	bars: Marks["bars"]
	lit: string[]
	className?: string
}) {
	const bins = binsOf(deltas, bars, 2, lit)
	return (
		<span
			aria-hidden
			className={`relative flex w-full flex-col justify-between gap-[2px] ${className}`}
		>
			<span className="absolute inset-y-0 left-[34%] w-px bg-white/15" />
			{bins.map((b) => {
				const up = b.d >= 0
				return (
					<span key={b.id} className="relative max-h-2 min-h-0 flex-1">
						<span
							className="absolute inset-y-0 rounded-full"
							style={{
								...(up
									? { left: "calc(34% + 2px)", width: `max(3px, ${reachOf(b.d) * 58}%)` }
									: { right: "calc(66% + 1px)", width: `max(3px, ${reachOf(b.d) * 28}%)` }),
								background: b.color,
								opacity: b.on ? 1 : up ? 0.45 : 0.2,
								boxShadow: b.on ? `0 0 10px ${b.color}88` : undefined,
							}}
						/>
					</span>
				)
			})}
		</span>
	)
}

/** A genre's form at mark size: the same bars in coarser bins, so they stay bars at 30 px. */
export function GenreGlyph({
	deltas,
	bars,
	size = 40,
}: {
	deltas: number[]
	bars: Marks["bars"]
	size?: number
}) {
	const bins = binsOf(deltas, bars, 6)
	const above = size * 0.66
	return (
		<span
			aria-hidden
			className="relative flex shrink-0 items-stretch gap-px"
			style={{ height: size, width: Math.round(size * 1.3) }}
		>
			{bins.map((b) => {
				const up = b.d >= 0
				const px = Math.max(2, reachOf(b.d) * (up ? above : size - above - 1))
				return (
					<span key={b.id} className="relative min-w-0 flex-1">
						<span
							className="absolute inset-x-0 rounded-full"
							style={{
								height: px,
								...(up ? { bottom: size - above } : { top: above + 1 }),
								background: b.color,
								opacity: up ? 0.95 : 0.35,
							}}
						/>
					</span>
				)
			})}
		</span>
	)
}

// ---------------------------------------------------------------------------------------------------------
// Decade: numerals and its place in time

export const decadeParts = (place: PlaceRef) => {
	const m = /^(\d{2})(\d{2})s?$/.exec(place.slug) ?? /^(\d{2})(\d{2})/.exec(place.label)
	return m ? { century: m[1], decade: `${m[2]}s` } : { century: "", decade: place.label }
}

/** The line of decades with this one lit: where in time the card is. */
export function TimeLine({
	slug,
	decades,
	className = "",
}: {
	slug: string
	decades: string[]
	className?: string
}) {
	if (decades.length < 2) return null
	return (
		<span aria-hidden className={`flex items-end gap-[5px] ${className}`}>
			{decades.map((d) => (
				<span
					key={d}
					className={
						d === slug
							? "h-3 w-[3px] rounded-full bg-amber-300 shadow-[0_0_8px_rgba(252,211,77,0.7)]"
							: "h-1.5 w-[3px] rounded-full bg-white/20"
					}
				/>
			))}
		</span>
	)
}

/** The decade's numerals as the picture: "90s" large, the century small above it. `px` is the numerals' size. */
export function Numerals({ place, px }: { place: PlaceRef; px: number }) {
	const { century, decade } = decadeParts(place)
	return (
		<span aria-hidden className="relative block select-none font-display font-extrabold">
			<span
				className="block bg-gradient-to-b from-white via-white to-slate-400/70 bg-clip-text leading-[0.86] tracking-[-0.055em] text-transparent"
				style={{ fontSize: px }}
			>
				{century && (
					<span
						className="mr-[0.06em] inline-block align-top font-bold tracking-normal text-slate-500"
						style={{ fontSize: px * 0.3, lineHeight: 1.25, WebkitTextFillColor: "currentColor" }}
					>
						{century}
					</span>
				)}
				{decade.slice(0, -1)}
				<span style={{ fontSize: px * 0.56 }}>{decade.slice(-1)}</span>
			</span>
		</span>
	)
}

// ---------------------------------------------------------------------------------------------------------
// Country: its shape filled with its flag (round 7: the owner's rule for every country). A territory too small for a
// shape is a round flag, drawn smaller so it doesn't outweigh the shapes beside it.

export function Outline({ place, px }: { place: PlaceRef; px: number }) {
	if (!place.code) return null
	return (
		<span
			aria-hidden
			className="flex items-center justify-start text-slate-200 transition-colors duration-300 group-hover/card:text-white"
			style={{ height: px }}
		>
			{/* Round 7: a country wears its flag (the owner asked for it everywhere a country is listed). */}
			<FlagShape
				code={place.code}
				size={hasCountryShape(place.code) ? px : Math.round(px * 0.6)}
				className="max-h-full drop-shadow-[0_6px_18px_rgba(148,163,184,0.22)]"
			/>
		</span>
	)
}

// ---------------------------------------------------------------------------------------------------------
// Service: logo

/** The logo, with its own colors as light behind it (the same image, blurred). */
export function Logo({ place, px, glow = true }: { place: PlaceRef; px: number; glow?: boolean }) {
	// A service without a logo in the data still gets a mark of its own: its initial on a plate.
	if (!place.logo)
		return (
			<span
				aria-hidden
				className="relative grid shrink-0 place-items-center rounded-[22%] bg-white/10 font-display font-black text-white ring-1 ring-white/15"
				style={{ width: px, height: px, fontSize: px * 0.44 }}
			>
				{place.label.replace(/[^A-Za-z0-9]/g, "").slice(0, 1)}
			</span>
		)
	const src = poster(place.logo, "w154")
	return (
		<span aria-hidden className="relative block shrink-0" style={{ width: px, height: px }}>
			{glow && (
				<img
					src={src}
					alt=""
					loading="lazy"
					className="pointer-events-none absolute inset-0 h-full w-full scale-[2.4] rounded-full opacity-45 blur-2xl saturate-150 transition-opacity duration-500 group-hover/card:opacity-70"
				/>
			)}
			<img
				src={src}
				alt=""
				loading="lazy"
				className="relative h-full w-full rounded-[22%] shadow-lg shadow-black/40 ring-1 ring-white/15"
			/>
		</span>
	)
}

// ---------------------------------------------------------------------------------------------------------
// Theme and style

/** A theme is a subject: a colored tab down the card's leading edge. */
export function ThemeTab({ hue }: { hue: string }) {
	return (
		<span aria-hidden className="pointer-events-none absolute inset-0">
			<span
				className="absolute inset-y-0 left-0 w-28"
				style={{ background: `linear-gradient(90deg, ${mix(hue, 26)} 0%, transparent 100%)` }}
			/>
			<span
				className="absolute inset-y-3 left-0 w-1 rounded-r-full"
				style={{ background: hue, boxShadow: `0 0 14px ${mix(hue, 60, "transparent")}` }}
			/>
		</span>
	)
}

/** A style is a way of filming: a viewfinder's corners in its color. */
export function StyleFrame({ hue }: { hue: string }) {
	const corner =
		"absolute h-4 w-4 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
	const line = { borderColor: hue }
	return (
		<span aria-hidden className="pointer-events-none absolute inset-2.5">
			<span
				className={`${corner} left-0 top-0 rounded-tl-md border-l-2 border-t-2 group-hover/card:-translate-x-0.5 group-hover/card:-translate-y-0.5`}
				style={line}
			/>
			<span
				className={`${corner} right-0 top-0 rounded-tr-md border-r-2 border-t-2 group-hover/card:-translate-y-0.5 group-hover/card:translate-x-0.5`}
				style={line}
			/>
			<span
				className={`${corner} bottom-0 left-0 rounded-bl-md border-b-2 border-l-2 group-hover/card:-translate-x-0.5 group-hover/card:translate-y-0.5`}
				style={line}
			/>
			<span
				className={`${corner} bottom-0 right-0 rounded-br-md border-b-2 border-r-2 group-hover/card:translate-x-0.5 group-hover/card:translate-y-0.5`}
				style={line}
			/>
		</span>
	)
}

/** The keyframes the pictures use; rendered once per card (identical rules, so repeats are harmless). */
const KEYFRAMES =
	"@keyframes card-form{0%{transform:scaleY(1)}35%{transform:scaleY(1.22)}100%{transform:scaleY(1)}}"

export function PictureStyles() {
	// oxlint-disable-next-line react/no-danger -- a constant stylesheet
	return <style dangerouslySetInnerHTML={{ __html: KEYFRAMES }} />
}
