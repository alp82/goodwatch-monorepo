// PROTOTYPE - throwaway. Round 9 rhythm pass, group "r9c": a gentle push-in that keeps a reading hold alive.
// The owner on round 8: "timing and rhythm is still weird. there are often weird pauses between scene transitions".
// Holds stay (text needs reading time) but never freeze: the scene keeps moving, slowly, until the hand-over.
import type { CSSProperties, ReactNode } from "react"

/**
 * Wraps a scene (or part of one) in a box that fills its parent and slowly scales from 1 to `scale` between `from`
 * and `from + dur` (ms at k = 1). Transform only; with reduced motion it stays still (r9c.css).
 */
export function Push({
	from,
	dur,
	scale = 1.03,
	origin = "50% 50%",
	children,
}: { from: number; dur: number; scale?: number; origin?: string; children: ReactNode }) {
	return (
		<div
			className="lpc-r9c-push"
			style={
				{
					"--push": scale,
					transformOrigin: origin,
					animation: `lpc-r9c-push calc(${dur}ms * var(--k, 1)) cubic-bezier(.33,0,.4,1) calc(${from}ms * var(--k, 1)) both`,
				} as CSSProperties
			}
		>
			{children}
		</div>
	)
}
