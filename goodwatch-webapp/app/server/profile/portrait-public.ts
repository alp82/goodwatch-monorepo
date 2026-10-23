// A taste portrait without what is relative to its subject, for showing it to others (portrait.server.ts). Pure.
import type { EveryoneView, FingerprintView, PortraitTitle, SidesView } from "../taste-portrait/view.ts"

/** A portrait without what is relative to its subject (match, reasons, services, suggestions). */
export function publicView<V extends SidesView | EveryoneView | FingerprintView>(view: V, scores: boolean): V {
	const titles: Record<string, PortraitTitle> = {}
	const keep = new Set<number>()
	if (view.tab === "sides")
		for (const side of view.sides) {
			for (const key of side.here) keep.add(key)
			if (side.image !== null) keep.add(side.image)
			for (const edge of side.edges) for (const key of edge.rated) keep.add(key)
		}
	else if (view.tab === "everyone") {
		if (scores) for (const row of [...view.higher, ...view.lower]) keep.add(row.key)
	} else {
		for (const key of view.mostYou) keep.add(key)
		for (const a of view.attributes) {
			for (const key of [...a.carriers, ...a.against]) keep.add(key)
			if (a.exception !== null) keep.add(a.exception)
		}
	}
	for (const [key, title] of Object.entries(view.titles))
		if (keep.has(Number(key)))
			titles[key] = {
				...title,
				mine: scores ? title.mine : null,
				match: null,
				onMyServices: null,
				reasons: [],
				services: null,
			}
	if (view.tab === "sides")
		return {
			...view,
			titles,
			hasServices: false,
			services: [],
			sides: view.sides.map((side) => ({
				...side,
				moreOfThis: [],
				// A side's image is a typical loved title; an edge's image is its first suggestion, which goes.
				edges: side.edges.map((edge) => ({ ...edge, suggestions: [], image: null })),
			})),
		} as V
	if (view.tab === "everyone")
		return { ...view, titles, ...(scores ? {} : { higher: [], lower: [] }) } as V
	return { ...view, titles } as V
}
