// PROTOTYPE (start page lab): f "Printed covers" helper: a poster drawn as the printed cover inside a painted Blu-ray
// case: the room's light and color over it, darker away from the lamp, a faint plastic sheen, a hairline inner shadow
// where it meets the case, and no frame of its own.
import type { ReactNode } from "react"
import { tmdbImage } from "../../lab/kit"
import type { LabCard } from "../../lab/types"
import type { SlotLight } from "./cover-light"

export type CoverSize = "w185" | "w342"

/** w185 while the slot is small on screen (in device px), else w342. */
export const coverSize = (screenW: number): CoverSize =>
	screenW * (typeof window === "undefined" ? 1 : window.devicePixelRatio || 1) <= 200 ? "w185" : "w342"

export function CoverPoster({
	card,
	size,
	light,
	/** Element px per screen px (the slot element is 300 px wide and scaled onto the slot). */
	unit,
	lifted,
	pixel,
	children,
}: {
	card: LabCard
	size: CoverSize
	light: SlotLight
	unit: number
	lifted: boolean
	pixel: boolean
	children?: ReactNode
}) {
	const fade = { opacity: lifted ? 0.25 : 1 }
	const hair = Math.max(1, unit)
	const soft = Math.max(1, 2 * unit)
	return (
		<div
			className="relative h-full w-full overflow-hidden transition-transform duration-200 ease-out"
			style={{ transform: lifted ? "translateY(-2%) scale(1.04)" : "none" }}
		>
			<img
				src={tmdbImage(card.poster_path, pixel ? "w185" : size)}
				alt=""
				draggable={false}
				decoding="async"
				className={`absolute inset-0 h-full w-full select-none object-cover ${pixel ? "" : "[image-rendering:auto] [image-rendering:smooth]"}`}
				// Printed ink, not a screen: a little less contrast and color.
				style={{ filter: "saturate(0.86) contrast(0.9) brightness(1.02)", ...(pixel ? { imageRendering: "pixelated" } : null) }}
			/>
			{/* The room's light and color. */}
			<div
				className="absolute inset-0 mix-blend-multiply transition-opacity duration-200"
				style={{ background: light.tint, ...fade }}
			/>
			{/* Darker toward the side away from the lamp. */}
			<div
				className="absolute inset-0 transition-opacity duration-200"
				style={{
					background: `linear-gradient(${light.shadeAngle}deg, rgba(10,5,0,0) 18%, rgba(10,5,0,${light.shade}) 100%)`,
					...fade,
				}}
			/>
			{/* The plastic sleeve: one soft diagonal highlight, faint. */}
			<div
				className="absolute inset-0 mix-blend-screen"
				style={{
					background: `linear-gradient(${light.sheenAngle + 180 - 35}deg, rgba(255,240,220,0) 30%, rgba(255,240,220,0.09) 44%, rgba(255,240,220,0.02) 56%, rgba(255,240,220,0) 66%)`,
				}}
			/>
			{/* Where the cover meets the case: a hairline and a 2 px soft inner shadow, in screen px. */}
			<div
				className="absolute inset-0"
				style={{
					boxShadow: `inset 0 0 0 ${hair}px rgba(0,0,0,0.42), inset 0 0 ${soft * 1.5}px ${soft * 0.5}px rgba(0,0,0,0.32)`,
				}}
			/>
			{/* Lifted: a soft amber glow on the cover, no frame. */}
			<div
				className="absolute inset-0 transition-opacity duration-200"
				style={{ opacity: lifted ? 1 : 0, boxShadow: `inset 0 0 0 ${2 * hair}px rgba(251,191,36,0.8)` }}
			/>
			{children}
		</div>
	)
}
