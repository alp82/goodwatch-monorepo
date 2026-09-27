// PROTOTYPE - throwaway. Data shapes, axes, and layouts for /prototype/rec-explorer (#180).
// Reuses the Taste prototype's PoolItem, Signal, and engine; this file adds a compact wire format for a
// ~2,500-title pool and the ways of placing titles in a 2D taste space.
import { FINGERPRINT_META } from "~/ui/fingerprint/fingerprintMeta"
import type { Engine } from "~/ui/prototype-rec-taste/engine"
import { CRAFT_KEYS, type PoolItem, type Service, type Signal, type TastePool } from "~/ui/prototype-rec-taste/model"
import { type Pt, type Vec, kmeans, pca, relax, spread } from "./math"

const TMDB = "https://image.tmdb.org/t/p"

/** One title on the wire. Fingerprint as 74 chars ('0' + score), services as ids in the person's country. */
export type Compact = {
	k: string // "movie-603"
	t: string
	y: number
	p: string // poster path
	b: string // backdrop path
	g: string[]
	s: number // GoodWatch score 0-100
	f: string
	a: number[]
	x?: 1 // outside the popular pool: the person's own rated or wished title
}

export type Who = { mode: "me" | "demo"; name: string; country: string; demoServices: boolean; signedIn: boolean }
export type ExplorerData = { rows: Compact[]; services: Service[]; signals: Record<string, Signal>; keys: string[]; who: Who }

export const encodeFp = (fp: number[]) => fp.map((v) => String.fromCharCode(48 + Math.max(0, Math.min(10, Math.round(v))))).join("")

export function hydrate(d: ExplorerData): TastePool & { extra: Set<string> } {
	const extra = new Set<string>()
	const items: PoolItem[] = d.rows.map((r) => {
		if (r.x) extra.add(r.k)
		const [type, id] = r.k.split("-")
		return {
			key: r.k,
			type: type as "movie" | "show",
			id: Number(id),
			title: r.t,
			year: r.y,
			poster: r.p ? `${TMDB}/w342${r.p}` : "",
			backdrop: r.b ? `${TMDB}/w1280${r.b}` : "",
			genres: r.g,
			score: r.s,
			fp: Array.from(r.f, (c) => c.charCodeAt(0) - 48),
			services: r.a,
			directors: [],
			synopsis: "",
			tags: [],
		}
	})
	return { items, services: d.services, keys: d.keys, extra }
}

export const img = (item: PoolItem, size: "w92" | "w154" | "w185" | "w342" | "w500") => item.poster.replace("/w342/", `/${size}/`)
export const backdrop = (item: PoolItem, size: "w780" | "w1280" = "w1280") => item.backdrop.replace("/w1280/", `/${size}/`)
export const attrLabel = (key: string) => FINGERPRINT_META[key]?.label ?? key.replace(/_/g, " ")

// ---------- Axes ----------

export type Axis = { id: string; pos: string[]; neg: string[]; posWord: string; negWord: string; year?: boolean }

export const AXES: Axis[] = [
	{ id: "mood", pos: ["bleakness", "melancholy"], neg: ["hopefulness", "wholesome"], posWord: "Bleak", negWord: "Hopeful" },
	{ id: "pace", pos: ["fast_pace", "adrenaline"], neg: ["slow_burn"], posWord: "Fast", negWord: "Slow burn" },
	{ id: "nerve", pos: ["tension", "scare", "violence"], neg: ["wholesome"], posWord: "Tense", negWord: "Calm" },
	{ id: "world", pos: ["fantasy", "futuristic", "wonder"], neg: ["contemporary_realism"], posWord: "Fantastical", negWord: "Grounded" },
	{ id: "funny", pos: ["situational_comedy", "wit_wordplay", "absurdist_humor", "physical_comedy"], neg: ["pathos", "melancholy"], posWord: "Funny", negWord: "Serious" },
	{ id: "mind", pos: ["complexity", "philosophical", "non_linear_narrative"], neg: ["romance", "wholesome"], posWord: "Head", negWord: "Heart" },
	{ id: "odd", pos: ["surrealism", "eccentricity", "psychedelic", "novelty"], neg: ["contemporary_realism", "biographical"], posWord: "Strange", negWord: "Straight" },
	{ id: "dark", pos: ["dark_humor", "grotesque", "violence"], neg: ["wholesome", "romance"], posWord: "Dark", negWord: "Sweet" },
	{ id: "era", pos: [], neg: [], posWord: "New", negWord: "Old", year: true },
]
export const axisById = (id: string) => AXES.find((a) => a.id === id) ?? AXES[0]

