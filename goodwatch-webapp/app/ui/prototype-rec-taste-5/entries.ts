// PROTOTYPE - throwaway. Round 5 of #177: round 4's Sides of you and Your edges merged into one list of what
// defines the person. Every entry (a side, an edge, the mood they rate best, a person they keep coming back
// to) carries the same two things for the right side: the titles they rated highly there, and unseen
// "More of this" picks. Built on the client from round 4's payload (round 2's report plus extras); no new
// server work. Edges are nested under the side whose genres they share most, so a two-level list can
// read "this side of you, and just past it".
import type { Frontier, Ref, Title } from "~/ui/prototype-rec-taste-2/model"
import type { Payload4 } from "~/ui/prototype-rec-taste-4/model"

export type Kind = "side" | "edge" | "mood" | "person"

export type Entry = {
	id: string
	kind: Kind
	name: string // as a list label, sentence case
	statement: string // the same entry as a sentence about the person
	stat: string // one short fact behind it
	strength: number // 0-1 within its kind, for bars
	avg: number | null // their average rating here
	loved: Title[] // rated here, best first
	picks: Ref[] // unseen, best match first
	parent: string | null // edges: the side they sit next to
	portrait?: string | null // people: TMDB profile path
}

export type Groups = {
	sides: Entry[]
	edges: Entry[]
	moods: Entry[]
	people: Entry[]
	all: Entry[]
}

const avgIn = (f: Frontier) => {
	const m = /(\d+(?:\.\d+)?) on average/.exec(f.line)
	return m ? Number(m[1]) : null
}

const edgeStatement = (f: Frontier, avg: number | null) => {
	const rate = avg != null ? `, and you rate it ${avg}` : ""
	if (f.kind === "country") return `You've barely been to ${f.name}${rate}`
	if (f.kind === "language")
		return `You rarely watch in ${f.name}${avg != null ? `, and you rate it ${avg}` : ""}`
	if (f.kind === "decade")
		return `You rarely go back to ${f.name.replace(/^The/, "the")}${rate}`
	return `You rarely pick ${f.name.toLowerCase()}${avg != null ? `, and you rate them ${avg}` : ""}`
}

const byMine = (ts: Title[]) =>
	[...ts].sort((a, b) => (b.mine ?? 0) - (a.mine ?? 0))

const lovedOf = (data: Payload4, keys: string[]) => {
	const ts = byMine(
		keys.map((k) => data.items[k]).filter((t): t is Title => !!t),
	)
	const high = ts.filter((t) => (t.mine ?? 0) >= 7)
	return high.length >= 2 ? high : ts
}

/** Genre profile of a set of titles, for nesting edges under sides. */
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

export function buildEntries(data: Payload4): Groups {
	const r = data.report
	const usual = r.who.avg
	const maxShare = Math.max(0.01, ...r.sides.map((s) => s.share))

	const sides: Entry[] = r.sides.map((s) => ({
		id: s.id,
		kind: "side",
		name: s.name,
		statement: `You love ${s.name.toLowerCase()}`,
		stat: `${Math.round(s.share * 100)}% of what you love`,
		strength: s.share / maxShare,
		avg: s.avg,
		loved: lovedOf(data, s.titles),
		picks: s.picks,
		parent: null,
	}))

	const sideVecs = r.sides.map((s) => ({
		id: s.id,
		v: genreVec(data, [...s.titles, ...s.picks.map((p) => p.key)]),
	}))
	const lifts = r.frontiers.map((f) => (avgIn(f) ?? usual) - usual)
	const maxLift = Math.max(0.1, ...lifts)
	const edges: Entry[] = r.frontiers.map((f, i) => {
		const avg = avgIn(f)
		const v = genreVec(data, [...f.evidence, ...f.picks.map((p) => p.key)])
		const best = [...sideVecs].sort((a, b) => cosine(b.v, v) - cosine(a.v, v))[0]
		return {
			id: f.id,
			kind: "edge",
			name: f.name,
			statement: edgeStatement(f, avg),
			stat:
				avg != null
					? `You rate it ${avg}, usually ${usual}`
					: `${f.evidence.length} rated`,
			strength: Math.max(0.08, lifts[i] / maxLift),
			avg,
			loved: lovedOf(data, f.evidence),
			picks: f.picks,
			parent: best?.id ?? null,
		}
	})

	// The moods they rate above their usual; at least the best one.
	const sortedMoods = [...r.moods].sort((a, b) => b.delta - a.delta)
	const goodMoods = sortedMoods.filter((m) => m.delta >= 0.2)
	const maxDelta = Math.max(0.1, ...sortedMoods.map((m) => m.delta))
	const moods: Entry[] = (
		goodMoods.length ? goodMoods : sortedMoods.slice(0, 1)
	)
		.slice(0, 2)
		.map((m) => ({
			id: m.id,
			kind: "mood",
			name: m.name,
			statement:
				m.delta >= 0.2
					? `You're at your happiest with ${m.name.toLowerCase()}`
					: `Your best mood: ${m.name.toLowerCase()}`,
			stat:
				m.delta >= 0.05
					? `You rate it ${m.delta.toFixed(1)} above your usual`
					: `${m.line}`,
			strength: Math.max(0.08, m.delta / maxDelta),
			avg: m.avg,
			loved: lovedOf(data, m.top),
			picks: m.picks,
			parent: null,
		}))

	// The people they rate highest among those they keep coming back to.
	const ppl = [...data.extra.people]
		.filter((p) => p.unseen.length > 0)
		.sort((a, b) => b.avg - a.avg || b.count - a.count)
		.slice(0, 3)
	const maxCount = Math.max(1, ...ppl.map((p) => p.count))
	const people: Entry[] = ppl.map((p) => ({
		id: `person-${p.name}`,
		kind: "person",
		name: p.name,
		statement: `You keep coming back to ${p.name}`,
		stat: `${p.count} rated, ${p.avg} on average`,
		strength: p.count / maxCount,
		avg: p.avg,
		loved: lovedOf(data, p.keys),
		picks: p.unseen,
		parent: null,
		portrait: p.portrait,
	}))

	return {
		sides,
		edges,
		moods,
		people,
		all: [...sides, ...edges, ...moods, ...people],
	}
}

/** The first loved title with a backdrop: the entry's hero. */
export const leadOf = (e: Entry) => e.loved.find((t) => t.backdrop) ?? null

export const KIND_LABEL: Record<Kind, string> = {
	side: "Sides of you",
	edge: "Your edges",
	mood: "Your mood",
	person: "Your people",
}
