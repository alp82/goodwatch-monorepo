// Groupings split the Explorer's pool into islands. A layout is one grouping's islands over the whole pool, before
// the viewer's filters: which islands each title sits on, each island's titles best first, where the islands sit
// (similar islands close together), and what sets each one apart. Layouts that aren't personal are built once per
// snapshot version and kept for 6 hours; Streaming is built per country and set of services; Taste distance per
// request.
import { type Grouping, MAX_ISLANDS } from "~/domain/explorer"
import { MOOD_KEYS, type MoodKey } from "~/domain/moods"
import {
	DESCRIPTIVE_KEYS,
	DIMENSIONS as D,
	type ExplorerPool,
} from "./pool.server"
import { phraseOf, sentence } from "./words.server"

export interface IslandDef {
	id: string
	name: string
	color: string
}

export interface Layout {
	grouping: Grouping
	islands: IslandDef[]
	/** Titles can sit on several islands (Genre, Mood, Streaming). */
	multi: boolean
	/** Per pool title, bit j set when it sits on island j. */
	mask: Uint16Array
	/** Per island, its pool titles, best quality first. */
	members: Int32Array[]
	/** Per island, the unit-length mean of its titles' unit vectors, for "between" bridges and pairs. */
	centers: Float64Array[]
	x: number[]
	y: number[]
	apart: string[]
}

const MIN_ISLAND = 3
const KEEP_MS = 6 * 60 * 60 * 1000
const MAX_KEPT = 200

// Genre buckets and the TMDB genres each takes in. A title sits on every bucket one of its genres belongs to.
const GENRES: (IslandDef & { from: string[] })[] = [
	{ id: "animation", name: "Animation", color: "#e38fb8", from: ["Animation"] },
	{
		id: "documentary",
		name: "Documentary and reality",
		color: "#9aa3ad",
		from: ["Documentary", "Reality", "Talk", "News"],
	},
	{ id: "horror", name: "Horror", color: "#7fae3a", from: ["Horror"] },
	{
		id: "scifi",
		name: "Science fiction",
		color: "#3fc1b0",
		from: ["Science Fiction", "Sci-Fi & Fantasy"],
	},
	{
		id: "fantasy",
		name: "Fantasy",
		color: "#9b7bea",
		from: ["Fantasy", "Sci-Fi & Fantasy"],
	},
	{
		id: "war",
		name: "War and history",
		color: "#9a9460",
		from: ["War", "History", "War & Politics", "Western"],
	},
	{ id: "crime", name: "Crime", color: "#c2413a", from: ["Crime"] },
	{
		id: "thriller",
		name: "Mystery and thriller",
		color: "#5b7fa8",
		from: ["Mystery", "Thriller"],
	},
	{ id: "romance", name: "Romance", color: "#e0607e", from: ["Romance"] },
	{ id: "family", name: "Family", color: "#7cc4e8", from: ["Family", "Kids"] },
	{
		id: "action",
		name: "Action and adventure",
		color: "#e8793d",
		from: ["Action", "Adventure", "Action & Adventure"],
	},
	{ id: "comedy", name: "Comedy", color: "#e2cf55", from: ["Comedy"] },
	{
		id: "drama",
		name: "Drama",
		color: "#b98a5a",
		from: ["Drama", "Soap", "Music", "TV Movie"],
	},
]

// The 11 moods of the moods module, the same rules as Watch next. Names and colors live with the pages that show them.
const MOODS: Record<MoodKey, { name: string; color: string }> = {
	funny: { name: "Funny", color: "#e2cf55" },
	feelgood: { name: "Feel-good", color: "#8ccf4d" },
	romance: { name: "Romance", color: "#e0607e" },
	action: { name: "Action", color: "#e8793d" },
	scary: { name: "Scary", color: "#7fae3a" },
	crime: { name: "Crime & mystery", color: "#c2413a" },
	mind: { name: "Mind-bending", color: "#9b7bea" },
	heavy: { name: "Heavy", color: "#5b7fa8" },
	worlds: { name: "Other worlds", color: "#3fc1b0" },
	history: { name: "History", color: "#9a9460" },
	growing: { name: "Coming of age", color: "#7cc4e8" },
}

