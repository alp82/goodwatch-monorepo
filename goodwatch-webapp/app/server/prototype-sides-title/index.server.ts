// PROTOTYPE - throwaway (#661, map #652). Where a title sits in a member's Taste, for the title page prototype.
//
// The sides are the ones the owner chose in #657: the tighter engine (even sides that hold together, 2 to 5, loose
// titles left out, contrasted names, places then steps as edges) plus one bridge per pair of sides (the way toward
// another side), and moods per side for the Watch next link.
//
// A title is placed, in this order:
// 1. One of the loved titles that make a side: on that side.
// 2. In a place just past its nearest side (the side's own place or step edge): just past it.
// 3. As close to its nearest side as most of the side's loved titles are: on that side.
// 4. Between two sides that have a bridge: just past the first, toward the other.
// 5. Otherwise, or without a title analysis: nothing.
// Lists of unseen titles are in the member's personal order (sides group, personal order ranks).
import { MOOD_BY_KEY, type MoodKey } from "~/domain/moods"
import { protoMembers } from "~/server/prototype-better-sides/members.server"
import { enrich } from "~/server/prototype-better-sides/index.server"
import { protoPerson, type ProtoPerson } from "~/server/prototype-better-sides/person.server"
import { STRONG_Z, bridgeEdges, buildTighter, nearest, projection } from "~/server/prototype-better-sides/engine.server"
import { KEYS, type Person, cosine, yearOf } from "~/server/taste-portrait/person.server"
import { lovedTitles } from "~/server/taste-portrait/sides.server"
import type { TitleFacts } from "~/server/title-snapshot/snapshot.server"
import type { ProtoEdge, ProtoSide } from "~/ui/prototype-better-sides/model"
import type { Placement, PlacementKind, SampleRow, SamplesView, SideCard, SidesTitleView } from "~/ui/prototype-sides-title/model"
import { getUserIdFromRequest } from "~/utils/auth"
import type { TitleKey } from "~/utils/title-key"

type Vec = Float64Array
const COLORS = ["#f59e0b", "#38bdf8", "#34d399", "#e879f9", "#fb7185", "#a3e635"]
/** On a side: at least as close to its center as this share of the side's own loved titles. */
const ON_QUANTILE = 0.35
/** Just past a side: the edge pools' own closeness (see placeEdges in the engine). */
const NEAR = 0.3

interface Chosen {
	person: Person
	proto: ProtoPerson
	sides: ProtoSide[]
	centers: Vec[]
	members: Set<TitleKey>[]
	onCut: number[]
	cards: SideCard[]
	place: (z: ArrayLike<number>) => { x: number; y: number }
	moved: ((p: { x: number; y: number }) => { x: number; y: number })[]
	loved: number
	loose: number
}

const kept = new Map<string, { at: number; value: Promise<Chosen | null> }>()

async function chosenFor(userId: string): Promise<Chosen | null> {
	const hit = kept.get(userId)
	if (hit && Date.now() - hit.at < 10 * 60_000) return hit.value
	const value = (async () => {
		const proto = await protoPerson(userId)
		return proto ? build(proto) : null
	})()
	kept.set(userId, { at: Date.now(), value })
	value.catch(() => kept.delete(userId))
	return value
}

