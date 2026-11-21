// The small mark that says which family a place belongs to, the same
// everywhere: a mood is its hue, a service its logo, a country its flag-filled shape, a decade its two digits. Themes, styles and
// genres carry no mark of their own (a theme's or style's color is shown as a short bar).
import { FlagShape } from "~/ui/browse/world-map/FlagShape"
import { poster } from "~/ui/browse/base"
import type { PlaceRef } from "~/domain/browse/types"

export function PlaceMark({ place, size = 16 }: { place: PlaceRef; size?: number }) {
	if (place.family === "mood")
		return (
			<span
				aria-hidden
				className="inline-block shrink-0 rounded-full"
				style={{
					width: size * 0.7,
					height: size * 0.7,
					background: place.hue,
					boxShadow: `0 0 ${size * 0.6}px ${place.hue}66`,
				}}
			/>
		)
	if (place.family === "service" && place.logo)
		return (
			<img
				src={poster(place.logo, "w92")}
				alt=""
				loading="lazy"
				className="inline-block shrink-0 rounded-[22%] ring-1 ring-white/10"
				style={{ width: size * 1.25, height: size * 1.25 }}
			/>
		)
	// a country is its shape filled with its flag, everywhere (the owner's rule).
	if (place.family === "country" && place.code)
		return (
			<FlagShape
				code={place.code}
				size={Math.round(size * 1.6)}
				className="inline-block shrink-0"
			/>
		)
	if (
		(place.family === "theme" || place.family === "style" || place.family === "trait") &&
		place.hue
	)
		return (
			<span
				aria-hidden
				className="inline-block shrink-0 rounded-full"
				style={{ width: 3, height: size * 0.85, background: place.hue }}
			/>
		)
	return null
}
