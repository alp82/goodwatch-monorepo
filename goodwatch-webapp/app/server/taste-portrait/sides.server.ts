// Sides of you: clusters of what the person loves, each named from the word table, with the place just past it they've
// barely tried but rate above their usual (its edges), and More of this.
import type { TitleKey } from "~/server/title-snapshot/index.server"
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

type SidesResult = Omit<SidesView, "titles" | "subject">

const MORE_OF_THIS = 12
const MORE_OF_THIS_MATCH = 65
const EDGE_MATCH = 56
const EDGE_SUGGESTIONS = 8
const EDGE_MIN_SUGGESTIONS = 4
const MAX_EDGES = 6
const MAX_EDGES_PER_KIND = 2
// Titles above z 1.2 on an attribute carry it strongly, for the "rarely picked" attributes.
const STRONG_Z = 1.2
const EXCLUDED_COUNTRIES = new Set(["US", "GB"])
// Region names that read with "the": "You've barely been to the Netherlands".
const WITH_THE = new Set(["NL", "PH", "AE", "DO", "BS", "GM", "CD", "CF", "CZ"])
const LANGUAGE_NAMES: Record<string, string> = { cn: "Cantonese" }

const regionNames = new Intl.DisplayNames(["en"], { type: "region" })
const languageNames = new Intl.DisplayNames(["en"], { type: "language" })
const displayName = (names: Intl.DisplayNames, code: string) => {
	try {
		return names.of(code) ?? code
	} catch {
		return code
	}
}

/** Loved titles: rated at least max(8, round(usual + 0.6 spread)), or all rated at least the usual when fewer than 6. */
export function lovedTitles(person: Person): RatedTitle[] {
	const cut = Math.max(8, Math.round(person.mu + 0.6 * person.sigma))
	const loved = person.rated.filter((r) => r.score >= cut)
	return loved.length >= 6
		? loved
		: person.rated.filter((r) => r.score >= person.mu)
}

interface Cluster {
	center: Float64Array
	members: RatedTitle[]
}

/** k-means by cosine over the non-craft attributes, 20 iterations, seeded farthest-first from the title closest to the
 * person's signature. */
function clusters(points: RatedTitle[], k: number, seed: Float64Array) {
	const start = [...points].sort(
		(a, b) => cosine(b.z, seed) - cosine(a.z, seed) || a.key - b.key,
	)[0]
	const centers: Float64Array[] = [start.z]
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
	for (let iteration = 0; iteration < 20; iteration++) {
		assigned = points.map((p) => {
			let bestIndex = 0
			let bestSimilarity = Number.NEGATIVE_INFINITY
			centers.forEach((c, i) => {
				const similarity = cosine(p.z, c)
				if (similarity > bestSimilarity) {
					bestSimilarity = similarity
					bestIndex = i
				}
			})
			return bestIndex
		})
		for (let i = 0; i < centers.length; i++) {
			const members = points.filter((_, j) => assigned[j] === i)
			if (members.length) centers[i] = meanOf(members.map((m) => m.z))
		}
	}
	return centers.map(
		(center, i): Cluster => ({
			center,
			members: points.filter((_, j) => assigned[j] === i),
		}),
	)
}

// Without taste there is no match to hold suggestions to, so every suggestion passes.
const passes = (match: number | null | undefined, least: number) =>
	match === null || match === undefined || match >= least

// ---------- edges: just past it ----------

interface EdgeCandidate extends SideEdge {
	strength: number
	/** Genre profile of what's rated and suggested there. */
	genres: Map<string, number>
}

function genreProfile(person: Person, keys: TitleKey[]) {
	const profile = new Map<string, number>()
	for (const key of keys)
		for (const genre of person.snapshot.facts(key)?.genres ?? [])
			profile.set(genre, (profile.get(genre) ?? 0) + 1)
	return profile
}

function genreCosine(a: Map<string, number>, b: Map<string, number>) {
	let dot = 0
	let na = 0
	let nb = 0
	for (const [genre, x] of a) {
		dot += x * (b.get(genre) ?? 0)
		na += x * x
	}
	for (const x of b.values()) nb += x * x
	return na && nb ? dot / Math.sqrt(na * nb) : 0
}