const DECADES: (IslandDef & { from: number; to: number })[] = [
	{
		id: "before-1970",
		name: "Before 1970",
		color: "#9c7a52",
		from: 1,
		to: 1969,
	},
	{ id: "1970s", name: "1970s", color: "#c0703c", from: 1970, to: 1979 },
	{ id: "1980s", name: "1980s", color: "#d4508a", from: 1980, to: 1989 },
	{ id: "1990s", name: "1990s", color: "#8e62d6", from: 1990, to: 1999 },
	{ id: "2000s", name: "2000s", color: "#4f86d9", from: 2000, to: 2009 },
	{ id: "2010s", name: "2010s", color: "#37b3a4", from: 2010, to: 2019 },
	{ id: "2020s", name: "2020s", color: "#8ccf4d", from: 2020, to: 9999 },
]

// Taste distance: bands of the viewer's match.
export const TASTE_BANDS: (IslandDef & { min: number })[] = [
	{ id: "near", name: "Near you", color: "#f5a524", min: 90 },
	{ id: "close", name: "Close by", color: "#c9a04e", min: 80 },
	{ id: "edges", name: "The edges", color: "#7d8fa3", min: 65 },
	{ id: "far", name: "Unexplored", color: "#6a5aa8", min: 0 },
]

/** Colors for islands without a color of their own (countries, services), in order. */
const PALETTE = [
	"#5b7fa8",
	"#c2413a",
	"#3fc1b0",
	"#9b7bea",
	"#e8793d",
	"#7fae3a",
	"#b98a5a",
	"#7cc4e8",
	"#e0607e",
	"#e2cf55",
	"#d4508a",
	"#e9a23b",
	"#8e62d6",
]
const REST_COLOR = "#9aa3ad"
const MIN_COUNTRY = 50
export const REST_OF_WORLD = "rest"
export const RENT_OR_BUY = "rent"

// ---------------------------------------------------------------- building a layout

/**
 * A layout from island definitions and, per pool title, the bit mask of the islands it sits on (bit j is defs[j]).
 * Islands with fewer than 3 titles are dropped, then the largest MAX_ISLANDS are kept.
 */
export function buildLayout(
	pool: ExplorerPool,
	grouping: Grouping,
	defs: IslandDef[],
	maskOf: (i: number) => number,
	multi: boolean,
): Layout {
	const n = pool.n
	const raw = new Uint32Array(n)
	const sizes = new Array<number>(defs.length).fill(0)
	for (let i = 0; i < n; i++) {
		const m = maskOf(i)
		raw[i] = m
		for (let j = 0; j < defs.length; j++) if (m & (1 << j)) sizes[j]++
	}
	const kept = defs
		.map((_, j) => j)
		.filter((j) => sizes[j] >= MIN_ISLAND)
		.sort((a, b) => sizes[b] - sizes[a] || a - b)
		.slice(0, MAX_ISLANDS)
		.sort((a, b) => a - b)
	const islands = kept.map((j) => defs[j])
	const mask = new Uint16Array(n)
	const lists: number[][] = kept.map(() => [])
	for (let i = 0; i < n; i++) {
		let m = 0
		kept.forEach((j, at) => {
			if (raw[i] & (1 << j)) {
				m |= 1 << at
				lists[at].push(i)
			}
		})
		mask[i] = m
	}
	const members = lists.map((list) =>
		Int32Array.from(
			list.sort((a, b) => pool.quality[b] - pool.quality[a] || a - b),
		),
	)

	// Island means: of the z-scores for where islands sit and what sets them apart, of the unit vectors for closeness.
	const means = members.map((list) => {
		const v = new Float64Array(D)
		for (const i of list) for (let d = 0; d < D; d++) v[d] += pool.z[i * D + d]
		for (let d = 0; d < D; d++) v[d] /= Math.max(1, list.length)
		return v
	})
	const centers = members.map((list) => {
		const v = new Float64Array(D)
		for (const i of list)
			for (let d = 0; d < D; d++) v[d] += pool.unit[i * D + d]
		return normalize(v)
	})
	const positions = pca2(means)
	return {
		grouping,
		islands,
		multi,
		mask,
		members,
		centers,
		x: positions.map((p) => round3(p[0])),
		y: positions.map((p) => round3(p[1])),
		apart: apartLines(means),
	}
}

