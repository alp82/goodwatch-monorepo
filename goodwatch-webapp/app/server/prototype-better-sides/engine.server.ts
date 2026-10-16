// PROTOTYPE - throwaway (#657). Three ways to build Sides of you from one Person, beside production's buildSides:
//
// - tighter:  rating-weighted k-means with k chosen by separation (2 to 5), loose titles left out, names contrasted
//             against the other sides (adjective from Feel/Humor/Story, noun from World), edges found per side: a
//             place common right next to this side that the person has barely rated there.
// - anchored: sides grown around anchor titles (dense, highly rated, far apart), named by the anchor title; titles
//             close to two anchors count for both; edges are steps (this side plus an attribute they rate up when
//             they get it) and bridges (unseen titles between two sides).
// - moods:    sides are the GoodWatch moods (and mood pairs) the person's loved titles fall into, named by the
//             moods; edges add a mood they rarely mix in, or a place from the tighter engine.
//
// The map variant renders the tighter engine's sides on a 2-D projection of the loved titles.
import { MOOD_BY_KEY, type MoodKey } from "~/domain/moods"
import { FAMILIES } from "~/server/taste-portrait/families.server"
import {
	K,
	KEYS,
	NON_CRAFT,
	type Person,
	type PoolTitle,
	type RatedTitle,
	average,
	cosine,
	meanOf,
	rankUnseen,
	round1,
	yearOf,
} from "~/server/taste-portrait/person.server"
import { lovedTitles } from "~/server/taste-portrait/sides.server"
import { adjective, capitalize, label, noun } from "~/server/taste-portrait/words.server"
import type { ProtoEdge, ProtoSide } from "~/ui/prototype-better-sides/model"
import type { TitleKey } from "~/utils/title-key"

type Vec = Float64Array

const FAMILY = new Map<string, string>()
for (const f of FAMILIES) for (const key of f.keys) FAMILY.set(key, f.id)

const EDGE_STEP = 56
const MORE_STEP = 65
const MORE = 18
const STRONG_Z = 1.2
const EXCLUDED_COUNTRIES = new Set(["US", "GB"])
const regionNames = new Intl.DisplayNames(["en"], { type: "region" })
const languageNames = new Intl.DisplayNames(["en"], { type: "language" })
const nameOf = (names: Intl.DisplayNames, code: string) => {
	try {
		return names.of(code) ?? code
	} catch {
		return code
	}
}
const WITH_THE = new Set(["NL", "PH", "AE", "DO", "BS", "GM", "CD", "CF", "CZ"])

const passes = (step: number | null | undefined, least: number) =>
	step === null || step === undefined || step >= least

export interface Built {
	sides: ProtoSide[]
	loose: number
	headline: string | null
	notes: string[]
	/** Side centers, for the map. */
	centers: Vec[]
	/** Each side's loved titles, for the map. */
	memberKeys: TitleKey[][]
}

// ---------- shared pieces ----------

/** Weighted cosine k-means, farthest-first seeding from the title closest to the seed. */
function kmeans(points: RatedTitle[], weights: number[], k: number, seed: Vec) {
	const start = [...points].sort((a, b) => cosine(b.z, seed) - cosine(a.z, seed) || a.key - b.key)[0]
	const centers: Vec[] = [start.z]
	while (centers.length < k) {
		let best = points[0]
		let bestSimilarity = Number.POSITIVE_INFINITY
		for (const p of points) {
			const similarity = Math.max(...centers.map((c) => cosine(p.z, c)))
			if (similarity < bestSimilarity) {
				bestSimilarity = similarity
				best = p
			}
		}
		centers.push(best.z)
	}
	let assigned: number[] = []
	for (let iteration = 0; iteration < 25; iteration++) {
		assigned = points.map((p) => nearest(p.z, centers).index)
		for (let i = 0; i < centers.length; i++) {
			const mean = new Float64Array(K)
			let total = 0
			points.forEach((p, j) => {
				if (assigned[j] !== i) return
				total += weights[j]
				for (let d = 0; d < K; d++) mean[d] += weights[j] * p.z[d]
			})
			if (total) centers[i] = mean.map((x) => x / total)
		}
	}
	return { centers, assigned }
}

function nearest(z: ArrayLike<number>, centers: Vec[]) {
	let index = 0
	let best = Number.NEGATIVE_INFINITY
	let second = Number.NEGATIVE_INFINITY
	centers.forEach((c, i) => {
		const s = cosine(z, c)
		if (s > best) {
			second = best
			best = s
			index = i
		} else if (s > second) second = s
	})
	return { index, similarity: best, second }
}