function edgeCandidates(person: Person): EdgeCandidate[] {
	const { rated, mu } = person
	const candidates: EdgeCandidate[] = []
	const add = (
		kind: SideEdge["kind"],
		id: string,
		names: { name: string; lead: string; place: string },
		items: RatedTitle[],
		keep: (t: PoolTitle) => boolean,
	) => {
		// Each edge needs a few titles to go to: unseen ones from there, close to the person, with a good match.
		const ranked = rankUnseen(person, person.signature, 0.4, keep).slice(0, 10)
		const matches = person.match(ranked.map((t) => t.key))
		const suggestions = ranked
			.filter((t) => passes(matches.get(t.key), EDGE_MATCH))
			.slice(0, EDGE_SUGGESTIONS)
		if (suggestions.length < EDGE_MIN_SUGGESTIONS) return
		const itemsAverage = average(items.map((r) => r.score))
		const top = suggestions.slice(0, 4).map((t) => matches.get(t.key) ?? 0)
		const ratedKeys = items.map((r) => r.key)
		const suggestionKeys = suggestions.map((t) => t.key)
		candidates.push({
			id: `${kind}-${id}`,
			kind,
			...names,
			average: round1(itemsAverage),
			count: items.length,
			rated: ratedKeys
				.filter((key) => person.ratedByKey.get(key)?.facts.hasPoster)
				.slice(0, 4),
			suggestions: suggestionKeys,
			image:
				suggestions.find((t) => t.facts.hasBackdrop)?.key ??
				items.find((r) => r.facts.hasBackdrop)?.key ??
				null,
			strength:
				(itemsAverage - mu) * Math.sqrt(Math.max(1, items.length)) +
				average(top) / 40,
			genres: genreProfile(person, [...ratedKeys, ...suggestionKeys]),
		})
	}

	const groups = (keyOf: (r: RatedTitle) => string | null) => {
		const map = new Map<string, RatedTitle[]>()
		for (const r of rated) {
			const key = keyOf(r)
			if (key !== null) map.set(key, [...(map.get(key) ?? []), r])
		}
		return map
	}
	// Barely tried: at least two rated titles there, and only a small share of all.
	const few = (n: number, share: number) =>
		n >= 2 && n <= Math.max(5, rated.length * share)
	const liftOf = (items: RatedTitle[]) =>
		average(items.map((r) => r.score)) - mu

	// Origins: the snapshot's origin is the first production country, else the original language.
	const origins = groups((r) => r.facts.origin)
	for (const [code, items] of origins) {
		if (/^[A-Z]{2}$/.test(code)) {
			if (EXCLUDED_COUNTRIES.has(code) || !few(items.length, 0.008)) continue
			if (liftOf(items) < 0.3) continue
			const name = displayName(regionNames, code)
			add(
				"country",
				code,
				{
					name,
					lead: "You've barely been to",
					place: WITH_THE.has(code) ? `the ${name}` : name,
				},
				items,
				(t) => t.facts.origin === code,
			)
		} else if (/^[a-z]{2}$/.test(code) && code !== "en") {
			if (!few(items.length, 0.012) || liftOf(items) < 0.2) continue
			const name = LANGUAGE_NAMES[code] ?? displayName(languageNames, code)
			add(
				"language",
				code,
				{ name, lead: "You rarely watch in", place: name },
				items,
				(t) => t.facts.origin === code,
			)
		}
	}

	// Attributes they rarely choose, but rate above their usual when they do.
	NON_CRAFT.map((k) => {
		const hit = rated.filter((r) => r.z[k] > STRONG_Z)
		return { k, hit, selection: person.selection[k], lift: liftOf(hit) }
	})
		.filter((a) => a.selection < 0.05 && a.hit.length >= 2 && a.lift > 0.15)
		.sort((a, b) => b.lift - b.selection - (a.lift - a.selection))
		.slice(0, 4)
		.forEach((a) => {
			const key = KEYS[a.k]
			add(
				"attribute",
				key,
				{
					name: capitalize(noun(key)),
					lead: "You rarely pick",
					place: noun(key),
				},
				a.hit,
				(t) => t.z[a.k] > STRONG_Z,
			)
		})

	const decades = groups((r) => {
		const year = yearOf(r.facts)
		return year === null ? null : String(Math.floor(year / 10) * 10)
	})
	for (const [decade, items] of decades) {
		if (items.length < 2 || items.length > Math.max(6, rated.length * 0.01))
			continue
		if (liftOf(items) < 0.3) continue
		const from = Number(decade)
		add(
			"decade",
			decade,
			{
				name: `The ${decade}s`,
				lead: "You rarely go back to",
				place: `the ${decade}s`,
			},
			items,
			(t) => {
				const year = yearOf(t.facts)
				return year !== null && year >= from && year < from + 10
			},
		)
	}

	// Keep it varied: strongest first, at most two of a kind and six in all, none sharing three suggestions with one
	// already chosen.
	const chosen: EdgeCandidate[] = []
	const perKind = new Map<string, number>()
	for (const c of candidates.sort(
		(a, b) => b.strength - a.strength || a.id.localeCompare(b.id),
	)) {
		if (chosen.length >= MAX_EDGES) break
		if ((perKind.get(c.kind) ?? 0) >= MAX_EDGES_PER_KIND) continue
		const shared = (other: EdgeCandidate) =>
			other.suggestions.filter((key) => c.suggestions.includes(key)).length
		if (chosen.some((other) => shared(other) >= 3)) continue
		perKind.set(c.kind, (perKind.get(c.kind) ?? 0) + 1)
		chosen.push(c)
	}
	return chosen
}

// ---------- the view ----------

