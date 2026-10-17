// A gentle push-in that keeps a reading moment alive: a scene never stands still while its words are read.
import type { CSSProperties, ReactNode } from "react"

/**
 * Wraps a scene (or part of one) in a box that fills its parent and slowly scales from 1 to `scale` between `from`
 * and `from + dur` (ms at k = 1). Transform only; with reduced motion it stays still (intro.css).
 */
export function Push({
	from,
	dur,
	scale = 1.03,
	origin = "50% 50%",
	children,
}: {
	from: number
	dur: number
	scale?: number
	origin?: string
	children: ReactNode
}) {
	return (
		<div
			className="intro-push-push"
			style={
				{
					"--push": scale,
					transformOrigin: origin,
					animation: `intro-push-push calc(${dur}ms * var(--k, 1)) cubic-bezier(.33,0,.4,1) calc(${from}ms * var(--k, 1)) both`,
				} as CSSProperties
			}
		>
			{children}
		</div>
	)
}