/** Centroid silhouette: how much closer each title is to its own center than to the next one. */
function separation(points: RatedTitle[], assigned: number[], centers: Vec[]) {
	let total = 0
	points.forEach((p, j) => {
		const own = 1 - cosine(p.z, centers[assigned[j]])
		let other = Number.POSITIVE_INFINITY
		centers.forEach((c, i) => {
			if (i !== assigned[j]) other = Math.min(other, 1 - cosine(p.z, c))
		})
		total += (other - own) / Math.max(own, other, 1e-9)
	})
	return total / points.length
}

/** Most typical first among the best rated, skipping near-duplicates (a franchise's films read alike). */
function typical(members: RatedTitle[], center: Vec, n: number, mu: number) {
	const ranked = [...members]
		.filter((r) => r.facts.hasPoster)
		.sort(
			(a, b) =>
				cosine(b.z, center) * (1 + 0.08 * (b.score - mu)) - cosine(a.z, center) * (1 + 0.08 * (a.score - mu)) ||
				a.key - b.key,
		)
	const picked: RatedTitle[] = []
	for (const r of ranked) {
		if (picked.length >= n) break
		if (picked.some((p) => cosine(p.z, r.z) > 0.88)) continue
		picked.push(r)
	}
	return picked
}

/** Attribute keys by how much the center stands out from the other centers. */
// Attributes about how a title sounds or is told, which make poor names.
const UNNAMED = new Set(["sound_centrality", "music_centrality", "dialogue_centrality", "rewatchability", "narrative_structure", "dialogue_quality", "character_depth"])
function contrast(center: Vec, others: Vec[]) {
	const base = others.length ? meanOf(others) : new Float64Array(K)
	return NON_CRAFT.filter((k) => !UNNAMED.has(KEYS[k]))
		.map((k) => ({ key: KEYS[k], k, weight: center[k] - base[k] }))
		.sort((a, b) => b.weight - a.weight)
}

/**
 * From the two attributes that most set the side apart: "Bleak stories about inner struggles" when one is a World
 * attribute (adjective from the other, noun from the World one), else "Heartwarming, physically funny stories".
 */
function contrastName(order: ReturnType<typeof contrast>, taken: Set<string>, keysOut?: string[]) {
	for (let shift = 0; shift < 4; shift++) {
		const [a, b] = [order[shift === 0 ? 0 : 0], order[1 + shift]]
		const world = [a, b].find((x) => FAMILY.get(x.key) === "world")
		const other = [a, b].find((x) => x !== world) ?? b
		const [x, y] = [adjective(a.key), adjective(b.key)]
		const name = world
			? `${capitalize(adjective(other.key))} ${noun(world.key)}`
			: x.endsWith(" funny") && y.endsWith(" funny")
				? `${capitalize(x.replace(/ funny$/, ""))} and ${y.replace(/ funny$/, "")} funny stories`
				: `${capitalize(x)}, ${y} stories`
		if (!taken.has(name)) {
			taken.add(name)
			keysOut?.push(a.key, b.key)
			return name
		}
	}
	keysOut?.push(order[0].key)
	return capitalize(noun(order[0].key))
}

const attributeLine = (order: ReturnType<typeof contrast>, n = 3) =>
	order
		.slice(0, n)
		.map((a) => label(a.key))
		.join(" · ")

/** More of this: unseen titles toward the side and the person's taste as a whole, at least a 65 rank step. */
function moreOfThis(person: Person, center: Vec, keep?: (t: PoolTitle) => boolean) {
	const direction = new Float64Array(K).map((_, k) => 0.5 * center[k] + 0.5 * person.signature[k])
	const ranked = rankUnseen(person, direction, 0.6, keep)
	const steps = person.rankSteps(ranked.map((t) => t.key))
	const everywhere: TitleKey[] = []
	const onServices: TitleKey[] = []
	for (const t of ranked) {
		if (!passes(steps.get(t.key), MORE_STEP)) continue
		if (everywhere.length < MORE) everywhere.push(t.key)
		if (onServices.length < MORE && person.onMyServices(t.key)) onServices.push(t.key)
		if (everywhere.length >= MORE && (onServices.length >= MORE || !person.input.services.length)) break
	}
	return ranked.map((t) => t.key).filter((key) => everywhere.includes(key) || onServices.includes(key))
}

function sideOf(
	id: string,
	members: RatedTitle[],
	center: Vec,
	others: Vec[],
	person: Person,
	n: number,
	extra: Partial<ProtoSide> = {},
): ProtoSide & { center: Vec; members: RatedTitle[] } {
	const order = contrast(center, others)
	const avg = average(members.map((r) => r.score))
	const here = typical(members, center, 6, person.mu)
	return {
		id,
		name: "",
		line: attributeLine(order),
		attributes: order.slice(0, 4).map((a) => ({ key: a.key, label: label(a.key) })),
		moods: [],
		hues: [],
		share: Math.round((members.length / n) * 1000) / 1000,
		count: members.length,
		average: round1(avg),
		lift: round1(avg - person.mu),
		anchor: null,
		here: here.map((r) => r.key),
		image: here.find((r) => r.facts.hasBackdrop)?.key ?? members.find((r) => r.facts.hasBackdrop)?.key ?? null,
		edges: [],
		moreOfThis: moreOfThis(person, center),
		shared: 0,
		center,
		members,
		...extra,
	}
}