function build(proto: ProtoPerson): Chosen | null {
	const { person } = proto
	const built = buildTighter(person)
	if (!built.sides.length) return null
	const { sides, centers } = built
	// The owner's pick adds the bridge from the anchored variant: one per pair of sides.
	const bridged = new Set<string>()
	const withCenters = sides.map((s, i) => ({ id: s.id, center: centers[i], anchor: null }))
	sides.forEach((side, i) => {
		for (const b of bridgeEdges(person, withCenters, i)) {
			const pair = [side.id, b.toward].sort().join("|")
			if (bridged.has(pair)) continue
			bridged.add(pair)
			side.edges.push(b)
		}
	})
	for (const side of sides) {
		side.moreOfThis = proto.order(side.moreOfThis)
		for (const edge of side.edges) edge.suggestions = proto.order(edge.suggestions)
	}
	const loved = lovedTitles(person)
	const members = built.memberKeys.map((keys) => new Set(keys))
	const onCut = built.memberKeys.map((keys, i) => {
		const sims = keys.flatMap((key) => {
			const z = person.zOf(key)
			return z ? [cosine(z, centers[i])] : []
		})
		sims.sort((a, b) => a - b)
		return sims[Math.floor(sims.length * (1 - ON_QUANTILE))] ?? 0.5
	})
	const { place, moved, positions, edgeSpots } = mapOf(person, built.memberKeys, sides)
	const cards: SideCard[] = sides.map((side, i) => ({
		id: side.id,
		name: side.name,
		share: side.share,
		count: side.count,
		here: side.here,
		moods: sideMoods(built.memberKeys[i].map((k) => person.ratedByKey.get(k)?.facts).filter((f): f is TitleFacts => !!f), loved.map((r) => r.facts)),
		color: COLORS[i % COLORS.length],
		x: positions[i].x,
		y: positions[i].y,
		dots: positions[i].dots,
		edges: side.edges.map((e, j) => ({ id: e.id, kind: e.kind, chip: e.kind === "bridge" ? "Toward" : e.chip, toward: e.toward ?? null, ...edgeSpots[i][j] })),
	}))
	return { person, proto, sides, centers, members, onCut, cards, place, moved, loved: loved.length, loose: built.loose }
}

/** The moods most of the side's loved titles have, and more often than the rest of what the member loves. */
function sideMoods(side: TitleFacts[], all: TitleFacts[]): MoodKey[] {
	const share = (list: TitleFacts[], m: MoodKey) => list.filter((f) => f.moods.includes(m)).length / Math.max(1, list.length)
	const scored = (Object.keys(MOOD_BY_KEY) as MoodKey[])
		.map((m) => ({ m, here: share(side, m), lift: share(side, m) / Math.max(0.05, share(all, m)) }))
		.filter((x) => x.here >= 0.3)
		.sort((a, b) => b.here * b.lift - a.here * a.lift)
	const picked = scored.filter((x) => x.lift >= 1).slice(0, 2)
	return (picked.length ? picked : scored.slice(0, 1)).map((x) => x.m)
}

// ---------- the map (as the #657 map variant draws it) ----------

