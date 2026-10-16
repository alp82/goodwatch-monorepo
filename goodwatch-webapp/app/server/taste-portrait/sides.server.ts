// Sides of you: the fewest groups of what the person loves (2 to 5) that each hold together, named by what sets each
// apart from the others, each with the places just past it (its edges) and More of this. Lists of unseen titles inside
// a side are ordered by the person's personal order when it is on for them: sides group, personal order ranks.
import { MOOD_KEYS, type MoodKey } from "~/domain/moods"
import type { TitleKey } from "~/server/title-snapshot/index.server"
import { familyOf } from "./families.server"
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
} from "./person.server"
import type { Side, SideEdge, SidesView } from "./view"
import { adjective, capitalize, label, noun } from "./words.server"

// The person's services with their logos are added with the titles (index.server.ts).
type SidesResult = Omit<SidesView, "titles" | "subject" | "services">

/** Orders unseen titles for the person (personal order); without it, the order given. */
export type OrderTitles = (keys: TitleKey[]) => TitleKey[]

const MORE_OF_THIS = 12
// More of this draws its titles from this many of the side's closest, then personal order picks the first 12.
const MORE_OF_THIS_POOL = 48
// The least rank step (Person.rankSteps, 50 to 99) of a suggestion: 65 is the top 70 percent of the person's range, 56
// the top 89 percent.
const MORE_OF_THIS_STEP = 65
const EDGE_STEP = 56
const EDGE_SUGGESTIONS = 8
const EDGE_MIN_SUGGESTIONS = 4
const MAX_SIDES = 5
// A side holds together when its titles are, on average, at least this close to its center.
const HOLDS_TOGETHER = 0.55
// A loved title less close than this to its side's center fits no side and is left out.
const FITS_NO_SIDE = 0.3
// A title this far below the catalog on an attribute a side's name claims (z) is not described by that name.
const AGAINST_NAME = -1
// Candidates for "You're here": the view keeps four after leaving out a franchise's second title.
const HERE = 8
// Titles above z 1.2 on an attribute carry it strongly.
const STRONG_Z = 1.2
const EXCLUDED_COUNTRIES = new Set(["US", "GB"])
// Region names that read with "the": "from the Netherlands".
const WITH_THE = new Set(["NL", "PH", "AE", "DO", "BS", "GM", "CD", "CF", "CZ"])
const LANGUAGE_NAMES: Record<string, string> = { cn: "Cantonese" }
// Attributes about how a title sounds or is told: they make poor names and steps.
const UNNAMED = new Set([
	"sound_centrality",
	"music_centrality",
	"dialogue_centrality",
	"rewatchability",
	"narrative_structure",
	"dialogue_quality",
	"character_depth",
])
// A side opens Watch next with the moods that most of its titles carry.
const MOOD_SHARE = 0.4
const MAX_SIDE_MOODS = 2

const regionNames = new Intl.DisplayNames(["en"], { type: "region" })
const languageNames = new Intl.DisplayNames(["en"], { type: "language" })
const displayName = (names: Intl.DisplayNames, code: string) => {
	try {
		return names.of(code) ?? code
	} catch {
		return code
	}
}

type Vec = Float64Array

/** Loved titles: rated at least max(8, round(usual + 0.6 spread)), or all rated at least the usual when fewer than 6. */
export function lovedTitles(person: Person): RatedTitle[] {
	const cut = Math.max(8, Math.round(person.mu + 0.6 * person.sigma))
	const loved = person.rated.filter((r) => r.score >= cut)
	return loved.length >= 6
		? loved
		: person.rated.filter((r) => r.score >= person.mu)
}

// Without taste there is no match to hold suggestions to, so every suggestion passes.
const passes = (step: number | null | undefined, least: number) =>
	step === null || step === undefined || step >= least