// ---------- edges: places just past a side ----------

type Place = { kind: ProtoEdge["kind"]; id: string; of: (t: { facts: RatedTitle["facts"] }) => boolean; chip: string; tail: string; nameIn: string }

function placesOf(facts: RatedTitle["facts"]): Place[] {
	const places: Place[] = []
	const origin = facts.origin
	if (origin && /^[A-Z]{2}$/.test(origin) && !EXCLUDED_COUNTRIES.has(origin)) {
		const name = nameOf(regionNames, origin)
		const place = WITH_THE.has(origin) ? `the ${name}` : name
		places.push({ kind: "country", id: origin, of: (t) => t.facts.origin === origin, chip: `From ${place}`, tail: `from ${place}`, nameIn: place })
	} else if (origin && /^[a-z]{2}$/.test(origin) && origin !== "en") {
		const name = nameOf(languageNames, origin)
		places.push({ kind: "language", id: origin, of: (t) => t.facts.origin === origin, chip: `In ${name}`, tail: `in ${name}`, nameIn: name })
	}
	const year = yearOf(facts)
	if (year !== null) {
		const decade = Math.floor(year / 10) * 10
		places.push({
			kind: "decade",
			id: String(decade),
			of: (t) => {
				const y = yearOf(t.facts)
				return y !== null && y >= decade && y < decade + 10
			},
			chip: `From the ${decade}s`,
			tail: `from the ${decade}s`,
			nameIn: `the ${decade}s`,
		})
	}
	const show = facts.mediaType === "show"
	places.push({
		kind: "format",
		id: facts.mediaType,
		of: (t) => t.facts.mediaType === facts.mediaType,
		chip: show ? "As a show" : "As a film",
		tail: show ? "as a show" : "as a film",
		nameIn: show ? "shows" : "films",
	})
	const animated = facts.anime || facts.genres.includes("Animation")
	if (animated)
		places.push({
			kind: "animation",
			id: "animated",
			of: (t) => t.facts.anime || t.facts.genres.includes("Animation"),
			chip: "Animated",
			tail: "animated",
			nameIn: "animation",
		})
	return places
}

/**
 * Places common right next to this side in the catalog that the person has barely rated there: at most three, one per
 * kind. Rated "there" means rated titles closest to this side.
 */
function placeEdges(
	person: Person,
	side: { id: string; name: string; center: Vec },
	centers: Vec[],
	index: number,
	max = 3,
): ProtoEdge[] {
	const near = person.rated.filter((r) => {
		const n = nearest(r.z, centers)
		return n.index === index && n.similarity > 0.1
	})
	const pool = rankUnseen(person, side.center, 0.4, (t) => {
		const n = nearest(t.z, centers)
		return n.index === index && n.similarity > 0.3
	}).slice(0, 700)
	if (pool.length < 40) return []
	const counted = new Map<string, { place: Place; pool: PoolTitle[] }>()
	for (const t of pool)
		for (const place of placesOf(t.facts)) {
			const id = `${place.kind}:${place.id}`
			const entry = counted.get(id) ?? { place, pool: [] }
			entry.pool.push(t)
			counted.set(id, entry)
		}
	const candidates: (ProtoEdge & { strength: number })[] = []
	for (const [id, { place, pool: there }] of counted) {
		const shareHere = there.length / pool.length
		if (there.length < 10 || shareHere < 0.025) continue
		const rated = near.filter((r) => place.of(r))
		const shareRated = near.length ? rated.length / near.length : 0
		// Barely tried: a third or less of how common it is here, and at most a handful.
		if (shareRated > shareHere / 3 || rated.length > Math.max(3, near.length * 0.05)) continue
		const avg = rated.length ? average(rated.map((r) => r.score)) : null
		if (avg !== null && avg < person.mu - 0.3) continue
		const ranked = there.slice(0, 16)
		const steps = person.rankSteps(ranked.map((t) => t.key))
		const suggestions = ranked.filter((t) => passes(steps.get(t.key), EDGE_STEP)).slice(0, 8)
		if (suggestions.length < 4) continue
		const top = suggestions.slice(0, 4).map((t) => steps.get(t.key) ?? 60)
		candidates.push({
			id: `${side.id}-${id}`,
			kind: place.kind,
			chip: place.chip,
			line: `${side.name}, ${place.tail}`,
			evidence:
				avg === null
					? `Common right next to this side, and you haven't rated any of it yet.`
					: `You've rated ${rated.length} of these, ${round1(avg)} on average; usually you give ${round1(person.mu)}.`,
			average: avg === null ? null : round1(avg),
			count: rated.length,
			rated: rated.filter((r) => r.facts.hasPoster).sort((a, b) => b.score - a.score).slice(0, 4).map((r) => r.key),
			suggestions: suggestions.map((t) => t.key),
			image: suggestions.find((t) => t.facts.hasBackdrop)?.key ?? null,
			strength: shareHere - shareRated + (avg === null ? 0 : (avg - person.mu) * 0.03) + average(top) / 1000,
		})
	}
	const chosen: ProtoEdge[] = []
	const kinds = new Set<string>()
	for (const c of candidates.sort((a, b) => b.strength - a.strength || a.id.localeCompare(b.id))) {
		if (chosen.length >= max) break
		if (kinds.has(c.kind)) continue
		if (chosen.some((o) => o.suggestions.filter((k) => c.suggestions.includes(k)).length >= 3)) continue
		kinds.add(c.kind)
		const { strength, ...edge } = c
		chosen.push(edge)
	}
	return chosen
}