function mapOf(person: Person, memberKeys: TitleKey[][], sides: ProtoSide[]) {
	const place = projection(person)
	const raw = memberKeys.map((keys) => {
		const dots = keys.flatMap((key) => {
			const z = person.zOf(key)
			return z ? [{ key, ...place(z) }] : []
		})
		const cx = dots.reduce((s, d) => s + d.x, 0) / Math.max(1, dots.length)
		const cy = dots.reduce((s, d) => s + d.y, 0) / Math.max(1, dots.length)
		return { dots, cx, cy }
	})
	const centers = raw.map((r) => ({ x: r.cx, y: r.cy }))
	const MIN = centers.length > 4 ? 0.36 : 0.42
	for (let it = 0; it < 200; it++) {
		for (let i = 0; i < centers.length; i++)
			for (let j = i + 1; j < centers.length; j++) {
				const dx = centers[j].x - centers[i].x || 0.01 * (j - i)
				const dy = centers[j].y - centers[i].y || 0.01
				const d = Math.hypot(dx, dy)
				if (d >= MIN) continue
				const push = (MIN - d) / 2
				centers[i].x -= (dx / d) * push
				centers[i].y -= (dy / d) * push
				centers[j].x += (dx / d) * push
				centers[j].y += (dy / d) * push
			}
		for (const c of centers) {
			c.x = Math.max(0.2, Math.min(0.8, c.x))
			c.y = Math.max(0.2, Math.min(0.8, c.y))
		}
	}
	const SCALE = 0.4
	const clamp = (x: number) => Math.max(0.04, Math.min(0.96, x))
	const moved = raw.map(({ cx, cy }, i) => (p: { x: number; y: number }) => ({ x: clamp(centers[i].x + SCALE * (p.x - cx)), y: clamp(centers[i].y + SCALE * (p.y - cy)) }))
	const positions = raw.map(({ dots }, i) => {
		const placed = dots.map((d) => ({ key: d.key, ...moved[i](d) }))
		const here = sides[i].here
		return { x: centers[i].x, y: centers[i].y, dots: [...here.flatMap((k) => placed.filter((d) => d.key === k)), ...placed.filter((d) => !here.includes(d.key))] }
	})
	const edgeSpots = sides.map((side, i) =>
		side.edges.map((edge, e) => {
			if (edge.kind === "bridge") {
				const j = sides.findIndex((s) => s.id === edge.toward)
				return j < 0 ? { x: centers[i].x, y: centers[i].y } : { x: (centers[i].x + centers[j].x) / 2, y: (centers[i].y + centers[j].y) / 2 }
			}
			const spots = edge.suggestions.slice(0, 4).flatMap((key) => {
				const z = person.zOf(key)
				return z ? [place(z)] : []
			})
			const { cx, cy } = raw[i]
			const ex = spots.reduce((s, d) => s + d.x, 0) / Math.max(1, spots.length)
			const ey = spots.reduce((s, d) => s + d.y, 0) / Math.max(1, spots.length)
			let angle = Math.atan2(ey - cy, ex - cx)
			if (Math.hypot(ex - cx, ey - cy) < 0.02) angle = Math.atan2(centers[i].y - 0.5, centers[i].x - 0.5)
			angle += (e - (side.edges.length - 1) / 2) * 0.5
			return { x: clamp(centers[i].x + Math.cos(angle) * 0.17), y: clamp(centers[i].y + Math.sin(angle) * 0.17) }
		}),
	)
	return { place, moved, positions, edgeSpots }
}

// ---------- placing one title ----------

/** Whether a title is in one of the side's place or step edges (bridges are checked across sides). */
function inEdge(edge: ProtoEdge, z: ArrayLike<number>, facts: TitleFacts): boolean {
	if (edge.kind === "step") {
		const key = edge.id.split("-step-")[1]
		const k = KEYS.indexOf(key)
		return k >= 0 && z[k] > STRONG_Z
	}
	const id = edge.id.slice(edge.id.indexOf(`-${edge.kind}:`) + edge.kind.length + 2)
	if (edge.kind === "country" || edge.kind === "language") return facts.origin === id
	if (edge.kind === "decade") {
		const y = yearOf(facts)
		return y !== null && y >= Number(id) && y < Number(id) + 10
	}
	if (edge.kind === "format") return facts.mediaType === id
	if (edge.kind === "animation") return facts.anime || facts.genres.includes("Animation")
	return false
}

