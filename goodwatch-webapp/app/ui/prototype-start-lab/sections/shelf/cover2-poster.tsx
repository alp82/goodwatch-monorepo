// PROTOTYPE (start page lab): g/h "Covers, clean edges" helper: f's printed cover drawn over a box that bleeds past the
// painted slot (so it hides the slot's magenta fringe), with a soft dark outer band that reads as the case rim.
// `cased` (h) adds a drawn Blu-ray case: a clear plastic rim with a faint highlight and the blue header band.
import type { ReactNode } from "react"
import { tmdbImage } from "../../lab/kit"
import type { LabCard } from "../../lab/types"
import type { SlotLight } from "./cover-light"
import type { CoverSize } from "./cover-poster"

/** The blue header band's share of the cover's height (h). */
export const BAND = 0.08

export function CleanCoverPoster({
	card,
	size,
	light,
	unit,
	bleed,
	lifted,
	pixel,
	cased,
	children,
}: {
	card: LabCard
	size: CoverSize
	light: SlotLight
	/** Element px per screen px. */
	unit: number
	/** How far this box reaches past the slot on each side, in element px. */
	bleed: { x: number; y: number }
	lifted: boolean
	pixel: boolean
	cased: boolean
	children?: ReactNode
}) {
	const fade = { opacity: lifted ? 0.25 : 1 }
	const hair = Math.max(1, unit)
	const rim = Math.max(bleed.x, bleed.y)
	// h: the band sits at the top of the cover; the art fills the rest (cropped a little, like a real insert).
	const bandH = `calc(${bleed.y}px + (100% - ${2 * bleed.y}px) * ${BAND})`
	return (
		<div
			className="relative h-full w-full overflow-hidden transition-transform duration-200 ease-out"
			style={{ transform: lifted ? "translateY(-2%) scale(1.04)" : "none", borderRadius: hair * 1.5 }}
		>
			<img
				src={tmdbImage(card.poster_path, pixel ? "w185" : size)}
				alt=""
				draggable={false}
				decoding="async"
				className="absolute h-full w-full select-none object-cover"
				style={{
					left: 0,
					right: 0,
					bottom: 0,
					top: cased ? bandH : 0,
					height: cased ? `calc(100% - ${bandH})` : "100%",
					filter: "saturate(0.86) contrast(0.9) brightness(1.02)",
					imageRendering: pixel ? "pixelated" : "auto",
				}}
			/>
			{/* h: the classic blue header band: no text, no logo. A lit top edge and a dark seam above the art. */}
			{cased ? (
				<div
					className="absolute inset-x-0 top-0"
					style={{
						height: bandH,
						background: "linear-gradient(180deg, #3d8bf0 0%, #1a63d3 38%, #0d47ad 100%)",
						boxShadow: `inset 0 ${hair}px 0 rgba(190,220,255,0.45), 0 ${hair}px 0 rgba(4,14,40,0.55)`,
					}}
				/>
			) : null}
			{/* The room's light and color, over the band too. */}
			<div
				className="absolute inset-0 mix-blend-multiply transition-opacity duration-200"
				style={{ background: light.tint, ...fade }}
			/>
			<div
				className="absolute inset-0 transition-opacity duration-200"
				style={{
					background: `linear-gradient(${light.shadeAngle}deg, rgba(10,5,0,0) 18%, rgba(10,5,0,${light.shade}) 100%)`,
					...fade,
				}}
			/>
			<div
				className="absolute inset-0 mix-blend-screen"
				style={{
					background: `linear-gradient(${light.sheenAngle + 180 - 35}deg, rgba(255,240,220,0) 30%, rgba(255,240,220,0.09) 44%, rgba(255,240,220,0.02) 56%, rgba(255,240,220,0) 66%)`,
				}}
			/>
			{/* The case rim: the bleed band darkens toward the outside, so the extra cover reads as the case's edge. */}
			<div
				className="absolute inset-0"
				style={{
					boxShadow: cased
						? // h: clear plastic: a faint light line on the outer edge, a darker band, and a hairline where the
							// insert sits under the plastic.
							`inset 0 0 0 ${hair}px rgba(255,248,236,0.1), inset 0 0 0 ${2 * hair}px rgba(12,10,8,0.5), inset 0 0 ${rim * 1.2}px ${rim * 0.45}px rgba(12,8,4,0.5), inset 0 0 0 ${rim}px rgba(255,250,240,0.04)`
						: `inset 0 0 0 ${hair}px rgba(0,0,0,0.5), inset 0 0 ${rim * 1.3}px ${rim * 0.5}px rgba(10,6,2,0.55)`,
				}}
			/>
			{cased ? (
				// The plastic's highlight: a thin streak along the edge facing the light.
				<div
					className="absolute inset-0 mix-blend-screen"
					style={{
						background: `linear-gradient(${light.sheenAngle + 180}deg, rgba(255,250,240,0.12) 0, rgba(255,250,240,0) ${rim * 1.4}px)`,
					}}
				/>
			) : null}
			<div
				className="absolute inset-0 transition-opacity duration-200"
				style={{ opacity: lifted ? 1 : 0, boxShadow: `inset 0 0 0 ${2 * hair}px rgba(251,191,36,0.8)` }}
			/>
			{children}
		</div>
	)
}