export function axisValues(items: PoolItem[], engine: Engine, a: Axis) {
	if (a.year) return items.map((it) => it.year || 1990)
	const pi = a.pos.map((k) => engine.keyIndex.get(k) as number)
	const ni = a.neg.map((k) => engine.keyIndex.get(k) as number)
	return items.map((it) => {
		const z = engine.z.get(it.key) as number[]
		const p = pi.reduce((s, i) => s + z[i], 0) / (pi.length || 1)
		const n = ni.length ? ni.reduce((s, i) => s + z[i], 0) / ni.length : 0
		return p - n
	})
}

/** Direction in fingerprint space for an axis, for steering the taste vector. */
export function axisDir(engine: Engine, a: Axis, n: number): Vec {
	const v = new Array(n).fill(0)
	for (const k of a.pos) v[engine.keyIndex.get(k) as number] += 1 / a.pos.length
	for (const k of a.neg) v[engine.keyIndex.get(k) as number] -= 1 / a.neg.length
	return v
}

// ---------- Layouts ----------
// World space is roughly -500..500 on both axes. Posters are POSTER_W wide in world units.

export const POSTER_W = 10

/** Two chosen axes, rank-spread so the field fills, then pushed apart so posters don't stack. */
export function axesLayout(items: PoolItem[], engine: Engine, ax: Axis, ay: Axis): Pt[] {
	const xs = spread(axisValues(items, engine, ax), -480, 480, 0.3)
	const ys = spread(axisValues(items, engine, ay), -480, 480, 0.3)
	return relax(
		items.map((_, i) => ({ x: xs[i], y: -ys[i] })),
		POSTER_W * 0.9,
		12,
	)
}

// Attributes that describe what a title is like, for clustering and projections.
const DESCRIPTIVE = (keys: string[]) => keys.map((k, i) => [k, i] as const).filter(([k]) => !CRAFT_KEYS.has(k) && k !== "homage_and_reference").map(([, i]) => i)

export type Region = { x: number; y: number; name: string; size: number; keys: string[]; members: number[] }

