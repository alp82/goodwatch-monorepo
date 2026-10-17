// Which area the fingerprint section shows. Hover and keyboard focus highlight an area; a tap selects it; a second
// tap, Escape, or "All areas" goes back to all areas.

import type React from "react"
import { useEffect, useState } from "react"
import type { Area } from "./areas"

export function useAreaSelection() {
	const [selected, setSelected] = useState<Area | null>(null)
	const [hovered, setHovered] = useState<Area | null>(null)
	useEffect(() => {
		if (!selected) return
		const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSelected(null)
		document.addEventListener("keydown", onKey)
		return () => document.removeEventListener("keydown", onKey)
	}, [selected])
	return {
		selected,
		hovered,
		/** What to highlight: the hovered area, else the selected one. */
		highlighted: hovered ?? selected,
		setHovered,
		toggle: (area: Area) => setSelected((cur) => (cur === area ? null : area)),
		reset: () => setSelected(null),
	}
}

export type AreaSelection = ReturnType<typeof useAreaSelection>

/** The tap mark of a control that selects an area (see utils/replay-tap.ts). */
export const areaTapMark = (area: Area) => `area:${area}`

/** Handlers that highlight an area while a control that selects it is hovered or focused. */
export const highlightHandlers = (x: AreaSelection, area: Area) => ({
	onPointerEnter: (e: React.PointerEvent) =>
		e.pointerType === "mouse" && x.setHovered(area),
	onPointerLeave: (e: React.PointerEvent) =>
		e.pointerType === "mouse" && x.setHovered(null),
	// Keyboard focus highlights like hover; a tap's focus doesn't, or the highlight would stick after the tap.
	onFocus: (e: React.FocusEvent) =>
		e.currentTarget.matches(":focus-visible") && x.setHovered(area),
	onBlur: () => x.setHovered(null),
	"data-replay-tap": areaTapMark(area),
})
