// The comparison between a signed-in visitor and a profile's owner, the parts that are plain arithmetic: which
// attributes pull both or one of them, the visitor's edges on the owner's scale, and the orders of the title lists.
// Pure; compare.server.ts reads the inputs.
import { CRAFT_KEYS } from "../../domain/taste-attributes.ts"

export interface EdgeOf {
	key: string
	label: string
	edge: number
	tier: number
}

/** Labels of the worded attributes pulling both (strongest shared pull first), only them, and only you. */
export function comparePulls(
	theirs: readonly EdgeOf[],
	yours: readonly EdgeOf[],
	n = 4,
) {
	const mine = new Map(yours.map((a) => [a.key, a.edge]))
	const worded = theirs.filter((a) => !CRAFT_KEYS.has(a.key) && mine.has(a.key))
	const y = (a: EdgeOf) => mine.get(a.key) ?? 0
	const both = worded
		.filter((a) => a.edge > 0 && y(a) > 0)
		.sort(
			(a, b) =>
				Math.min(b.edge, y(b)) - Math.min(a.edge, y(a)) ||
				a.key.localeCompare(b.key),
		)
	const onlyThem = worded
		.filter((a) => a.edge > 0 && y(a) <= 0)
		.sort(
			(a, b) => b.edge - y(b) - (a.edge - y(a)) || a.key.localeCompare(b.key),
		)
	const onlyYou = worded
		.filter((a) => y(a) > 0 && a.edge <= 0)
		.sort(
			(a, b) => y(b) - b.edge - (y(a) - a.edge) || a.key.localeCompare(b.key),
		)
	const labels = (list: EdgeOf[]) => list.slice(0, n).map((a) => a.label)
	return {
		both: labels(both),
		onlyThem: labels(onlyThem),
		onlyYou: labels(onlyYou),
	}
}

const rms = (values: number[]) =>
	Math.sqrt(
		values.reduce((s, v) => s + v * v, 0) / Math.max(1, values.length),
	) || 1

/** The visitor's edges on the owner's scale (both brought to the same root mean square), keyed by attribute. */
export function yourEdgesOnTheirScale(
	theirs: readonly EdgeOf[],
	yours: readonly EdgeOf[],
) {
	const factor = rms(theirs.map((a) => a.edge)) / rms(yours.map((a) => a.edge))
	const out: Record<string, { edge: number; tier: number }> = {}
	for (const a of yours)
		out[a.key] = { edge: Math.round(a.edge * factor * 100) / 100, tier: a.tier }
	return out
}

export interface SharedScore {
	key: string
	yours: number
	theirs: number
}

/** Titles both rated, widest gap first, then the higher pair of scores. */
export function sharedScores(
	yours: ReadonlyMap<string, number>,
	theirs: ReadonlyMap<string, number>,
): SharedScore[] {
	const out: SharedScore[] = []
	for (const [key, mine] of yours) {
		const other = theirs.get(key)
		if (other !== undefined) out.push({ key, yours: mine, theirs: other })
	}
	return out.sort(
		(a, b) =>
			Math.abs(b.yours - b.theirs) - Math.abs(a.yours - a.theirs) ||
			b.yours + b.theirs - (a.yours + a.theirs) ||
			a.key.localeCompare(b.key),
	)
}

/** Both scored 8 or more, the highest pair first. */
export const bothLove = (shared: readonly SharedScore[]) =>
	shared
		.filter((s) => s.yours >= 8 && s.theirs >= 8)
		.sort(
			(a, b) =>
				b.yours + b.theirs - (a.yours + a.theirs) || a.key.localeCompare(b.key),
		)