/** Clusters as islands: k-means on the title analysis, islands placed by PCA of their centers. */
export function islandsLayout(items: PoolItem[], engine: Engine, k = 14): { pos: Pt[]; regions: Region[]; cluster: number[] } {
	const dims = DESCRIPTIVE([...engine.keyIndex.keys()])
	const rows = items.map((it) => {
		const z = engine.z.get(it.key) as number[]
		return dims.map((i) => z[i])
	})
	const { assign, cents } = kmeans(rows, k)
	const [c1, c2] = pca(cents, 2)
	const centers = cents.map((c) => ({ x: dot(c, c1) * 150, y: -dot(c, c2) * 150 }))
	const members = cents.map((_, c) => assign.map((a, i) => (a === c ? i : -1)).filter((i) => i >= 0))
	const radius = members.map((m) => Math.sqrt(m.length) * POSTER_W * 0.75)
	// Push island centers apart by their radii.
	for (let pass = 0; pass < 200; pass++) {
		for (let a = 0; a < k; a++)
			for (let b = a + 1; b < k; b++) {
				const dx = centers[b].x - centers[a].x
				const dy = centers[b].y - centers[a].y
				const d = Math.sqrt(dx * dx + dy * dy) || 1
				const want = radius[a] + radius[b] + POSTER_W * 5
				if (d < want) {
					const push = (want - d) / 2 / d
					centers[a].x -= dx * push
					centers[a].y -= dy * push
					centers[b].x += dx * push
					centers[b].y += dy * push
				}
			}
		// Gentle pull to the middle keeps the map compact.
		for (const c of centers) {
			c.x *= 0.995
			c.y *= 0.995
		}
	}
	// Inside each island, spread members by the global PCA so neighbours stay neighbours.
	const [g1, g2] = pca(rows, 2)
	const pos: Pt[] = new Array(items.length)
	members.forEach((m, c) => {
		const px = spread(m.map((i) => dot(rows[i], g1)), -radius[c], radius[c], 0.2)
		const py = spread(m.map((i) => dot(rows[i], g2)), -radius[c], radius[c], 0.2)
		m.forEach((i, j) => {
			// Round the square into a disc.
			const x = px[j] / radius[c]
			const y = py[j] / radius[c]
			const fx = x * Math.sqrt(1 - (y * y) / 2)
			const fy = y * Math.sqrt(1 - (x * x) / 2)
			pos[i] = { x: centers[c].x + fx * radius[c], y: centers[c].y - fy * radius[c] }
		})
	})
	relax(pos, POSTER_W * 0.95, 20)
	const dimKeys = dims.map((i) => [...engine.keyIndex.keys()][i])
	const regions = cents.map((c, ci) => {
		const top = c
			.map((v, j) => ({ key: dimKeys[j], v }))
			.sort((a, b) => b.v - a.v)
			.slice(0, 2)
		return { x: centers[ci].x, y: centers[ci].y - radius[ci] - POSTER_W * 1.6, name: regionName(top.map((t) => t.key)), size: members[ci].length, keys: top.map((t) => t.key), members: members[ci] }
	})
	return { pos, regions, cluster: assign }
}

/** A continuous projection: the two main directions titles differ in (PCA), lightly de-overlapped. */
export function pcaLayout(items: PoolItem[], engine: Engine, basis?: Vec[]): { pos: Pt[]; basis: Vec[] } {
	const n = engine.keyIndex.size
	const dims = DESCRIPTIVE([...engine.keyIndex.keys()])
	const zs = items.map((it) => engine.z.get(it.key) as number[])
	const b = basis ?? pca(zs, 2, dims)
	const xs = zs.map((z) => dot(z, b[0]))
	const ys = zs.map((z) => dot(z, b[1]))
	const px = spread(xs, -470, 470, 0.55)
	const py = spread(ys, -470, 470, 0.55)
	void n
	return { pos: relax(items.map((_, i) => ({ x: px[i], y: -py[i] })), POSTER_W * 0.85, 14), basis: b }
}

/** What a direction in fingerprint space means, as two words on each end. */
export function describeDir(engine: Engine, v: Vec) {
	const keys = [...engine.keyIndex.keys()]
	const ranked = keys
		.map((key, i) => ({ key, v: v[i] }))
		.filter((e) => !CRAFT_KEYS.has(e.key) && e.key !== "homage_and_reference")
		.sort((a, b) => b.v - a.v)
	const pos = ranked.slice(0, 2).map((e) => e.key)
	const neg = ranked.slice(-2).reverse().map((e) => e.key)
	return { pos, neg, posWord: words(pos), negWord: words(neg) }
}