const round3 = (v: number) => Math.round(v * 1000) / 1000

function normalize(v: Float64Array): Float64Array {
	let squares = 0
	for (let d = 0; d < v.length; d++) squares += v[d] * v[d]
	const length = Math.sqrt(squares) || 1
	for (let d = 0; d < v.length; d++) v[d] /= length
	return v
}

/** What sets each island apart: the two attributes its mean exceeds the average island's mean by most. */
function apartLines(means: Float64Array[]): string[] {
	const average = new Float64Array(D)
	for (const v of means)
		for (let d = 0; d < D; d++) average[d] += v[d] / Math.max(1, means.length)
	return means.map((v) =>
		sentence(
			DESCRIPTIVE_KEYS.map((key, d) => ({ key, lead: v[d] - average[d] }))
				.sort((a, b) => b.lead - a.lead)
				.slice(0, 2)
				.map((r) => phraseOf(r.key)),
		),
	)
}

/** The top two principal components of the island means, scaled to -1..1, so similar islands sit close together. */
export function pca2(rows: Float64Array[]): [number, number][] {
	const m = rows.length
	if (m === 0) return []
	if (m < 3) return rows.map((_, j) => [m === 1 ? 0 : j ? 0.6 : -0.6, 0])
	const mu = new Float64Array(D)
	for (const r of rows) for (let d = 0; d < D; d++) mu[d] += r[d] / m
	const X = rows.map((r) => r.map((v, d) => v - mu[d]))
	const components: Float64Array[] = []
	for (let c = 0; c < 2; c++) {
		// Power iteration from a fixed start, so the same islands always land in the same places.
		let v: Float64Array = new Float64Array(D).map(
			(_, d) => Math.sin(d * 1.7 + c * 3.1) + 0.01,
		)
		for (let step = 0; step < 60; step++) {
			const next = new Float64Array(D)
			for (const x of X) {
				let s = 0
				for (let d = 0; d < D; d++) s += x[d] * v[d]
				for (let d = 0; d < D; d++) next[d] += s * x[d]
			}
			for (const p of components) {
				let s = 0
				for (let d = 0; d < D; d++) s += next[d] * p[d]
				for (let d = 0; d < D; d++) next[d] -= s * p[d]
			}
			v = normalize(next)
		}
		components.push(v)
	}
	const points = X.map((x) =>
		components.map((p) => {
			let s = 0
			for (let d = 0; d < D; d++) s += x[d] * p[d]
			return s
		}),
	) as [number, number][]
	const scale = Math.max(
		1e-6,
		...points.map(([a, b]) => Math.max(Math.abs(a), Math.abs(b))),
	)
	return points.map(([a, b]) => [a / scale, b / scale])
}

// ---------------------------------------------------------------- the groupings

function genreLayout(pool: ExplorerPool): Layout {
	const bucketsOf = new Map<string, number>()
	GENRES.forEach((g, j) => {
		for (const genre of g.from)
			bucketsOf.set(genre, (bucketsOf.get(genre) ?? 0) | (1 << j))
	})
	return buildLayout(
		pool,
		"genre",
		GENRES,
		(i) => {
			let m = 0
			for (const genre of pool.facts[i].genres) m |= bucketsOf.get(genre) ?? 0
			return m
		},
		true,
	)
}

function moodLayout(pool: ExplorerPool): Layout {
	const bit = new Map(MOOD_KEYS.map((key, j) => [key, 1 << j]))
	return buildLayout(
		pool,
		"mood",
		MOOD_KEYS.map((key) => ({ id: key, ...MOODS[key] })),
		(i) => {
			let m = 0
			for (const mood of pool.facts[i].moods) m |= bit.get(mood) ?? 0
			return m
		},
		true,
	)
}

function decadeLayout(pool: ExplorerPool): Layout {
	return buildLayout(
		pool,
		"decade",
		DECADES,
		(i) => {
			const year = pool.years[i]
			if (!year) return 0
			const j = DECADES.findIndex((d) => year >= d.from && year <= d.to)
			return j < 0 ? 0 : 1 << j
		},
		false,
	)
}

const regionNames = new Intl.DisplayNames(["en"], { type: "region" })
const isCountryCode = (origin: string | null): origin is string =>
	!!origin && /^[A-Z]{2}$/.test(origin)