// ---------- tighter ----------

export function buildTighter(person: Person): Built {
	const empty: Built = { sides: [], loose: 0, headline: null, notes: [], centers: [], memberKeys: [] }
	const loved = lovedTitles(person)
	const n = loved.length
	if (n < 6) return empty
	const weights = loved.map((r) => 1 + Math.max(0, (r.score - person.mu) / person.sigma))
	const maxK = n < 20 ? 2 : n < 50 ? 3 : n < 120 ? 4 : 6
	const minSize = Math.max(3, Math.ceil(0.07 * n))
	// The fewest sides that each hold together: average closeness to their center of at least COHERENT.
	const COHERENT = 0.55
	let best: { k: number; centers: Vec[]; assigned: number[]; coherence: number } | null = null
	const tried: string[] = []
	for (let k = 2; k <= maxK; k++) {
		let { centers, assigned } = kmeans(loved, weights, k, person.signature)
		// Fold sides that are too small into their nearest neighbour, then settle again.
		for (let round = 0; round < 3; round++) {
			const sizes = centers.map((_, i) => assigned.filter((a) => a === i).length)
			const keep = centers.filter((_, i) => sizes[i] >= minSize)
			if (keep.length === centers.length || keep.length < 2) break
			centers = keep
			assigned = loved.map((p) => nearest(p.z, centers).index)
			centers = centers.map((c, i) => {
				const members = loved.filter((_, j) => assigned[j] === i)
				return members.length ? meanOf(members.map((m) => m.z)) : c
			})
			assigned = loved.map((p) => nearest(p.z, centers).index)
		}
		if (centers.length < 2) continue
		const coherence = average(loved.map((p, j) => cosine(p.z, centers[assigned[j]])))
		tried.push(`k=${centers.length} holds together ${coherence.toFixed(2)}`)
		if (!best || (best.coherence < COHERENT && coherence > best.coherence)) best = { k: centers.length, centers, assigned, coherence }
		if (coherence >= COHERENT) break
	}
	if (!best) return empty
	const { centers, assigned } = best
	let loose = 0
	const groups = centers.map(() => [] as RatedTitle[])
	loved.forEach((r, j) => {
		if (cosine(r.z, centers[assigned[j]]) < 0.15) loose++
		else groups[assigned[j]].push(r)
	})
	const order = groups
		.map((members, i) => ({ members, center: centers[i] }))
		.filter((g) => g.members.length >= 2)
		.sort((a, b) => b.members.length - a.members.length)
	const taken = new Set<string>()
	const sides = order.map((g, i) =>
		sideOf(
			`side-${i + 1}`,
			g.members,
			g.center,
			order.filter((o) => o !== g).map((o) => o.center),
			person,
			n,
		),
	)
	for (const side of sides) {
		const keys: string[] = []
		side.name = contrastName(contrast(side.center, sides.filter((s) => s !== side).map((s) => s.center)), taken, keys)
		side.nameKeys = keys
	}
	const sideCenters = sides.map((s) => s.center)
	const used = new Set<string>()
	sides.forEach((side, i) => {
		side.edges = withSteps(person, side, sideCenters, i, placeEdges(person, side, sideCenters, i), used)
	})
	return {
		sides: sides.map(({ center, members, ...side }) => side),
		loose,
		headline: headlineOf(sides),
		notes: [`${tried.join(", ")}; chose ${best.k} sides (the fewest that hold together at ${COHERENT}; min size ${minSize})`, `${loose} loved titles fit no side well`],
		centers: sideCenters,
		memberKeys: sides.map((s) => s.members.map((m) => m.key)),
	}
}