const SHORT: Record<string, string> = {
	contemporary_realism: "Realism",
	situational_comedy: "Sitcom",
	wit_wordplay: "Wit",
	absurdist_humor: "Absurd",
	physical_comedy: "Slapstick",
	cringe_humor: "Cringe",
	satire_parody: "Satire",
	dark_humor: "Dark humor",
	coming_of_age: "Coming of age",
	family_dynamics: "Family",
	class_and_capitalism: "Class",
	technology_and_humanity: "Tech",
	social_commentary: "Social critique",
	character_depth: "Character",
	slow_burn: "Slow burn",
	fast_pace: "Fast",
	non_linear_narrative: "Nonlinear",
	meta_narrative: "Meta",
	world_immersion: "Worlds",
	visual_stylization: "Stylized",
	camp_and_irony: "Camp",
	dialogue_centrality: "Talky",
	music_centrality: "Musical",
	sound_centrality: "Sound",
	hopefulness: "Hopeful",
	bleakness: "Bleak",
	biographical: "True story",
	historical: "Period",
	futuristic: "Future",
	psychological: "Psychological",
	philosophical: "Big questions",
	wholesome: "Warm",
	spectacle: "Spectacle",
	eccentricity: "Eccentric",
}
export const shortLabel = (k: string) => SHORT[k] ?? attrLabel(k)
const words = (keys: string[]) => keys.map(shortLabel).join(", ")
export const regionName = (keys: string[]) => {
	const [a, b] = keys.map(shortLabel)
	return b ? `${a} and ${b.toLowerCase().replace(/^tech$/, "tech")}` : a
}

const dot = (a: Vec, b: Vec) => a.reduce((s, x, i) => s + x * b[i], 0)

/** "Your axes": the two directions in which the titles you rated differ most, weighted by how you rated. */
export function personalBasis(items: PoolItem[], engine: Engine, signals: Record<string, Signal>): Vec[] {
	const dims = DESCRIPTIVE([...engine.keyIndex.keys()])
	const rows: Vec[] = []
	for (const [key, s] of Object.entries(signals)) {
		const z = engine.z.get(key)
		if (!z) continue
		const w = s.kind === "score" ? Math.max(0.2, (s.score - 3) / 7) : s.kind === "want" ? 0.5 : 0
		if (!w) continue
		rows.push(z.map((x) => x * w))
	}
	if (rows.length < 6) return pca(items.map((it) => engine.z.get(it.key) as number[]), 2, dims)
	const mean = rows[0].map((_, j) => rows.reduce((s, r) => s + r[j], 0) / rows.length)
	return pca(
		rows.map((r) => r.map((x, j) => x - mean[j])),
		2,
		dims,
	)
}

// ---------- Trails ----------

export type Direction = { id: string; label: string; keys: [string, number][] }
export const DIRECTIONS: Direction[] = [
	{ id: "darker", label: "Darker", keys: [["bleakness", 1], ["violence", 0.5], ["hopefulness", -1], ["wholesome", -0.6]] },
	{ id: "lighter", label: "Lighter", keys: [["hopefulness", 1], ["wholesome", 0.8], ["bleakness", -1]] },
	{ id: "faster", label: "Faster", keys: [["fast_pace", 1], ["adrenaline", 0.8], ["slow_burn", -1]] },
	{ id: "slower", label: "Slower", keys: [["slow_burn", 1], ["character_depth", 0.4], ["fast_pace", -1]] },
	{ id: "stranger", label: "Stranger", keys: [["surrealism", 1], ["eccentricity", 0.8], ["novelty", 0.6], ["contemporary_realism", -0.6]] },
	{ id: "funnier", label: "Funnier", keys: [["wit_wordplay", 1], ["situational_comedy", 0.8], ["absurdist_humor", 0.6], ["pathos", -0.4]] },
	{ id: "tenser", label: "Tenser", keys: [["tension", 1], ["intrigue", 0.6], ["scare", 0.4], ["wholesome", -0.5]] },
	{ id: "grounded", label: "More grounded", keys: [["contemporary_realism", 1], ["biographical", 0.5], ["fantasy", -1], ["futuristic", -0.6]] },
]

export function directionVec(engine: Engine, d: Direction, n: number): Vec {
	const v = new Array(n).fill(0)
	for (const [k, w] of d.keys) v[engine.keyIndex.get(k) as number] += w
	return v
}