function countryLayout(pool: ExplorerPool): Layout {
	// Origins are the first production country, else the original language; only countries get islands.
	const counts = new Map<string, number>()
	for (const facts of pool.facts)
		if (isCountryCode(facts.origin))
			counts.set(facts.origin, (counts.get(facts.origin) ?? 0) + 1)
	const countries = [...counts.entries()]
		.filter(([, count]) => count >= MIN_COUNTRY)
		.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
		.slice(0, MAX_ISLANDS - 1)
		.map(([code]) => code)
	const defs: IslandDef[] = [
		...countries.map((code, j) => ({
			id: code.toLowerCase(),
			name: regionNames.of(code) ?? code,
			color: PALETTE[j % PALETTE.length],
		})),
		{ id: REST_OF_WORLD, name: "Rest of world", color: REST_COLOR },
	]
	const at = new Map(countries.map((code, j) => [code, j]))
	return buildLayout(
		pool,
		"country",
		defs,
		(i) => 1 << (at.get(pool.facts[i].origin ?? "") ?? countries.length),
		false,
	)
}

/**
 * Streaming: an island per service of the viewer's that carries at least 3 pool titles in the country (the 13
 * largest), plus "Rent or buy" for titles on none of them. `servicesOf(i)` lists the services that carry pool title i.
 */
export function streamingLayout(
	pool: ExplorerPool,
	services: { id: number; name: string }[],
	servicesOf: (i: number) => readonly number[],
): Layout {
	const sizes = new Map<number, number>()
	for (let i = 0; i < pool.n; i++)
		for (const id of servicesOf(i)) sizes.set(id, (sizes.get(id) ?? 0) + 1)
	const chosen = services
		.filter((s) => (sizes.get(s.id) ?? 0) >= MIN_ISLAND)
		.sort(
			(a, b) => (sizes.get(b.id) ?? 0) - (sizes.get(a.id) ?? 0) || a.id - b.id,
		)
		.slice(0, MAX_ISLANDS - 1)
	const at = new Map(chosen.map((s, j) => [s.id, j]))
	const defs: IslandDef[] = [
		...chosen.map((s, j) => ({
			id: String(s.id),
			name: s.name,
			color: PALETTE[j % PALETTE.length],
		})),
		{ id: RENT_OR_BUY, name: "Rent or buy", color: "#57534e" },
	]
	return buildLayout(
		pool,
		"streaming",
		defs,
		(i) => {
			let m = 0
			for (const id of servicesOf(i)) {
				const j = at.get(id)
				if (j !== undefined) m |= 1 << j
			}
			return m || 1 << chosen.length
		},
		true,
	)
}

/** Taste distance: the viewer's match bands; `match[i]` is 0 for a title without a match. */
export function tasteLayout(pool: ExplorerPool, match: Uint8Array): Layout {
	return buildLayout(
		pool,
		"taste",
		TASTE_BANDS,
		(i) => {
			if (!match[i]) return 0
			return 1 << TASTE_BANDS.findIndex((band) => match[i] >= band.min)
		},
		false,
	)
}

// ---------------------------------------------------------------- the shared layouts

const kept = new Map<string, { at: number; layout: Layout }>()

/** A layout that's the same for everyone (Genre, Mood, Decade, Country), kept for 6 hours per snapshot version. */
export function sharedLayout(
	pool: ExplorerPool,
	grouping: "genre" | "mood" | "decade" | "country",
): Layout {
	return keep(`${pool.version}|${grouping}`, () => {
		if (grouping === "genre") return genreLayout(pool)
		if (grouping === "mood") return moodLayout(pool)
		if (grouping === "decade") return decadeLayout(pool)
		return countryLayout(pool)
	})
}

/** Keeps a layout for 6 hours under a key; the oldest go beyond MAX_KEPT. */
export function keep(key: string, build: () => Layout): Layout {
	const now = Date.now()
	const hit = kept.get(key)
	if (hit && now - hit.at < KEEP_MS) return hit.layout
	const layout = build()
	kept.delete(key)
	kept.set(key, { at: now, layout })
	for (const [k, entry] of kept) {
		if (kept.size <= MAX_KEPT && now - entry.at < KEEP_MS) break
		kept.delete(k)
	}
	return layout
}