function headlineOf(sides: { id: string; name: string; center: Vec }[]) {
	if (sides.length < 2) return null
	let pair: [string, string] | null = null
	let least = Number.POSITIVE_INFINITY
	for (const a of sides)
		for (const b of sides) {
			if (a === b) continue
			const s = cosine(a.center, b.center)
			if (s < least) {
				least = s
				pair = [a.name, b.name]
			}
		}
	return pair ? `You love ${pair[0].toLowerCase()}, and just as much ${pair[1].toLowerCase()}.` : null
}

// ---------- anchored ----------

export function buildAnchored(person: Person): Built {
	const empty: Built = { sides: [], loose: 0, headline: null, notes: [], centers: [], memberKeys: [] }
	const loved = lovedTitles(person)
	const n = loved.length
	if (n < 6) return empty
	const maxK = n < 20 ? 2 : n < 50 ? 3 : n < 120 ? 4 : 5
	const minSize = Math.max(3, Math.ceil(0.06 * n))
	const RADIUS = 0.42
	const neighbours = loved.map((a) => loved.filter((b) => cosine(a.z, b.z) >= RADIUS))
	const covered = new Set<number>()
	const anchors: RatedTitle[] = []
	while (anchors.length < maxK) {
		let best = -1
		let bestValue = 0
		loved.forEach((t, i) => {
			if (!t.facts.hasPoster || anchors.includes(t)) return
			if (anchors.some((a) => cosine(a.z, t.z) > 0.25)) return
			const fresh = neighbours[i].filter((b) => !covered.has(b.key))
			// Dense, rated high, and widely known, so the name says something to the reader.
			const known = Math.log10(10 + t.facts.votes)
			const typicality = cosine(t.z, meanOf(fresh.map((b) => b.z)))
			const value = fresh.reduce((s, b) => s + 1 + 0.15 * (b.score - person.mu), 0) * (1 + 0.1 * (t.score - person.mu)) * known * Math.max(0.2, typicality)
			if (fresh.length >= minSize && value > bestValue) {
				bestValue = value
				best = i
			}
		})
		if (best < 0) break
		anchors.push(loved[best])
		for (const b of neighbours[best]) covered.add(b.key)
	}
	if (anchors.length < 2) return empty
	// Each side's center: the anchor's neighbourhood. Titles close to two sides count for both.
	let centers = anchors.map((a) => meanOf(loved.filter((b) => cosine(a.z, b.z) >= RADIUS).map((b) => b.z)))
	const groups = anchors.map(() => [] as RatedTitle[])
	let loose = 0
	let shared = 0
	for (const r of loved) {
		const near = nearest(r.z, centers)
		if (near.similarity < 0.22) {
			loose++
			continue
		}
		groups[near.index].push(r)
		if (near.second > 0.22 && near.similarity - near.second < 0.04) {
			const second = centers.findIndex((c, i) => i !== near.index && cosine(r.z, c) === near.second)
			if (second >= 0) {
				groups[second].push(r)
				shared++
			}
		}
	}
	centers = groups.map((g, i) => (g.length ? meanOf(g.map((m) => m.z)) : centers[i]))
	const sides = anchors
		.map((anchor, i) => ({ anchor, members: groups[i], center: centers[i] }))
		.filter((g) => g.members.length >= 2)
		.sort((a, b) => b.members.length - a.members.length)
		.map((g, i, all) => {
			const side = sideOf(
				`side-${i + 1}`,
				g.members,
				g.center,
				all.filter((o) => o !== g).map((o) => o.center),
				person,
				n,
				{ anchor: g.anchor.key },
			)
			side.here = [g.anchor.key, ...side.here.filter((k) => k !== g.anchor.key)].slice(0, 6)
			side.shared = g.members.filter((m) => groups.filter((x) => x.includes(m)).length > 1).length
			side.name = "" // named by the anchor's title on the page
			return side
		})
	const sideCenters = sides.map((s) => s.center)
	const used = new Set<string>()
	const bridged = new Set<string>()
	sides.forEach((side, i) => {
		const bridges = bridgeEdges(person, sides, i).filter((b) => {
			const pair = [side.id, b.toward].sort().join("|")
			if (bridged.has(pair)) return false
			bridged.add(pair)
			return true
		})
		side.edges = [...stepEdges(person, side, sideCenters, i, used), ...bridges]
	})
	return {
		sides: sides.map(({ center, members, ...side }) => side),
		loose,
		headline: null,
		notes: [`${anchors.length} anchors (radius ${RADIUS}, min ${minSize})`, `${shared} titles sit in two sides`, `${loose} loved titles fit no side`],
		centers: sideCenters,
		memberKeys: sides.map((s) => s.members.map((m) => m.key)),
	}
}