function placeTitle(c: Chosen, key: TitleKey): Omit<Placement, "near" | "nearOther" | "more" | "pin"> & { index: number; other: number; edgeRef: ProtoEdge | null } {
	const { person, sides, centers } = c
	const mine = person.input.scores.get(key) ?? null
	const none = (debug: string) => ({ kind: "none" as PlacementKind, side: null, member: false, mine, edge: null, debug, index: -1, other: -1, edgeRef: null })
	const z = person.zOf(key)
	const facts = person.snapshot.facts(key)
	if (!z || !facts) return none("no title analysis")
	const memberOf = c.members.findIndex((m) => m.has(key))
	const n = nearest(z, centers)
	const sims = centers.map((center) => cosine(z, center).toFixed(2)).join(" / ")
	const base = `closeness to each side ${sims}; on-side cut ${c.onCut.map((x) => x.toFixed(2)).join(" / ")}`
	const on = (index: number, why: string) => ({ kind: "on" as PlacementKind, side: sides[index].id, member: memberOf === index, mine, edge: null, debug: `${why}; ${base}`, index, other: -1, edgeRef: null })
	if (memberOf >= 0) return on(memberOf, "one of the loved titles that make this side")
	// A loved title that fits no side is left out quietly.
	if (lovedTitles(person).some((r) => r.key === key)) return none(`a loved title that fits no side; ${base}`)
	const edgeHere = n.similarity > NEAR ? sides[n.index].edges.find((e) => e.kind !== "bridge" && inEdge(e, z, facts)) : undefined
	const edgeOf = (index: number, edge: ProtoEdge, other: number, why: string) => ({
		kind: "edge" as PlacementKind,
		side: sides[index].id,
		member: false,
		mine,
		edge: { id: edge.id, kind: edge.kind, chip: edge.chip, line: edge.line, evidence: edge.evidence, toward: edge.toward ?? null },
		debug: `${why}; ${base}`,
		index,
		other,
		edgeRef: edge,
	})
	if (edgeHere) return edgeOf(n.index, edgeHere, -1, `in the place just past its nearest side (${edgeHere.chip})`)
	if (n.similarity >= c.onCut[n.index]) return on(n.index, "as close to its nearest side as most of the side's loved titles")
	for (let i = 0; i < sides.length; i++)
		for (const edge of sides[i].edges) {
			if (edge.kind !== "bridge") continue
			const j = sides.findIndex((s) => s.id === edge.toward)
			if (j < 0) continue
			const a = cosine(z, centers[i])
			const b = cosine(z, centers[j])
			if (a > 0.2 && b > 0.2 && Math.abs(a - b) < 0.12) return edgeOf(i, edge, j, "between two sides with a bridge")
		}
	return none(`not close enough to any side; ${base}`)
}

/** The side's loved titles closest to the title, skipping near-duplicates. */
function nearestLoved(c: Chosen, index: number, z: ArrayLike<number> | null, skip: TitleKey, n = 6): TitleKey[] {
	if (index < 0) return []
	const members = [...c.members[index]].flatMap((key) => {
		const r = c.person.ratedByKey.get(key)
		return r && r.key !== skip && r.facts.hasPoster ? [r] : []
	})
	if (!z) return c.sides[index].here.filter((k) => k !== skip).slice(0, n)
	const ranked = members.sort((a, b) => cosine(b.z, z) - cosine(a.z, z) || a.key - b.key)
	const picked: typeof ranked = []
	for (const r of ranked) {
		if (picked.length >= n) break
		if (picked.some((p) => cosine(p.z, r.z) > 0.88)) continue
		picked.push(r)
	}
	return picked.map((r) => r.key)
}

function resolveMember(request: Request, slot: string | null) {
	return Promise.all([protoMembers(), getUserIdFromRequest({ request }).catch(() => null)]).then(([members, me]) => {
		const list = [...(me ? [{ slot: "me", label: "You (signed in)", userId: me, ratings: 0 }] : []), ...members]
		return { list, member: list.find((m) => m.slot === slot) ?? list.find((m) => m.slot === "owner") ?? list[0] }
	})
}

export async function sidesTitleView(request: Request, title: TitleKey, slot: string | null): Promise<SidesTitleView | null> {
	const startedAt = performance.now()
	const { list, member } = await resolveMember(request, slot)
	const c = await chosenFor(member.userId)
	if (!c) return null
	const placed = placeTitle(c, title)
	const z = c.person.zOf(title)
	const { index, other, edgeRef } = placed
	const near = nearestLoved(c, index, z, title)
	const nearOther = other >= 0 ? nearestLoved(c, other, z, title, 4) : []
	const more =
		index < 0
			? []
			: (edgeRef ? edgeRef.suggestions : c.sides[index].moreOfThis).filter((k) => k !== title).slice(0, 12)
	let pin: Placement["pin"] = null
	if (index >= 0 && z) {
		const card = c.cards[index]
		const spot = edgeRef ? card.edges.find((e) => e.id === edgeRef.id) : null
		pin = spot ? { x: spot.x, y: spot.y } : c.moved[index](c.place(z))
	}
	const { index: _i, other: _o, edgeRef: _e, ...rest } = placed
	const placement: Placement = { ...rest, near, nearOther, more, pin }
	const keys = new Set<TitleKey>([title, ...near, ...nearOther, ...more, ...c.cards.flatMap((s) => [...s.here, ...s.dots.slice(0, 40).map((d) => d.key)])])
	const titles = await enrich(c.person, keys)
	return {
		title,
		member: { slot: member.slot, label: member.label, ratings: member.ratings || c.person.rated.length, loved: c.loved, loose: c.loose },
		members: list.map(({ slot, label, ratings }) => ({ slot, label, ratings })),
		sides: c.cards,
		placement,
		titles,
		personalOrder: { on: c.proto.personalOrder, note: c.proto.personalOrderNote },
		computedMs: Math.round(performance.now() - startedAt),
	}
}

