// The print's ridges for the fingerprint's drawings (Print.tsx): the geometry from the title's scores, and a sprite
// that draws them once per page so every drawing can show them by reference.
import { memo } from "react"
import { type WhorlAttribute, build } from "~/ui/profile/taste/Whorl"
import { FAMILY_COLOR } from "~/ui/profile/taste/model"

// The print sits a little smaller than the shape's ring, nudged down to center its off-center core.
const PRINT = { dy: 6, k: 0.82 }

export type Geo = ReturnType<typeof build>

/** The print's geometry for a section's drawings: twelve turns, rim markers included. */
export const printGeometry = (attributes: WhorlAttribute[]): Geo =>
	build(attributes, 12, true)

const RIDGE = 2.6

/**
 * The print's ridges, drawn once per section (about 850 paths): every drawing shows them by reference, twice each
 * (faint, and brighter inside the shape), so the DOM holds them once and not four times (two drawings, phone and wide,
 * that CSS picks from). Runs of one family share a group with its color; the paint order stays the print's own. A
 * sprite: a zero-size SVG, not hidden by `display`, so every browser renders its references. The section draws it once
 * the reader comes near: the print has no words for search engines, and its coordinates were a third of the page's
 * compressed HTML.
 */
export const RidgeSprite = memo(function RidgeSprite({
	id,
	geo,
}: { id: string; geo: Geo }) {
	const runs: {
		family: keyof typeof FAMILY_COLOR
		paths: Geo["turns"][number]["paths"]
	}[] = []
	for (const turn of geo.turns)
		for (const p of turn.paths) {
			const last = runs[runs.length - 1]
			if (last && last.family === p.family) last.paths.push(p)
			else runs.push({ family: p.family, paths: [p] })
		}
	return (
		<svg
			aria-hidden="true"
			focusable="false"
			width="0"
			height="0"
			style={{ position: "absolute", overflow: "hidden" }}
		>
			<defs>
				<g
					id={id}
					transform={`translate(0 ${PRINT.dy}) scale(${PRINT.k})`}
					fill="none"
					strokeWidth={RIDGE}
					strokeLinecap="round"
				>
					{runs.map((run, i) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: geometry is fixed
						<g key={i} stroke={FAMILY_COLOR[run.family]}>
							{run.paths.map((p, j) => (
								// biome-ignore lint/suspicious/noArrayIndexKey: geometry is fixed
								<path key={j} d={p.d} strokeOpacity={p.opacity} />
							))}
						</g>
					))}
				</g>
			</defs>
		</svg>
	)
})