/** Fewer than two edges: add steps ("this side, but darkly funny"), headlined with the side's name. */
function withSteps(person: Person, side: { id: string; name: string; members: RatedTitle[]; center: Vec }, centers: Vec[], index: number, edges: ProtoEdge[], used: Set<string>) {
	if (edges.length >= 2) return edges
	const steps = stepEdges(person, side, centers, index, used)
		.slice(0, 2 - edges.length)
		.map((e) => ({ ...e, line: `${side.name}, ${e.line}` }))
	return [...edges, ...steps]
}

/** "This side, but darkly funny": attributes the person rates up when they get them, rare in this side. */
function stepEdges(person: Person, side: { id: string; members: RatedTitle[]; center: Vec }, centers: Vec[], index: number, used?: Set<string>): ProtoEdge[] {
	const candidates = NON_CRAFT.flatMap((k) => {
		const key = KEYS[k]
		if (UNNAMED.has(key)) return []
		const inSide = side.members.filter((m) => m.z[k] > STRONG_Z).length / side.members.length
		if (inSide > 0.12 || side.center[k] > 0.3) return []
		if (used?.has(key)) return []
		// Evidence from this side's neighbourhood: rated titles closest to this side that carry it.
		const hit = person.rated.filter((r) => r.z[k] > STRONG_Z && nearest(r.z, centers).index === index)
		if (hit.length < 2) return []
		const lift = average(hit.map((r) => r.score)) - person.mu
		if (lift < 0.2) return []
		const direction = new Float64Array(side.center).map((x, d) => (d === k ? x + 1.5 : x))
		const pool = rankUnseen(person, direction, 0.4, (t) => t.z[k] > STRONG_Z && nearest(t.z, centers).index === index).slice(0, 14)
		const steps = person.rankSteps(pool.map((t) => t.key))
		const suggestions = pool.filter((t) => passes(steps.get(t.key), EDGE_STEP)).slice(0, 8)
		if (suggestions.length < 4) return []
		const ratedHere = side.members.filter((m) => m.z[k] > STRONG_Z)
		return [{ k, key, lift, inSide, hit, suggestions, ratedHere, strength: lift * (1 - inSide) + suggestions.length / 40 }]
	})
		.sort((a, b) => b.strength - a.strength)
		.slice(0, 2)
	for (const c of candidates) used?.add(c.key)
	return candidates.map((c) => ({
		id: `${side.id}-step-${c.key}`,
		kind: "step" as const,
		chip: `+ ${capitalize(adjective(c.key))}`,
		line: `but ${adjective(c.key)}`,
		evidence: `Near this side, when a title is ${adjective(c.key)} you rate it ${round1(person.mu + c.lift)} on average (usually ${round1(person.mu)}), ${c.inSide === 0 ? "yet none of this side is" : `yet only ${Math.round(c.inSide * 100)}% of this side is`}.`,
		average: round1(person.mu + c.lift),
		count: c.hit.length,
		rated: c.hit.filter((r) => r.facts.hasPoster).sort((a, b) => b.score - a.score).slice(0, 4).map((r) => r.key),
		suggestions: c.suggestions.map((t) => t.key),
		image: c.suggestions.find((t) => t.facts.hasBackdrop)?.key ?? null,
	}))
}

/** Unseen titles between this side and its closest other side. */
function bridgeEdges(person: Person, sides: { id: string; center: Vec; anchor: TitleKey | null }[], index: number): ProtoEdge[] {
	const side = sides[index]
	const other = sides
		.map((s, i) => ({ s, i, similarity: cosine(s.center, side.center) }))
		.filter((x) => x.i !== index)
		.sort((a, b) => b.similarity - a.similarity)[0]
	if (!other) return []
	const mid = new Float64Array(K).map((_, d) => 0.5 * side.center[d] + 0.5 * other.s.center[d])
	const pool = rankUnseen(person, mid, 0.4, (t) => {
		const a = cosine(t.z, side.center)
		const b = cosine(t.z, other.s.center)
		return a > 0.2 && b > 0.2 && Math.abs(a - b) < 0.12
	}).slice(0, 14)
	const steps = person.rankSteps(pool.map((t) => t.key))
	const suggestions = pool.filter((t) => passes(steps.get(t.key), EDGE_STEP)).slice(0, 8)
	if (suggestions.length < 4) return []
	const between = person.rated.filter((r) => {
		const a = cosine(r.z, side.center)
		const b = cosine(r.z, other.s.center)
		return a > 0.2 && b > 0.2 && Math.abs(a - b) < 0.12
	})
	const avg = between.length ? average(between.map((r) => r.score)) : null
	if (avg !== null && between.length >= 3 && avg < person.mu - 0.3) return []
	return [
		{
			id: `${side.id}-bridge-${other.s.id}`,
			kind: "bridge",
			chip: "Toward",
			line: "",
			toward: other.s.id,
			evidence:
				avg === null
					? "Titles that sit right between these two sides. You haven't rated any yet."
					: `You've rated ${between.length} ${between.length === 1 ? "title" : "titles"} that sit between these two sides, ${round1(avg)} on average; usually you give ${round1(person.mu)}.`,
			average: avg === null ? null : round1(avg),
			count: between.length,
			rated: between.filter((r) => r.facts.hasPoster).sort((a, b) => b.score - a.score).slice(0, 4).map((r) => r.key),
			suggestions: suggestions.map((t) => t.key),
			image: suggestions.find((t) => t.facts.hasBackdrop)?.key ?? null,
		},
	]
}