/** Titles to try the variants on: per side, titles on it and just past it, plus titles that fit no side. */
export async function sidesTitleSamples(request: Request, slot: string | null): Promise<SamplesView | null> {
	const startedAt = performance.now()
	const { list, member } = await resolveMember(request, slot)
	const c = await chosenFor(member.userId)
	if (!c) return null
	const rows: SampleRow[] = []
	const kindOf = (key: TitleKey) => placeTitle(c, key)
	c.sides.forEach((side, i) => {
		const onSide = side.moreOfThis.filter((k) => {
			const p = kindOf(k)
			return p.kind === "on" && p.index === i
		})
		rows.push({ group: side.id, kind: "on", note: "Unseen, on this side (personal order)", keys: onSide.slice(0, 4) })
		rows.push({ group: side.id, kind: "on", note: "Loved, one of the titles that make this side", keys: side.here.slice(0, 2) })
		for (const edge of side.edges) {
			const past = edge.suggestions.filter((k) => {
				const p = kindOf(k)
				return p.kind === "edge" && p.edge?.id === edge.id
			})
			rows.push({ group: side.id, kind: "edge", note: `Unseen, just past this side (${edge.kind}${edge.kind === "bridge" ? "" : `: ${edge.chip}`})`, keys: past.slice(0, 3) })
		}
	})
	// Popular titles the member hasn't seen, to see how often the title page would say anything at all.
	const popular = [...c.person.unseen].sort((a, b) => b.facts.votes - a.facts.votes).slice(0, 400)
	const spread: Record<PlacementKind, number> = { on: 0, edge: 0, none: 0 }
	const offSide: TitleKey[] = []
	for (const t of popular) {
		const p = kindOf(t.key)
		spread[p.kind]++
		if (p.kind === "none" && offSide.length < 4) offSide.push(t.key)
	}
	rows.push({ group: "none", kind: "none", note: "Popular, unseen, fits no side (the page shows nothing)", keys: offSide })
	const lowRated = c.person.rated
		.filter((r) => r.score <= Math.round(c.person.mu) - 2 && r.facts.hasPoster)
		.filter((r) => kindOf(r.key).kind !== "none")
		.slice(0, 3)
		.map((r) => r.key)
	rows.push({ group: "rated", kind: "on", note: "Rated well below usual, yet on or just past a side (open question)", keys: lowRated })
	const looseLoved = lovedTitles(c.person)
		.filter((r) => !c.members.some((m) => m.has(r.key)) && r.facts.hasPoster)
		.slice(0, 3)
		.map((r) => r.key)
	rows.push({ group: "loose", kind: "none", note: "Loved, fits no side (left out quietly)", keys: looseLoved })
	const keys = new Set<TitleKey>(rows.flatMap((r) => r.keys))
	const titles = await enrich(c.person, keys)
	return {
		member: { slot: member.slot, label: member.label, ratings: member.ratings || c.person.rated.length, loved: c.loved, loose: c.loose },
		members: list.map(({ slot, label, ratings }) => ({ slot, label, ratings })),
		sides: c.cards.map((s) => ({ id: s.id, name: s.name, count: s.count, share: s.share })),
		rows: rows.filter((r) => r.keys.length),
		titles,
		spread,
		computedMs: Math.round(performance.now() - startedAt),
	}
}