/** The closest center to z, how close, and how close the next one is. */
function nearest(z: ArrayLike<number>, centers: Vec[]) {
	let index = 0
	let best = Number.NEGATIVE_INFINITY
	centers.forEach((c, i) => {
		const similarity = cosine(z, c)
		if (similarity > best) {
			best = similarity
			index = i
		}
	})
	return { index, similarity: best }
}

// ---------- grouping ----------

/** Rating-weighted k-means by cosine, 25 iterations, seeded farthest-first from the title closest to the seed. */
function kmeans(points: RatedTitle[], weights: number[], k: number, seed: Vec) {
	const start = [...points].sort(
		(a, b) => cosine(b.z, seed) - cosine(a.z, seed) || a.key - b.key,
	)[0]
	const centers: Vec[] = [start.z]
	while (centers.length < k) {
		let best = points[0]
		let bestSimilarity = Number.POSITIVE_INFINITY
		for (const p of points) {
			const similarity = nearest(p.z, centers).similarity
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

/** The fewest sides that each hold together, with sides too small to stand folded into their neighbours. */
function group(loved: RatedTitle[], person: Person) {
	const n = loved.length
	const weights = loved.map(
		(r) => 1 + Math.max(0, (r.score - person.mu) / person.sigma),
	)
	// Small histories: up to one side per 2.5 loved titles, three at most, and two titles make a side (as the sample
	// taste guests see needs: 14 loved titles, mostly one strand).
	const maxK = Math.min(
		MAX_SIDES,
		n < 50 ? Math.min(3, Math.floor(n / 2.5)) : n < 120 ? 4 : 5,
	)
	const minSize = n < 30 ? 2 : Math.max(3, Math.ceil(0.07 * n))
	let best: { centers: Vec[]; assigned: number[]; closeness: number } | null =
		null
	for (let k = 2; k <= maxK; k++) {
		let { centers, assigned } = kmeans(loved, weights, k, person.signature)
		for (let round = 0; round < 3; round++) {
			const sizes = centers.map(
				(_, i) => assigned.filter((a) => a === i).length,
			)
			const kept = centers.filter((_, i) => sizes[i] >= minSize)
			if (kept.length === centers.length || kept.length < 2) break
			assigned = loved.map((p) => nearest(p.z, kept).index)
			centers = kept.map((c, i) => {
				const members = loved.filter((_, j) => assigned[j] === i)
				return members.length ? meanOf(members.map((m) => m.z)) : c
			})
			assigned = loved.map((p) => nearest(p.z, centers).index)
		}
		// A side too small to stand, once its titles that fit no side are out: this k has no sides.
		const sizes = centers.map(
			(center, i) =>
				loved.filter(
					(r, j) => assigned[j] === i && cosine(r.z, center) >= FITS_NO_SIDE,
				).length,
		)
		if (centers.length < 2 || sizes.some((size) => size < minSize)) continue
		const closeness = average(
			loved.map((p, j) => cosine(p.z, centers[assigned[j]])),
		)
		if (
			!best ||
			(best.closeness < HOLDS_TOGETHER && closeness > best.closeness)
		)
			best = { centers, assigned, closeness }
		if (closeness >= HOLDS_TOGETHER) break
	}
	if (!best) return []
	const { centers, assigned } = best
	return centers
		.map((center, i) => ({
			center,
			members: loved.filter(
				(r, j) => assigned[j] === i && cosine(r.z, center) >= FITS_NO_SIDE,
			),
		}))
		.filter((g) => g.members.length >= 2)
		.sort((a, b) => b.members.length - a.members.length)
}

// ---------- naming ----------

/**
 * Attribute keys by how much the center stands out from the other sides' centers, most first. Half the others' mean,
 * so what the side itself is strongest in still leads when another side is small or close.
 */
function standout(center: Vec, others: Vec[]) {
	const base = others.length
		? meanOf(others).map((x) => 0.5 * x)
		: new Float64Array(K)
	return NON_CRAFT.filter((k) => !UNNAMED.has(KEYS[k]))
		.map((k) => ({ key: KEYS[k], weight: center[k] - base[k] }))
		.sort((a, b) => b.weight - a.weight || a.key.localeCompare(b.key))
}

/**
 * The names a side can take, best first, from the two attributes that most set it apart: "Bleak stories about crime
 * and justice" when one is a World attribute (an adjective from the other, the noun from the World one), else
 * "Hopeful, heartwarming stories", and two kinds of humor as one: "Physically and situationally funny stories". Then
 * the first attribute with the next ones, and its noun alone.
 */
function sideNames(order: ReturnType<typeof standout>) {
	const names: { name: string; keys: string[] }[] = []
	for (let shift = 0; shift < 4; shift++) {
		const a = order[0]
		const b = order[1 + shift]
		if (!a || !b) break
		const world = [a, b].find((x) => familyOf(x.key) === "world")
		const other = world === a ? b : a
		const [x, y] = [adjective(a.key), adjective(b.key)]
		const name = world
			? `${capitalize(adjective(other.key))} ${noun(world.key)}`
			: x.endsWith(" funny") && y.endsWith(" funny")
				? `${capitalize(x.replace(/ funny$/, ""))} and ${y.replace(/ funny$/, "")} funny stories`
				: `${capitalize(x)}, ${y} stories`
		names.push({ name, keys: [a.key, b.key] })
	}
	if (order[0])
		names.push({ name: capitalize(noun(order[0].key)), keys: [order[0].key] })
	return names
}

/**
 * The side's name and the titles it describes: the first name not taken that still describes most of the side (three
 * in four of its titles), else the one that describes the most. Null when no name describes two.
 */
function nameSide(
	order: ReturnType<typeof standout>,
	members: RatedTitle[],
	taken: Set<string>,
) {
	let best: { name: string; members: RatedTitle[] } | null = null
	for (const { name, keys } of sideNames(order)) {
		if (taken.has(name)) continue
		const described = describedBy(members, keys)
		if (described.length >= Math.max(2, Math.ceil(0.75 * members.length))) {
			best = { name, members: described }
			break
		}
		if (!best || described.length > best.members.length)
			best = { name, members: described }
	}
	if (!best || best.members.length < 2) return null
	taken.add(best.name)
	return best
}

/** The side's titles its name describes: none strongly against an attribute the name claims. */
function describedBy(members: RatedTitle[], keys: string[]) {
	const at = keys.map((key) => KEYS.indexOf(key))
	return members.filter((r) => at.every((k) => r.z[k] >= AGAINST_NAME))
}

/** The most typical titles among the best rated, one per franchise (a franchise's films read alike). */
function typical(members: RatedTitle[], center: Vec, mu: number) {
	const value = (r: RatedTitle) =>
		cosine(r.z, center) * (1 + 0.08 * (r.score - mu))
	const ranked = [...members]
		.filter((r) => r.facts.hasPoster)
		.sort((a, b) => value(b) - value(a) || a.key - b.key)
	const picked: RatedTitle[] = []
	for (const r of ranked) {
		if (picked.some((p) => cosine(p.z, r.z) > 0.88)) continue
		picked.push(r)
	}
	return picked
}

/** The moods most of the side's titles carry, most common first. */
function sideMoods(members: RatedTitle[]): MoodKey[] {
	return MOOD_KEYS.map((mood) => ({
		mood,
		share:
			members.filter((r) => r.facts.moods.includes(mood)).length /
			members.length,
	}))
		.filter((m) => m.share >= MOOD_SHARE)
		.sort((a, b) => b.share - a.share)
		.slice(0, MAX_SIDE_MOODS)
		.map((m) => m.mood)
}

/**
 * A title's franchise when its name says so: the part before a subtitle or a sequel number. "The Lord of the Rings:
 * The Two Towers" and "Toy Story 2" give "lord of the rings" and "toy story"; titles that only share their first words,
 * such as "Once Upon a Time in America" and "...in Hollywood", stay apart.
 */
export function franchiseOf(title: string): string {
	return title
		.toLowerCase()
		.replace(/^(the|a|an) /, "")
		.split(/:| - | part /)[0]
		.replace(/\s+(\d+|ii|iii|iv|v|vi)$/, "")
		.trim()
}

// ---------- More of this ----------

/** Unseen titles toward the side and the person's taste as a whole, at least a 65 rank step, in personal order. */
function moreOfThis(person: Person, center: Vec, order: OrderTitles) {
	const direction = new Float64Array(K).map(
		(_, k) => 0.45 * center[k] + 0.55 * person.signature[k],
	)
	const ranked = rankUnseen(person, direction, 0.8)
	const steps = person.rankSteps(ranked.map((t) => t.key))
	const everywhere: TitleKey[] = []
	const onServices: TitleKey[] = []
	for (const t of ranked) {
		if (
			everywhere.length >= MORE_OF_THIS_POOL &&
			(onServices.length >= MORE_OF_THIS_POOL || !person.input.services.length)
		)
			break
		if (!passes(steps.get(t.key), MORE_OF_THIS_STEP)) continue
		if (everywhere.length < MORE_OF_THIS_POOL) everywhere.push(t.key)
		if (onServices.length < MORE_OF_THIS_POOL && person.onMyServices(t.key))
			onServices.push(t.key)
	}
	const first = order(everywhere).slice(0, MORE_OF_THIS)
	const firstOnServices = order(onServices).slice(0, MORE_OF_THIS)
	return order([...new Set([...first, ...firstOnServices])])
}

// ---------- edges ----------

type Edge = SideEdge & { strength: number }
type SideDraft = {
	id: string
	name: string
	center: Vec
	members: RatedTitle[]
}

const ratedKeys = (items: RatedTitle[]) =>
	items
		.filter((r) => r.facts.hasPoster)
		.sort((a, b) => b.score - a.score || a.key - b.key)
		.slice(0, 4)
		.map((r) => r.key)

const imageOf = (titles: PoolTitle[]) =>
	titles.find((t) => t.facts.hasBackdrop)?.key ?? null

const titles = (n: number) => `${n} ${n === 1 ? "title" : "titles"}`

interface Place {
	kind: "country" | "language" | "decade" | "format" | "animation"
	id: string
	/** "From South Korea". */
	name: string
	/** "from South Korea", after the side's name. */
	tail: string
	has: (facts: RatedTitle["facts"]) => boolean
}

function placesOf(facts: RatedTitle["facts"]): Place[] {
	const places: Place[] = []
	const origin = facts.origin
	if (origin && /^[A-Z]{2}$/.test(origin) && !EXCLUDED_COUNTRIES.has(origin)) {
		const region = displayName(regionNames, origin)
		const place = WITH_THE.has(origin) ? `the ${region}` : region
		places.push({
			kind: "country",
			id: origin,
			name: `From ${place}`,
			tail: `from ${place}`,
			has: (f) => f.origin === origin,
		})
	} else if (origin && /^[a-z]{2}$/.test(origin) && origin !== "en") {
		const language =
			LANGUAGE_NAMES[origin] ?? displayName(languageNames, origin)
		places.push({
			kind: "language",
			id: origin,
			name: `In ${language}`,
			tail: `in ${language}`,
			has: (f) => f.origin === origin,
		})
	}
	const year = yearOf(facts)
	if (year !== null) {
		const decade = Math.floor(year / 10) * 10
		places.push({
			kind: "decade",
			id: String(decade),
			name: `From the ${decade}s`,
			tail: `from the ${decade}s`,
			has: (f) => {
				const y = yearOf(f)
				return y !== null && y >= decade && y < decade + 10
			},
		})
	}
	const show = facts.mediaType === "show"
	places.push({
		kind: "format",
		id: facts.mediaType,
		name: show ? "As a show" : "As a film",
		tail: show ? "as a show" : "as a film",
		has: (f) => f.mediaType === facts.mediaType,
	})
	const animated = (f: RatedTitle["facts"]) =>
		f.anime || f.genres.includes("Animation")
	if (animated(facts))
		places.push({
			kind: "animation",
			id: "animated",
			name: "Animated",
			tail: "animated",
			has: animated,
		})
	return places
}

/** The first suggestions of ranked titles that pass the edge's rank step; null when too few. */
function edgeSuggestions(person: Person, ranked: PoolTitle[]) {
	const steps = person.rankSteps(ranked.map((t) => t.key))
	const suggestions = ranked
		.filter((t) => passes(steps.get(t.key), EDGE_STEP))
		.slice(0, EDGE_SUGGESTIONS)
	return suggestions.length >= EDGE_MIN_SUGGESTIONS ? suggestions : null
}

/**
 * Places common right next to the side in the catalog that the person has barely rated there, and never ones they rate
 * below their usual: at most three, one per kind. "There" is the person's rated titles closest to this side.
 */
function placeEdges(
	person: Person,
	side: SideDraft,
	centers: Vec[],
	index: number,
): Edge[] {
	const near = person.rated.filter((r) => {
		const n = nearest(r.z, centers)
		return n.index === index && n.similarity > 0.1
	})
	const pool = rankUnseen(person, side.center, 0.4, (t) => {
		const n = nearest(t.z, centers)
		return n.index === index && n.similarity > 0.3
	}).slice(0, 700)
	if (pool.length < 40) return []
	const counted = new Map<string, { place: Place; there: PoolTitle[] }>()
	for (const t of pool)
		for (const place of placesOf(t.facts)) {
			const id = `${place.kind}-${place.id}`
			const entry = counted.get(id) ?? { place, there: [] }
			entry.there.push(t)
			counted.set(id, entry)
		}
	const edges: Edge[] = []
	for (const [id, { place, there }] of counted) {
		const shareHere = there.length / pool.length
		if (there.length < 10 || shareHere < 0.025) continue
		const rated = near.filter((r) => place.has(r.facts))
		const shareRated = near.length ? rated.length / near.length : 0
		// Barely tried: a third or less of how common it is next to the side, and only a handful.
		if (
			shareRated > shareHere / 3 ||
			rated.length > Math.max(3, near.length * 0.05)
		)
			continue
		const avg = rated.length ? average(rated.map((r) => r.score)) : null
		if (avg !== null && avg < person.mu) continue
		const suggestions = edgeSuggestions(person, there.slice(0, 16))
		if (!suggestions) continue
		edges.push({
			id: `${side.id}-${id}`,
			kind: place.kind,
			name: place.name,
			tail: place.tail,
			toward: null,
			why:
				avg === null
					? "Common right next to this side, and you haven't rated any of it yet."
					: `You've rated ${titles(rated.length)} like this, ${round1(avg)} on average. Usually you give ${round1(person.mu)}.`,
			average: avg === null ? null : round1(avg),
			count: rated.length,
			rated: ratedKeys(rated),
			suggestions: suggestions.map((t) => t.key),
			image: imageOf(suggestions),
			strength:
				shareHere - shareRated + (avg === null ? 0 : (avg - person.mu) * 0.03),
		})
	}
	const chosen: Edge[] = []
	const kinds = new Set<string>()
	for (const edge of edges.sort(
		(a, b) => b.strength - a.strength || a.id.localeCompare(b.id),
	)) {
		if (chosen.length >= 3) break
		if (kinds.has(edge.kind)) continue
		const shared = (other: Edge) =>
			other.suggestions.filter((key) => edge.suggestions.includes(key)).length
		if (chosen.some((other) => shared(other) >= 3)) continue
		kinds.add(edge.kind)
		chosen.push(edge)
	}
	return chosen
}

/**
 * Steps: the side plus an attribute the person rates above their usual near this side, though few of the side's own
 * titles carry it. A step taken by one side is not offered to another (`taken`).
 */
function stepEdges(
	person: Person,
	side: SideDraft,
	centers: Vec[],
	index: number,
	wanted: number,
	taken: Set<string>,
): Edge[] {
	if (wanted <= 0) return []
	const steps = NON_CRAFT.flatMap((k) => {
		const key = KEYS[k]
		if (UNNAMED.has(key) || taken.has(key)) return []
		const carriers = side.members.filter((m) => m.z[k] > STRONG_Z).length
		const inSide = carriers / side.members.length
		if (inSide > 0.12 || side.center[k] > 0.3) return []
		const hit = person.rated.filter(
			(r) => r.z[k] > STRONG_Z && nearest(r.z, centers).index === index,
		)
		if (hit.length < 2) return []
		const avg = average(hit.map((r) => r.score))
		if (avg - person.mu < 0.2) return []
		const direction = new Float64Array(side.center).map((x, d) =>
			d === k ? x + 1.5 : x,
		)
		const suggestions = edgeSuggestions(
			person,
			rankUnseen(
				person,
				direction,
				0.4,
				(t) => t.z[k] > STRONG_Z && nearest(t.z, centers).index === index,
			).slice(0, 14),
		)
		if (!suggestions) return []
		return [
			{
				key,
				avg,
				carriers,
				inSide,
				hit,
				suggestions,
				strength: (avg - person.mu) * (1 - inSide),
			},
		]
	})
		.sort((a, b) => b.strength - a.strength || a.key.localeCompare(b.key))
		.slice(0, wanted)
	for (const step of steps) taken.add(step.key)
	return steps.map((step) => {
		const word = adjective(step.key)
		const share = Math.round(step.inSide * 100)
		return {
			id: `${side.id}-step-${step.key}`,
			kind: "step" as const,
			name: `+ ${capitalize(word)}`,
			tail: `but ${word}`,
			toward: null,
			why: `Near this side, you rate ${word} titles ${round1(step.avg)} on average (usually ${round1(person.mu)}), yet ${step.carriers === 0 ? "none" : share < 1 ? "less than 1%" : `only ${share}%`} of this side ${share === 1 ? "is" : "are"}.`,
			average: round1(step.avg),
			count: step.hit.length,
			rated: ratedKeys(step.hit),
			suggestions: step.suggestions.map((t) => t.key),
			image: imageOf(step.suggestions),
			strength: step.strength,
		}
	})
}

/** The way toward the closest other side: unseen titles about as close to both. One per pair of sides. */
function bridgeEdge(
	person: Person,
	sides: SideDraft[],
	index: number,
	bridged: Set<string>,
): Edge | null {
	const side = sides[index]
	const other = sides
		.filter((_, i) => i !== index)
		.sort(
			(a, b) =>
				cosine(b.center, side.center) - cosine(a.center, side.center) ||
				a.id.localeCompare(b.id),
		)[0]
	if (!other) return null
	const pair = [side.id, other.id].sort().join("|")
	if (bridged.has(pair)) return null
	const between = (z: ArrayLike<number>) => {
		const a = cosine(z, side.center)
		const b = cosine(z, other.center)
		return a > 0.2 && b > 0.2 && Math.abs(a - b) < 0.12
	}
	const middle = new Float64Array(K).map(
		(_, d) => 0.5 * side.center[d] + 0.5 * other.center[d],
	)
	const suggestions = edgeSuggestions(
		person,
		rankUnseen(person, middle, 0.4, (t) => between(t.z)).slice(0, 14),
	)
	if (!suggestions) return null
	const rated = person.rated.filter((r) => between(r.z))
	const avg = rated.length ? average(rated.map((r) => r.score)) : null
	if (avg !== null && avg < person.mu) return null
	bridged.add(pair)
	return {
		id: `${side.id}-toward-${other.id}`,
		kind: "bridge",
		name: `Toward ${other.name.toLowerCase()}`,
		tail: null,
		toward: other.id,
		why:
			avg === null
				? "Titles right between these two sides. You haven't rated any yet."
				: `You've rated ${titles(rated.length)} between these two sides, ${round1(avg)} on average. Usually you give ${round1(person.mu)}.`,
		average: avg === null ? null : round1(avg),
		count: rated.length,
		rated: ratedKeys(rated),
		suggestions: suggestions.map((t) => t.key),
		image: imageOf(suggestions),
		strength: 0,
	}
}

// ---------- the view ----------

export function buildSides(
	person: Person,
	order: OrderTitles = (keys) => keys,
): SidesResult {
	const empty: SidesResult = {
		tab: "sides",
		status: "empty",
		sides: [],
		headline: null,
		openFirst: null,
		hasServices: person.input.services.length > 0,
	}
	const loved = lovedTitles(person)
	const n = loved.length
	if (n < 5) return empty
	const groups = group(loved, person)
	if (groups.length < 2) return empty

	const groupCenters = groups.map((g) => g.center)
	const taken = new Set<string>()
	// Each side keeps the titles its name describes; a side no name describes two titles of goes.
	const named = groups.flatMap((g, i) => {
		const side = nameSide(
			standout(
				g.center,
				groupCenters.filter((_, j) => j !== i),
			),
			g.members,
			taken,
		)
		return side ? [{ ...side, center: g.center }] : []
	})
	if (named.length < 2) return empty
	named.sort(
		(a, b) =>
			b.members.length - a.members.length || a.name.localeCompare(b.name),
	)
	const drafts: SideDraft[] = named.map((g, i) => ({
		id: `side-${i + 1}`,
		...g,
	}))
	const centers = drafts.map((d) => d.center)

	const stepsTaken = new Set<string>()
	const bridged = new Set<string>()
	const sides = drafts.map((draft, i): Side => {
		const places = placeEdges(person, draft, centers, i)
		const steps = stepEdges(
			person,
			draft,
			centers,
			i,
			2 - places.length,
			stepsTaken,
		)
		const bridge = bridgeEdge(person, drafts, i, bridged)
		const edges = [...places, ...steps, ...(bridge ? [bridge] : [])].map(
			({ strength, ...edge }) => ({
				...edge,
				suggestions: order(edge.suggestions),
			}),
		)
		const here = typical(draft.members, draft.center, person.mu)
		const attributes = standout(
			draft.center,
			centers.filter((_, j) => j !== i),
		)
			.slice(0, 4)
			.map((a) => ({ key: a.key, label: label(a.key) }))
		const high = here.filter((r) => r.score >= 7)
		return {
			id: draft.id,
			name: draft.name,
			attributes,
			share: Math.round((draft.members.length / n) * 1000) / 1000,
			count: draft.members.length,
			average: round1(average(draft.members.map((r) => r.score))),
			here: (high.length >= 2 ? high : here).slice(0, HERE).map((r) => r.key),
			image:
				here.find((r) => r.facts.hasBackdrop)?.key ??
				draft.members.find((r) => r.facts.hasBackdrop)?.key ??
				null,
			moods: sideMoods(draft.members),
			edges,
			moreOfThis: moreOfThis(person, draft.center, order),
		}
	})

	// The headline: the two sides whose centers are least alike.
	let headline: SidesResult["headline"] = null
	let least = Number.POSITIVE_INFINITY
	drafts.forEach((a, i) =>
		drafts.forEach((b, j) => {
			if (i >= j) return
			const similarity = cosine(a.center, b.center)
			if (similarity < least) {
				least = similarity
				headline = { first: a.id, second: b.id }
			}
		}),
	)

	return {
		...empty,
		status: "ready",
		sides,
		headline,
		openFirst: sides[0].id,
	}
}