// ---------- moods ----------

export function buildMoods(person: Person): Built {
	const empty: Built = { sides: [], loose: 0, headline: null, notes: [], centers: [], memberKeys: [] }
	const loved = lovedTitles(person)
	const n = loved.length
	if (n < 6) return empty
	const maxK = n < 20 ? 2 : n < 50 ? 3 : n < 120 ? 4 : 5
	const minSize = Math.max(3, Math.ceil(0.07 * n))
	const pool = person.unseen
	const poolShare = (moods: MoodKey[]) => pool.filter((t) => moods.every((m) => t.facts.moods.includes(m))).length / Math.max(1, pool.length)
	const has = (r: { facts: RatedTitle["facts"] }, moods: MoodKey[]) => moods.every((m) => r.facts.moods.includes(m))
	const combos = new Map<string, MoodKey[]>()
	for (const r of loved) {
		const ms = [...r.facts.moods].sort()
		for (const a of ms) combos.set(a, [a])
		for (let i = 0; i < ms.length; i++) for (let j = i + 1; j < ms.length; j++) combos.set(`${ms[i]}+${ms[j]}`, [ms[i], ms[j]])
	}
	const scored = [...combos.values()]
		.map((moods) => {
			const members = loved.filter((r) => has(r, moods))
			const rated = person.rated.filter((r) => has(r, moods))
			const lift = average(rated.map((r) => r.score)) - person.mu
			const specificity = members.length / n / Math.max(0.005, poolShare(moods))
			return { moods, members, rated, lift, specificity, value: members.length * (1 + Math.max(-0.5, lift) * 0.3) * Math.sqrt(Math.min(4, specificity)) * (moods.length === 2 ? 1.15 : 1) }
		})
		.filter((c) => c.members.length >= minSize)
		.sort((a, b) => b.value - a.value || a.moods.join().localeCompare(b.moods.join()))
	const chosen: typeof scored = []
	for (const c of scored) {
		if (chosen.length >= maxK) break
		const overlaps = chosen.some((o) => {
			const inter = c.members.filter((m) => o.members.includes(m)).length
			return inter / Math.min(c.members.length, o.members.length) > 0.6
		})
		if (overlaps) continue
		chosen.push(c)
	}
	if (chosen.length < 2) return empty
	const inAny = new Set(chosen.flatMap((c) => c.members.map((m) => m.key)))
	const centers = chosen.map((c) => meanOf(c.members.map((m) => m.z)))
	const sides = chosen.map((c, i) => {
		const side = sideOf(
			`side-${i + 1}`,
			c.members,
			centers[i],
			centers.filter((_, j) => j !== i),
			person,
			n,
			{ moods: c.moods, hues: c.moods.map((m) => MOOD_BY_KEY[m].hue) },
		)
		side.name = c.moods.map((m) => MOOD_BY_KEY[m].name).join(" + ")
		side.moreOfThis = moreOfThis(person, centers[i], (t) => has(t, c.moods))
		side.shared = c.members.filter((m) => chosen.filter((o) => o.members.includes(m)).length > 1).length
		return side
	})
	const used = new Set<string>()
	sides.forEach((side, i) => {
		const moodEdges = addMoodEdges(person, side, has)
		side.edges = withSteps(person, side, centers, i, [...moodEdges, ...placeEdges(person, side, centers, i, 3 - moodEdges.length)], used)
	})
	return {
		sides: sides.map(({ center, members, ...side }) => side),
		loose: n - inAny.size,
		headline: null,
		notes: [`${scored.length} mood combinations with ${minSize}+ loved titles; picked ${chosen.length}`, `${n - inAny.size} loved titles in no chosen mood`],
		centers,
		memberKeys: sides.map((s) => s.members.map((m) => m.key)),
	}
}

