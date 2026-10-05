// PROTOTYPE - throwaway. Round 6 of #177: the data the three-tab Taste page needs, built on the client from
// round 4's cached report and the fingerprint page's cached payload (#181). No new server work.
// Sides of you: each side carries what the person rated highly there, "more of this" picks, and the edges
// that sit just past it (round 5's merge, balanced so every side gets an edge when there are enough).
import type {
	Frontier,
	Ref,
	Side,
	Title,
} from "~/ui/prototype-rec-taste-2/model"
import type { FpPayload } from "~/ui/prototype-rec-fingerprint/model"
import type { Payload4 } from "~/ui/prototype-rec-taste-4/model"

/** The fingerprint payload with only what the Fingerprint tab shows. */
export type FpLite = FpPayload
export type Payload6 = Payload4 & { fp: FpLite }

/** Keep the Families view's fields and the titles it can show; drop the other fingerprint variants' data. */
export function trimFingerprint(fp: FpPayload): FpLite {
	const keys = new Set<string>()
	for (const a of fp.attrs) {
		for (const k of a.carriers) keys.add(k)
		for (const k of a.against) keys.add(k)
		if (a.exception) keys.add(a.exception)
	}
	const items: FpPayload["items"] = {}
	for (const k of keys) if (fp.items[k]) items[k] = fp.items[k]
	return {
		...fp,
		you: [],
		periods: [],
		probes: [],
		candidates: [],
		friends: [],
		items,
	}
}

export type Edge = {
	id: string
	kind: Frontier["kind"]
	name: string // "South Korea", "The 1940s", "Psychological thrillers"
	pre: string // "You've barely been to"
	object: string // "South Korea", "the 1940s", "psychological thrillers"
	avg: number | null // their average rating there
	rated: Title[] // what they rated there, best first
	picks: Ref[]
	image: Title | null // the first pick with a backdrop, else a rated one
}

export type SideView = {
	id: string
	name: string
	share: number
	avg: number
	attrs: string[]
	loved: Title[] // rated highly here, best first
	picks: Ref[]
	edges: Edge[] // just past this side, closest first
	image: Title | null // the first loved title with a backdrop
}

export type SidesModel = {
	sides: SideView[]
	contradiction: { a: SideView; b: SideView } | null
	usual: number
}

const avgIn = (f: Frontier) => {
	const m = /(\d+(?:\.\d+)?) on average/.exec(f.line)
	return m ? Number(m[1]) : null
}

const leadOf = (f: Frontier) =>
	f.kind === "country"
		? { pre: "You've barely been to", object: f.name }
		: f.kind === "language"
			? { pre: "You rarely watch in", object: f.name }
			: f.kind === "decade"
				? { pre: "You rarely go back to", object: f.name.replace(/^The/, "the") }
				: { pre: "You rarely pick", object: f.name.toLowerCase() }

const titlesOf = (data: Payload4, keys: string[]) =>
	keys.map((k) => data.items[k]).filter((t): t is Title => !!t)
const byMine = (ts: Title[]) =>
	[...ts].sort((a, b) => (b.mine ?? 0) - (a.mine ?? 0))

const genreVec = (data: Payload4, keys: string[]) => {
	const v = new Map<string, number>()
	for (const k of keys)
		for (const g of data.items[k]?.genres ?? []) v.set(g, (v.get(g) ?? 0) + 1)
	return v
}
const cosine = (a: Map<string, number>, b: Map<string, number>) => {
	let dot = 0
	let na = 0
	let nb = 0
	for (const [k, x] of a) {
		dot += x * (b.get(k) ?? 0)
		na += x * x
	}
	for (const x of b.values()) nb += x * x
	return na && nb ? dot / Math.sqrt(na * nb) : 0
}

/** An edge as it sits next to a side; its picks put the side's own "more of this" last. */
function toEdge(data: Payload4, f: Frontier, taken: Set<string>): Edge {
	const rated = byMine(titlesOf(data, f.evidence))
	// The side's own picks go last, not away: some edges have few picks of their own.
	const refs = [
		...f.picks.filter((p) => !taken.has(p.key)),
		...f.picks.filter((p) => taken.has(p.key)),
	].filter((p) => !!data.items[p.key])
	const picks = titlesOf(
		data,
		refs.map((p) => p.key),
	)
	return {
		id: f.id,
		kind: f.kind,
		name: f.name,
		...leadOf(f),
		avg: avgIn(f),
		rated,
		picks: refs,
		image:
			picks.find((t) => t.backdrop) ?? rated.find((t) => t.backdrop) ?? null,
	}
}

export function buildSides(data: Payload4): SidesModel {
	const r = data.report
	// Assign each edge to the side whose genres it shares most, but first give every side its closest
	// unclaimed edge, so no side ends without a "just past it".
	const sideVecs = r.sides.map((s) =>
		genreVec(data, [...s.titles, ...s.picks.map((p) => p.key)]),
	)
	const edgeVecs = r.frontiers.map((f) =>
		genreVec(data, [...f.evidence, ...f.picks.map((p) => p.key)]),
	)
	const owner = new Map<number, number>() // edge index -> side index
	r.sides.forEach((_, si) => {
		let best = -1
		let bestSim = -1
		edgeVecs.forEach((ev, ei) => {
			if (owner.has(ei)) return
			const sim = cosine(sideVecs[si], ev)
			if (sim > bestSim) {
				best = ei
				bestSim = sim
			}
		})
		if (best >= 0) owner.set(best, si)
	})
	edgeVecs.forEach((ev, ei) => {
		if (owner.has(ei)) return
		let best = 0
		sideVecs.forEach((sv, si) => {
			if (cosine(sv, ev) > cosine(sideVecs[best], ev)) best = si
		})
		owner.set(ei, best)
	})

	const sides: SideView[] = r.sides.map((s: Side, si) => {
		const all = byMine(titlesOf(data, s.titles))
		const high = all.filter((t) => (t.mine ?? 0) >= 7)
		const loved = high.length >= 2 ? high : all
		const edges = r.frontiers
			.map((f, ei) => ({ f, ei }))
			.filter(({ ei }) => owner.get(ei) === si)
			.sort((x, y) => cosine(sideVecs[si], edgeVecs[y.ei]) - cosine(sideVecs[si], edgeVecs[x.ei]))
			.map(({ f }) => toEdge(data, f, new Set(s.picks.map((p) => p.key))))
		return {
			id: s.id,
			name: s.name,
			share: s.share,
			avg: s.avg,
			attrs: s.attrs,
			loved,
			picks: s.picks,
			edges,
			image: loved.find((t) => t.backdrop) ?? null,
		}
	})
	const a = sides.find((s) => s.id === r.contradiction?.a)
	const b = sides.find((s) => s.id === r.contradiction?.b)
	return {
		sides,
		contradiction: a && b ? { a, b } : null,
		usual: r.who.avg,
	}
}

export const pct = (x: number) => `${Math.round(x * 100)}%`