export function buildSides(person: Person): SidesResult {
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
	const k = Math.min(n >= 60 ? 4 : 3, Math.floor(n / 2.5))
	if (k < 2) return empty
	const minMembers = n >= 30 ? 3 : 2
	const found = clusters(loved, k, person.signature).filter(
		(c) => c.members.length >= minMembers,
	)
	if (found.length < 2) return empty

	const lovedMean = meanOf(loved.map((r) => r.z))
	const names = new Set<string>()
	const sides = found
		.map((cluster) => {
			// What sets the side apart from the rest of what they love.
			const distinct = NON_CRAFT.map((k) => ({
				key: KEYS[k],
				weight: cluster.center[k] - 0.5 * lovedMean[k],
			})).sort((a, b) => b.weight - a.weight)
			let name = `${capitalize(adjective(distinct[1].key))} ${noun(distinct[0].key)}`
			if (names.has(name))
				name = `${capitalize(adjective(distinct[2].key))} ${noun(distinct[0].key)}`
			names.add(name)
			const members = [...cluster.members].sort(
				(a, b) =>
					b.score - a.score ||
					cosine(b.z, cluster.center) - cosine(a.z, cluster.center) ||
					a.key - b.key,
			)
			const high = members.filter((r) => r.score >= 7)
			const shown = (high.length >= 2 ? high : members).filter(
				(r) => r.facts.hasPoster,
			)
			// More of this: toward the side, and toward the person's taste as a whole.
			const direction = new Float64Array(K).map(
				(_, k) => 0.45 * cluster.center[k] + 0.55 * person.signature[k],
			)
			const ranked = rankUnseen(person, direction, 0.8)
			const matches = person.match(ranked.map((t) => t.key))
			const everywhere: TitleKey[] = []
			const onServices: TitleKey[] = []
			for (const t of ranked) {
				if (
					everywhere.length >= MORE_OF_THIS &&
					onServices.length >= MORE_OF_THIS
				)
					break
				if (!passes(matches.get(t.key), MORE_OF_THIS_MATCH)) continue
				if (everywhere.length < MORE_OF_THIS) everywhere.push(t.key)
				if (onServices.length < MORE_OF_THIS && person.onMyServices(t.key))
					onServices.push(t.key)
				if (!person.input.services.length && everywhere.length >= MORE_OF_THIS)
					break
			}
			const moreOfThis = ranked
				.map((t) => t.key)
				.filter((key) => everywhere.includes(key) || onServices.includes(key))
			return {
				id: "",
				name,
				attributes: distinct
					.slice(0, 4)
					.map((d) => ({ key: d.key, label: label(d.key) })),
				share: Math.round((cluster.members.length / n) * 1000) / 1000,
				average: round1(average(cluster.members.map((r) => r.score))),
				here: shown.slice(0, 4).map((r) => r.key),
				image: members.find((r) => r.facts.hasBackdrop)?.key ?? null,
				edges: [] as SideEdge[],
				moreOfThis,
				center: cluster.center,
				genreKeys: [...members.slice(0, 10).map((r) => r.key), ...everywhere],
			}
		})
		.sort((a, b) => b.share - a.share || a.name.localeCompare(b.name))
	sides.forEach((side, i) => {
		side.id = `side-${i + 1}`
	})

	// Every side first claims its closest unclaimed edge by genre profile; the rest go to their closest side.
	const edges = edgeCandidates(person)
	const sideGenres = sides.map((s) => genreProfile(person, s.genreKeys))
	const owner = new Map<number, number>()
	sides.forEach((_, si) => {
		let best = -1
		let bestSimilarity = -1
		edges.forEach((edge, ei) => {
			if (owner.has(ei)) return
			const similarity = genreCosine(sideGenres[si], edge.genres)
			if (similarity > bestSimilarity) {
				best = ei
				bestSimilarity = similarity
			}
		})
		if (best >= 0) owner.set(best, si)
	})
	edges.forEach((edge, ei) => {
		if (owner.has(ei)) return
		let best = 0
		sideGenres.forEach((genres, si) => {
			if (
				genreCosine(genres, edge.genres) >
				genreCosine(sideGenres[best], edge.genres)
			)
				best = si
		})
		owner.set(ei, best)
	})
	sides.forEach((side, si) => {
		side.edges = edges
			.filter((_, ei) => owner.get(ei) === si)
			.sort(
				(a, b) =>
					genreCosine(sideGenres[si], b.genres) -
					genreCosine(sideGenres[si], a.genres),
			)
			.map(({ strength, genres, ...edge }) => edge)
	})

	// The headline: the two sides whose centers are least alike.
	let headline: SidesResult["headline"] = null
	let least = Number.POSITIVE_INFINITY
	for (const a of sides)
		for (const b of sides) {
			if (a === b) continue
			const similarity = cosine(a.center, b.center)
			if (similarity < least) {
				least = similarity
				headline = { first: a.id, second: b.id }
			}
		}

	const openFirst = [...sides].sort((a, b) => b.average - a.average)[0].id
	return {
		...empty,
		status: "ready",
		sides: sides.map(({ center, genreKeys, ...side }): Side => side),
		headline,
		openFirst,
	}
}