/** A mood the person rarely mixes into this side, common in the catalog with it, and not one they rate down. */
function addMoodEdges(
	person: Person,
	side: { id: string; name: string; moods: MoodKey[]; center: Vec },
	has: (r: { facts: RatedTitle["facts"] }, moods: MoodKey[]) => boolean,
): ProtoEdge[] {
	const all = Object.keys(MOOD_BY_KEY) as MoodKey[]
	const out = all
		.filter((m) => !side.moods.includes(m))
		.flatMap((m) => {
			const moods = [...side.moods, m]
			const pool = person.unseen.filter((t) => has(t, moods))
			if (pool.length < 15) return []
			const rated = person.rated.filter((r) => has(r, moods))
			if (rated.length > 3) return []
			if (rated.length && average(rated.map((r) => r.score)) < person.mu - 0.3) return []
			const overall = person.rated.filter((r) => r.facts.moods.includes(m))
			const lift = overall.length ? average(overall.map((r) => r.score)) - person.mu : 0
			if (overall.length >= 5 && lift < -0.4) return []
			const ranked = rankUnseen(person, side.center, 0.5, (t) => has(t, moods)).slice(0, 14)
			const steps = person.rankSteps(ranked.map((t) => t.key))
			const suggestions = ranked.filter((t) => passes(steps.get(t.key), EDGE_STEP)).slice(0, 8)
			if (suggestions.length < 4) return []
			return [{ m, moods, rated, lift, suggestions, strength: Math.log(pool.length) + lift - rated.length * 0.3 }]
		})
		.sort((a, b) => b.strength - a.strength)
		.slice(0, 2)
	return out.map((c) => {
		const avg = c.rated.length ? average(c.rated.map((r) => r.score)) : null
		return {
			id: `${side.id}-mood-${c.m}`,
			kind: "mood" as const,
			chip: `+ ${MOOD_BY_KEY[c.m].name}`,
			line: `${side.name} + ${MOOD_BY_KEY[c.m].name}`,
			evidence:
				avg === null
					? `You haven't rated anything that is ${side.name} and ${MOOD_BY_KEY[c.m].name} at once.`
					: `You've rated ${c.rated.length} that mix them, ${round1(avg)} on average; usually you give ${round1(person.mu)}.`,
			average: avg === null ? null : round1(avg),
			count: c.rated.length,
			rated: c.rated.filter((r) => r.facts.hasPoster).slice(0, 4).map((r) => r.key),
			suggestions: c.suggestions.map((t) => t.key),
			image: c.suggestions.find((t) => t.facts.hasBackdrop)?.key ?? null,
			moods: c.moods,
		}
	})
}

// ---------- the map's projection ----------

/** Two principal directions of the loved titles' attributes, by power iteration. */
export function projection(person: Person) {
	const loved = lovedTitles(person)
	const mean = meanOf(loved.map((r) => r.z))
	const rows = loved.map((r) => NON_CRAFT.map((k) => r.z[k] - mean[k]))
	const dims = NON_CRAFT.length
	const components: number[][] = []
	for (let c = 0; c < 2; c++) {
		let v = Array.from({ length: dims }, (_, i) => Math.sin(i * (c + 1) + 1))
		for (let it = 0; it < 60; it++) {
			const next = new Array(dims).fill(0)
			for (const row of rows) {
				let dot = 0
				for (let d = 0; d < dims; d++) dot += row[d] * v[d]
				for (let d = 0; d < dims; d++) next[d] += dot * row[d]
			}
			for (const prev of components) {
				let dot = 0
				for (let d = 0; d < dims; d++) dot += next[d] * prev[d]
				for (let d = 0; d < dims; d++) next[d] -= dot * prev[d]
			}
			const norm = Math.sqrt(next.reduce((s, x) => s + x * x, 0)) || 1
			v = next.map((x) => x / norm)
		}
		components.push(v)
	}
	const raw = (z: ArrayLike<number>) => components.map((v) => NON_CRAFT.reduce((s, k, d) => s + (z[k] - mean[k]) * v[d], 0))
	const points = loved.map((r) => raw(r.z))
	const span = (i: number) => {
		const xs = points.map((p) => p[i]).sort((a, b) => a - b)
		return [xs[Math.floor(xs.length * 0.03)] ?? -1, xs[Math.ceil(xs.length * 0.97) - 1] ?? 1]
	}
	const [x0, x1] = span(0)
	const [y0, y1] = span(1)
	const clamp = (x: number) => Math.max(0.04, Math.min(0.96, x))
	return (z: ArrayLike<number>) => {
		const [a, b] = raw(z)
		return { x: clamp(0.1 + (0.8 * (a - x0)) / (x1 - x0 || 1)), y: clamp(0.1 + (0.8 * (b - y0)) / (y1 - y0 || 1)) }
	}
}
