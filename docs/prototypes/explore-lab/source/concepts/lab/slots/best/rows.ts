// PROTOTYPE - throwaway (prototype/explore-r5). The Dials Best page's re-ranking, shared by the new Best variants: with
// a dial set, the 25 rows nearest to it come forward (each keeps its real rank); at rest it is the list's first 50.
import type { BestRow } from "../../../../kit/types"
import type { DialSpec, Settings } from "../../../dials/tune"

export function bestRows(
	rows: BestRow[],
	scores: Record<number, number[]>,
	dials: DialSpec[],
	settings: Settings,
): { rows: BestRow[]; tuned: boolean } {
	const active = dials.filter((d) => settings[d.id] != null)
	if (!active.length) return { rows: rows.slice(0, 50), tuned: false }
	const norm = (d: DialSpec, x: number) =>
		d.hi > d.lo ? Math.min(1, Math.max(0, (x - d.lo) / (d.hi - d.lo))) : 0.5
	return {
		tuned: true,
		rows: rows
			.map((r, index) => ({
				r,
				cost:
					active.reduce(
						(s, d) =>
							s +
							Math.abs(
								norm(d, scores[r.title.card.key]?.[d.col] ?? 0) - (settings[d.id] as number),
							),
						0,
					) +
					(index / rows.length) * 0.05,
			}))
			.sort((a, b) => a.cost - b.cost)
			.slice(0, 25)
			.map((x) => x.r),
	}
}
