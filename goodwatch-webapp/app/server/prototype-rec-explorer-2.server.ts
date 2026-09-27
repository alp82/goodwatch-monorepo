// PROTOTYPE - throwaway. Read-only pool, layouts, and streaming API for /prototype/rec-explorer-2 (#180, round 2).
// Holds ~12,000 films and shows with their title analysis in memory (cached across dev reloads), computes one taste
// context per viewer, and serves only what the screen needs: tiles of a zoom pyramid for the map layouts, or small
// neighborhoods (nearest titles, a room in a direction, a director and their neighbors) for the path layouts.
// Only SELECTs. Nothing is written anywhere.
import { getUserSettings } from "~/server/user-settings.server"
import { VALID_FINGERPRINT_KEYS } from "~/server/utils/fingerprint"
import {
	CELL_PX,
	type Hub,
	LMAX,
	type LayoutId,
	type LayoutMeta,
	type Loaded,
	MOODS,
	S0,
	type W,
	type Who,
	tileSize,
} from "~/ui/prototype-rec-explorer-2/wire"
import { DIRECTIONS, regionName } from "~/ui/prototype-rec-explorer/model"
import { phrase } from "~/ui/prototype-rec-taste/engine"
import {
	CRAFT_KEYS,
	DEMO_RATINGS,
	DEMO_SERVICES,
	type Service,
	type Signal,
} from "~/ui/prototype-rec-taste/model"
import { getUserIdFromRequest } from "~/utils/auth"
import { query } from "~/utils/crate"
import {
	duplicateProviderMapping,
	getShorterProviderLabel,
	ignoredProviders,
} from "~/utils/streaming-links"

const MOVIES = 9000
const SHOWS = 3000
const PAGE = 1500
const COMMON_SERVICES = [8, 9, 337, 350, 1899, 531, 30, 283, 15, 384]
const KEYS = [...VALID_FINGERPRINT_KEYS] as string[]
const K = KEYS.length
// Attributes that describe what a title is like (craft attributes are high for every acclaimed title).
const DESC = KEYS.map((k, i) => [k, i] as const)
	.filter(([k]) => !CRAFT_KEYS.has(k) && k !== "homage_and_reference")
	.map(([, i]) => i)
const DD = DESC.length

// Bump when the viewer context's shape changes, so cached contexts from before a dev reload are rebuilt.
const CTX_VERSION = 2

const tick = () => new Promise<void>((r) => setImmediate(r))

// ---------------------------------------------------------------- pool

type T = {
	k: string
	type: "movie" | "show"
	id: number
	t: string
	yr: number
	p: string
	b: string
	g: string[]
	s: number
	votes: number
	svc: number[]
	dirs: number[]
}
type Person = { id: number; name: string; profile: string }
type Pool = {
	country: string
	titles: T[]
	index: Map<string, number>
	n: number
	mean: Float64Array
	sd: Float64Array
	Z: Float32Array // n x K, z-scores over the pool
	ZD: Float32Array // n x DD, descriptive z-scores
	U: Float32Array // n x DD, unit length, for cosine
	pop: Float32Array // popularity percentile 0..1
	mood: Uint8Array // index into MOODS
	people: Map<number, Person>
}

type Row = {
	tmdb_id: number
	title: string
	release_year: number | null
	poster_path: string | null
	backdrop_path: string | null
	genres: string[] | null
	score: number | null
	votes: number | null
	fp: Record<string, number> | null
	sa: string[] | null
}
const COLS = `tmdb_id, title, release_year, poster_path, backdrop_path, genres, goodwatch_overall_score_normalized_percent AS score,
	goodwatch_overall_score_voting_count AS votes, fingerprint_scores AS fp, streaming_availabilities AS sa`

type Cache = {
	pools: Map<string, Promise<Pool>>
	layouts: Map<string, Promise<Layout>>
	persons: Map<string, { at: number; p: Promise<Ctx> }>
	pyramids: Map<string, Pyramid>
}
// Survives dev-server module reloads, so the 12k pool loads once.
const G = globalThis as unknown as { __rx2?: Cache }
const cache: Cache = (G.__rx2 ??= {
	pools: new Map(),
	layouts: new Map(),
	persons: new Map(),
	pyramids: new Map(),
})

async function fetchRows(
	table: "movie" | "show",
	total: number,
	minVotes: number,
) {
	const out: Row[] = []
	for (let off = 0; off < total; off += PAGE) {
		const rows = await query<Row>(
			`SELECT ${COLS} FROM ${table} WHERE poster_path IS NOT NULL AND fingerprint_scores IS NOT NULL
			 AND goodwatch_overall_score_voting_count >= ${minVotes} ORDER BY goodwatch_overall_score_voting_count DESC LIMIT ${PAGE} OFFSET ${off}`,
		)
		out.push(...rows)
		if (rows.length < PAGE) break
	}
	return out
}

function toT(
	type: "movie" | "show",
	r: Row,
	country: string,
): T & { fpv: number[] } {
	const prefix = `${country}_`
	return {
		k: `${type}-${r.tmdb_id}`,
		type,
		id: r.tmdb_id,
		t: r.title,
		yr: r.release_year ?? 0,
		p: r.poster_path ?? "",
		b: r.backdrop_path ?? "",
		g: (r.genres ?? []).slice(0, 3),
		s: r.score == null ? 0 : Math.floor(r.score),
		votes: r.votes ?? 0,
		svc: (r.sa ?? [])
			.filter((x) => x.startsWith(prefix))
			.map((x) => Number(x.slice(prefix.length))),
		dirs: [],
		fpv: KEYS.map((k) => Math.max(0, Math.min(10, r.fp?.[k] ?? 0))),
	}
}

async function buildPool(country: string): Promise<Pool> {
	const [movies, shows] = [
		await fetchRows("movie", MOVIES, 800),
		await fetchRows("show", SHOWS, 200),
	]
	const all = [
		...movies.map((r) => toT("movie", r, country)),
		...shows.map((r) => toT("show", r, country)),
	]
	const n = all.length
	const mean = new Float64Array(K)
	const sd = new Float64Array(K)
	for (const t of all) for (let k = 0; k < K; k++) mean[k] += t.fpv[k] / n
	for (const t of all)
		for (let k = 0; k < K; k++) sd[k] += (t.fpv[k] - mean[k]) ** 2 / n
	for (let k = 0; k < K; k++) sd[k] = Math.sqrt(sd[k]) || 1
	const Z = new Float32Array(n * K)
	const ZD = new Float32Array(n * DD)
	const U = new Float32Array(n * DD)
	all.forEach((t, i) => {
		for (let k = 0; k < K; k++) Z[i * K + k] = (t.fpv[k] - mean[k]) / sd[k]
		let len = 0
		for (let d = 0; d < DD; d++) {
			const v = Z[i * K + DESC[d]]
			ZD[i * DD + d] = v
			len += v * v
		}
		len = Math.sqrt(len) || 1
		for (let d = 0; d < DD; d++) U[i * DD + d] = ZD[i * DD + d] / len
	})
	// Popularity percentile by votes.
	const byVotes = all
		.map((t, i) => [t.votes, i] as const)
		.sort((a, b) => a[0] - b[0])
	const pop = new Float32Array(n)
	byVotes.forEach(([, i], r) => {
		pop[i] = r / Math.max(1, n - 1)
	})
	// Mood: the strongest of the mood families.
	const moodIdx = MOODS.map((m) =>
		m.keys.map((k) => KEYS.indexOf(k)).filter((i) => i >= 0),
	)
	const mood = new Uint8Array(n)
	for (let i = 0; i < n; i++) {
		let best = 0
		let bv = Number.NEGATIVE_INFINITY
		moodIdx.forEach((ks, m) => {
			let v = 0
			for (const k of ks) v += Z[i * K + k]
			v /= ks.length
			if (v > bv) {
				bv = v
				best = m
			}
		})
		mood[i] = best
	}
	const titles: T[] = all.map(({ fpv, ...t }) => t)
	const index = new Map(titles.map((t, i) => [t.k, i]))

	// Directors for films, creators for shows.
	const people = new Map<number, Person>()
	for (const [type, job] of [
		["movie", "Director"],
		["show", "Creator"],
	] as const) {
		const ids = titles.filter((t) => t.type === type).map((t) => t.id)
		for (let o = 0; o < ids.length; o += PAGE) {
			const chunk = ids.slice(o, o + PAGE)
			const rows = await query<{
				media_tmdb_id: number
				person_tmdb_id: number
				name: string
				profile_path: string | null
			}>(
				`SELECT pw.media_tmdb_id, pw.person_tmdb_id, p.name, p.profile_path FROM person_worked_on pw JOIN person p ON p.tmdb_id = pw.person_tmdb_id
				 WHERE pw.media_type = '${type}' AND pw.job = '${job}' AND pw.media_tmdb_id IN (${chunk.join(",")}) LIMIT 20000`,
			)
			for (const r of rows) {
				const i = index.get(`${type}-${r.media_tmdb_id}`)
				if (i == null) continue
				if (!titles[i].dirs.includes(r.person_tmdb_id))
					titles[i].dirs.push(r.person_tmdb_id)
				if (!people.has(r.person_tmdb_id))
					people.set(r.person_tmdb_id, {
						id: r.person_tmdb_id,
						name: r.name,
						profile: r.profile_path ?? "",
					})
			}
		}
	}
	return { country, titles, index, n, mean, sd, Z, ZD, U, pop, mood, people }
}

function getPool(country: string) {
	let p = cache.pools.get(country)
	if (!p) {
		p = buildPool(country).catch((e) => {
			cache.pools.delete(country)
			throw e
		})
		cache.pools.set(country, p)
	}
	return p
}

// ---------------------------------------------------------------- viewer

type Ctx = {
	key: string
	pool: Pool
	who: Who
	services: Service[]
	signals: Record<string, Signal>
	taste: Float32Array // K
	tasteD: Float32Array // DD, unit
	sims: Float32Array
	match: Uint8Array
	seen: Uint8Array // 1 seen or rated, 2 not interested
	rating: Uint8Array
	want: Uint8Array
	onMine: Uint8Array
	prio: Float32Array
	loved: number[]
	relevant: Set<number>
}

type KeyRow = { tmdb_id: number; media_type: string }
const keyOf = (r: KeyRow) =>
	`${r.media_type === "tv" ? "show" : r.media_type}-${r.tmdb_id}`

async function memberSignals(userId: string) {
	const [scores, wish, watched, skipped] = await Promise.all([
		query<KeyRow & { score: number }>(
			"SELECT tmdb_id, media_type, score FROM user_score WHERE user_id = ? LIMIT 5000",
			[userId],
		),
		query<KeyRow>(
			"SELECT tmdb_id, media_type FROM user_wishlist WHERE user_id = ? LIMIT 5000",
			[userId],
		),
		query<KeyRow>(
			"SELECT tmdb_id, media_type FROM user_watch_history WHERE user_id = ? LIMIT 5000",
			[userId],
		),
		query<KeyRow>(
			"SELECT tmdb_id, media_type FROM user_skipped WHERE user_id = ? LIMIT 5000",
			[userId],
		),
	])
	const signals: Record<string, Signal> = {}
	for (const r of skipped) signals[keyOf(r)] = { kind: "no" }
	for (const r of wish) signals[keyOf(r)] = { kind: "want" }
	for (const r of watched) signals[keyOf(r)] = { kind: "seen" }
	for (const r of scores)
		if (r.score) signals[keyOf(r)] = { kind: "score", score: r.score }
	return signals
}

const brand = (name: string) =>
	getShorterProviderLabel(name)
		.replace(/\s+(Amazon|Apple TV|Roku Premium)\s+Channel$/i, "")
		.replace(/\s+(Standard|Basic)\s+with\s+Ads$/i, "")
		.replace(/\s+with\s+Ads$/i, "")
		.replace(/\s+(Essential|Premium|Basic|Standard)$/i, "")

const weightOf = (s: Signal) =>
	s.kind === "score"
		? (s.score - 5.5) / 4.5
		: s.kind === "no"
			? -0.35
			: s.kind === "want"
				? 0.35
				: 0

async function buildCtx(
	key: string,
	request: Request,
	userId: string | undefined,
	asMe: boolean,
): Promise<Ctx> {
	const url = new URL(request.url)
	const settings = (
		asMe && userId ? await getUserSettings({ userId }).catch(() => ({})) : {}
	) as { country_default?: string; streaming_providers_default?: string }
	const country =
		url.searchParams.get("country") ??
		(asMe ? settings.country_default : undefined) ??
		"DE"
	const saved = String(settings.streaming_providers_default ?? "")
		.split(",")
		.map(Number)
		.filter(Boolean)
	const base = asMe && saved.length ? saved : DEMO_SERVICES
	const mine = new Set(
		base.flatMap((id) =>
			id in duplicateProviderMapping
				? [id, ...duplicateProviderMapping[id]]
				: [id],
		),
	)
	const [pool, signals] = await Promise.all([
		getPool(country),
		asMe && userId
			? memberSignals(userId)
			: Promise.resolve({ ...DEMO_RATINGS }),
	])
	const n = pool.n

	// Taste vector over all 74 attributes, as the Taste prototype's engine builds it; outside-pool titles count too.
	const taste = new Float32Array(K)
	let total = 0
	const missing: string[] = []
	for (const [k, s] of Object.entries(signals)) {
		const w = weightOf(s)
		if (!w) continue
		const i = pool.index.get(k)
		if (i == null) {
			missing.push(k)
			continue
		}
		total += Math.abs(w)
		for (let d = 0; d < K; d++) taste[d] += w * pool.Z[i * K + d]
	}
	for (const type of ["movie", "show"] as const) {
		const ids = missing
			.filter((k) => k.startsWith(`${type}-`))
			.slice(0, 600)
			.map((k) => Number(k.split("-")[1]))
		if (!ids.length) continue
		const rows = await query<{ tmdb_id: number; fp: Record<string, number> }>(
			`SELECT tmdb_id, fingerprint_scores AS fp FROM ${type} WHERE fingerprint_scores IS NOT NULL AND tmdb_id IN (${ids.join(",")})`,
		)
		for (const r of rows) {
			const w = weightOf(signals[`${type}-${r.tmdb_id}`])
			total += Math.abs(w)
			for (let d = 0; d < K; d++)
				taste[d] += (w * ((r.fp?.[KEYS[d]] ?? 0) - pool.mean[d])) / pool.sd[d]
		}
	}
	if (total) for (let d = 0; d < K; d++) taste[d] /= total
	let tl = 0
	for (let d = 0; d < K; d++) tl += taste[d] * taste[d]
	tl = Math.sqrt(tl) || 1
	for (let d = 0; d < K; d++) taste[d] /= tl
	const tasteD = new Float32Array(DD)
	let dl = 0
	for (let d = 0; d < DD; d++) {
		tasteD[d] = taste[DESC[d]]
		dl += tasteD[d] ** 2
	}
	dl = Math.sqrt(dl) || 1
	for (let d = 0; d < DD; d++) tasteD[d] /= dl

	// Cosine to every title, then a per-person percentile shown as 50-99 (the #174 calibration).
	const sims = new Float32Array(n)
	for (let i = 0; i < n; i++) {
		let dot = 0
		let len = 0
		for (let d = 0; d < K; d++) {
			const z = pool.Z[i * K + d]
			dot += z * taste[d]
			len += z * z
		}
		sims[i] = len ? dot / Math.sqrt(len) : 0
	}
	const order = Array.from({ length: n }, (_, i) => i).sort(
		(a, b) => sims[a] - sims[b],
	)
	const match = new Uint8Array(n)
	const pct = new Float32Array(n)
	order.forEach((i, r) => {
		pct[i] = r / Math.max(1, n - 1)
		match[i] = Math.round(50 + 49 * pct[i])
	})
	const seen = new Uint8Array(n)
	const rating = new Uint8Array(n)
	const want = new Uint8Array(n)
	for (const [k, s] of Object.entries(signals)) {
		const i = pool.index.get(k)
		if (i == null) continue
		if (s.kind === "score") {
			seen[i] = 1
			rating[i] = s.score
		} else if (s.kind === "seen") seen[i] = 1
		else if (s.kind === "no") seen[i] = 2
		else if (s.kind === "want") want[i] = 1
	}
	const onMine = new Uint8Array(n)
	const prio = new Float32Array(n)
	for (let i = 0; i < n; i++) {
		if (pool.titles[i].svc.some((id) => mine.has(id))) onMine[i] = 1
		// Representatives: mostly how close to your taste, partly how well known and how good.
		prio[i] =
			0.62 * pct[i] + 0.28 * pool.pop[i] + 0.1 * (pool.titles[i].s / 100)
	}
	const loved = Object.entries(signals)
		.filter(([, s]) => s.kind === "score" && s.score >= 8)
		.map(([k]) => pool.index.get(k))
		.filter((i): i is number => i != null)

	const relevant = new Set([...mine, ...COMMON_SERVICES])
	for (const id of ignoredProviders) relevant.delete(id)
	const svcRows = await query<{
		tmdb_id: number
		name: string
		logo_path: string
	}>(
		`SELECT tmdb_id, name, logo_path FROM streaming_service WHERE tmdb_id IN (${[...relevant].join(",")})`,
	)
	const seenSvc = new Set<number>()
	const services: Service[] = svcRows
		.filter((s) => !seenSvc.has(s.tmdb_id) && seenSvc.add(s.tmdb_id))
		.map((s) => ({
			id: s.tmdb_id,
			name: brand(s.name),
			logo: `https://www.themoviedb.org/t/p/original${s.logo_path}`,
			mine: mine.has(s.tmdb_id),
		}))
		.sort((a, b) => Number(b.mine) - Number(a.mine))
	const rated = Object.values(signals).filter((s) => s.kind === "score").length
	const who: Who = {
		mode: asMe ? "me" : "demo",
		country,
		demoServices: !(asMe && saved.length),
		signedIn: !!userId,
		rated,
		pool: n,
	}
	return {
		key,
		pool,
		who,
		services,
		signals,
		taste,
		tasteD,
		sims,
		match,
		seen,
		rating,
		want,
		onMine,
		prio,
		loved,
		relevant: new Set(services.map((s) => s.id)),
	}
}

async function getCtx(request: Request): Promise<Ctx> {
	const url = new URL(request.url)
	const userId = await getUserIdFromRequest({ request }).catch(() => undefined)
	const asMe = !!userId && url.searchParams.get("as") !== "demo"
	const key = `v${CTX_VERSION}|${asMe ? userId : "demo"}|${url.searchParams.get("country") ?? ""}`
	const hit = cache.persons.get(key)
	if (hit && Date.now() - hit.at < 10 * 60_000) return hit.p
	const p = buildCtx(key, request, userId, asMe).catch((e) => {
		cache.persons.delete(key)
		throw e
	})
	cache.persons.set(key, { at: Date.now(), p })
	return p
}

// ---------------------------------------------------------------- math helpers

function seeded(seed = 7) {
	let s = seed >>> 0
	return () => {
		s = (s + 0x6d2b79f5) >>> 0
		let t = s
		t = Math.imul(t ^ (t >>> 15), t | 1)
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296
	}
}
const hash01 = (i: number) => {
	let h = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b)
	h ^= h >>> 13
	h = Math.imul(h, 0xc2b2ae35)
	h ^= h >>> 16
	return (h >>> 0) / 4294967296
}

/** k-means++ over rows of ZD, restricted to idx. Yields between iterations so the dev server stays responsive. */
async function kmeans(
	pool: Pool,
	idx: number[],
	k: number,
	iters = 16,
	seed = 5,
) {
	const rand = seeded(seed)
	const m = idx.length
	k = Math.max(1, Math.min(k, m))
	const X = pool.ZD
	const cents = new Float32Array(k * DD)
	const d2c = (i: number, c: number) => {
		let s = 0
		const o = i * DD
		const co = c * DD
		for (let d = 0; d < DD; d++) {
			const v = X[o + d] - cents[co + d]
			s += v * v
		}
		return s
	}
	const first = idx[Math.floor(rand() * m)]
	for (let d = 0; d < DD; d++) cents[d] = X[first * DD + d]
	const best = new Float64Array(m).fill(Number.POSITIVE_INFINITY)
	for (let c = 1; c < k; c++) {
		let total = 0
		for (let j = 0; j < m; j++) {
			best[j] = Math.min(best[j], d2c(idx[j], c - 1))
			total += best[j]
		}
		let r = rand() * total
		let pick = 0
		for (; pick < m - 1; pick++) {
			r -= best[pick]
			if (r <= 0) break
		}
		for (let d = 0; d < DD; d++) cents[c * DD + d] = X[idx[pick] * DD + d]
	}
	const assign = new Int32Array(m)
	for (let it = 0; it < iters; it++) {
		for (let j = 0; j < m; j++) {
			let bi = 0
			let bd = Number.POSITIVE_INFINITY
			for (let c = 0; c < k; c++) {
				const dd = d2c(idx[j], c)
				if (dd < bd) {
					bd = dd
					bi = c
				}
			}
			assign[j] = bi
		}
		const counts = new Float64Array(k)
		cents.fill(0)
		for (let j = 0; j < m; j++) {
			const c = assign[j]
			counts[c]++
			for (let d = 0; d < DD; d++) cents[c * DD + d] += X[idx[j] * DD + d]
		}
		for (let c = 0; c < k; c++)
			if (counts[c]) for (let d = 0; d < DD; d++) cents[c * DD + d] /= counts[c]
		await tick()
	}
	return { assign, cents, k }
}

/** Top two principal directions of a set of DD-dim rows (power iteration). */
function pca2(rows: Float32Array, m: number): [Float64Array, Float64Array] {
	const mean = new Float64Array(DD)
	for (let j = 0; j < m; j++)
		for (let d = 0; d < DD; d++) mean[d] += rows[j * DD + d] / m
	const cov = new Float64Array(DD * DD)
	for (let j = 0; j < m; j++)
		for (let a = 0; a < DD; a++) {
			const va = rows[j * DD + a] - mean[a]
			if (!va) continue
			for (let b = 0; b < DD; b++)
				cov[a * DD + b] += va * (rows[j * DD + b] - mean[b])
		}
	const out: Float64Array[] = []
	const rand = seeded(11)
	for (let c = 0; c < 2; c++) {
		let v = Float64Array.from({ length: DD }, () => rand() - 0.5)
		for (let it = 0; it < 60; it++) {
			const nv = new Float64Array(DD)
			for (let a = 0; a < DD; a++) {
				let s = 0
				for (let b = 0; b < DD; b++) s += cov[a * DD + b] * v[b]
				nv[a] = s
			}
			let l = 0
			for (let a = 0; a < DD; a++) l += nv[a] * nv[a]
			l = Math.sqrt(l) || 1
			v = nv.map((x) => x / l)
		}
		let lambda = 0
		for (let a = 0; a < DD; a++)
			for (let b = 0; b < DD; b++) lambda += v[a] * cov[a * DD + b] * v[b]
		for (let a = 0; a < DD; a++)
			for (let b = 0; b < DD; b++) cov[a * DD + b] -= lambda * v[a] * v[b]
		let big = 0
		for (let a = 0; a < DD; a++) if (Math.abs(v[a]) > Math.abs(v[big])) big = a
		out.push(v[big] < 0 ? v.map((x) => -x) : v)
	}
	return [out[0], out[1]]
}
const rowsOf = (pool: Pool, idx: number[]) => {
	const r = new Float32Array(idx.length * DD)
	idx.forEach((i, j) => r.set(pool.ZD.subarray(i * DD, i * DD + DD), j * DD))
	return r
}
const proj = (pool: Pool, i: number, v: Float64Array) => {
	let s = 0
	for (let d = 0; d < DD; d++) s += pool.ZD[i * DD + d] * v[d]
	return s
}
/** Even ranks in [lo, hi] blended with raw values, so clumps still read. */
function spread(values: number[], lo: number, hi: number, raw = 0.3) {
	const idx = values.map((v, i) => [v, i] as const).sort((a, b) => a[0] - b[0])
	const out = new Array<number>(values.length).fill(0)
	const min = idx[0]?.[0] ?? 0
	const max = idx[idx.length - 1]?.[0] ?? 1
	idx.forEach(([v, i], r) => {
		const rank = lo + (r / Math.max(1, idx.length - 1)) * (hi - lo)
		const rv = lo + ((v - min) / (max - min || 1)) * (hi - lo)
		out[i] = rank * (1 - raw) + rv * raw
	})
	return out
}

/** Push points apart until none are closer than minDist; numeric grid hash, yields between passes. */
async function relax(
	X: Float32Array,
	Y: Float32Array,
	idx: number[],
	minDist: number,
	passes: number,
	clamp?: (i: number) => void,
) {
	const cell = minDist
	for (let p = 0; p < passes; p++) {
		const grid = new Map<number, number[]>()
		for (const i of idx) {
			const key = Math.floor(X[i] / cell) * 100003 + Math.floor(Y[i] / cell)
			const l = grid.get(key)
			if (l) l.push(i)
			else grid.set(key, [i])
		}
		let moved = 0
		for (const i of idx) {
			const gx = Math.floor(X[i] / cell)
			const gy = Math.floor(Y[i] / cell)
			for (let dx = -1; dx <= 1; dx++)
				for (let dy = -1; dy <= 1; dy++) {
					const l = grid.get((gx + dx) * 100003 + gy + dy)
					if (!l) continue
					for (const j of l) {
						if (j <= i) continue
						let ddx = X[j] - X[i]
						let ddy = Y[j] - Y[i]
						let d = Math.sqrt(ddx * ddx + ddy * ddy)
						if (d >= minDist) continue
						if (d < 1e-4) {
							ddx = Math.cos(i * 2.4)
							ddy = Math.sin(i * 2.4)
							d = 1
						}
						const push = (minDist - d) / 2 / d
						X[i] -= ddx * push
						Y[i] -= ddy * push
						X[j] += ddx * push
						Y[j] += ddy * push
						moved++
					}
				}
		}
		if (clamp) for (const i of idx) clamp(i)
		await tick()
		if (!moved) break
	}
}

/** Two attributes that set a group apart from its parent, as a short name. */
function nameFor(
	centroid: Float64Array | Float32Array,
	parent: Float64Array | null,
	avoid: string[] = [],
) {
	const ranked = Array.from({ length: DD }, (_, d) => ({
		key: KEYS[DESC[d]],
		v: centroid[d] - (parent ? parent[d] : 0),
	}))
		.filter((e) => !avoid.includes(e.key))
		.sort((a, b) => b.v - a.v)
	const keys = ranked.slice(0, 2).map((e) => e.key)
	return { name: regionName(keys), keys }
}

// ---------------------------------------------------------------- layouts

type Layout = {
	X: Float32Array
	Y: Float32Array
	meta: LayoutMeta
	hubs?: Map<number, Hub & { mean: Float32Array }>
}

async function zoomLayout(pool: Pool): Promise<Layout> {
	const n = pool.n
	const X = new Float32Array(n).fill(Number.NaN)
	const Y = new Float32Array(n).fill(Number.NaN)
	const R0 = 1600
	const nodes: LayoutMeta["nodes"] = []
	const all = Array.from({ length: n }, (_, i) => i)
	const meanOf = (idx: number[]) => {
		const c = new Float64Array(DD)
		for (const i of idx)
			for (let d = 0; d < DD; d++) c[d] += pool.ZD[i * DD + d] / idx.length
		return c
	}

	/** Split idx into k groups, pack them as circles inside (cx, cy, R), recurse. */
	const split = async (
		idx: number[],
		cx: number,
		cy: number,
		R: number,
		depth: number,
		parentMean: Float64Array | null,
		avoid: string[],
		parentId: number,
	) => {
		if (depth === 3) {
			// Titles: spread by the group's own two main directions, rounded into a disc.
			const rows = rowsOf(pool, idx)
			const [a, b] = pca2(rows, idx.length)
			const px = spread(
				idx.map((i) => proj(pool, i, a)),
				-R,
				R,
				0.2,
			)
			const py = spread(
				idx.map((i) => proj(pool, i, b)),
				-R,
				R,
				0.2,
			)
			idx.forEach((i, j) => {
				const x = px[j] / R
				const y = py[j] / R
				X[i] = cx + x * Math.sqrt(1 - (y * y) / 2) * R * 0.92
				Y[i] = cy + y * Math.sqrt(1 - (x * x) / 2) * R * 0.92
			})
			return
		}
		const k =
			depth === 0
				? 9
				: depth === 1
					? Math.max(3, Math.min(6, Math.round(idx.length / 260)))
					: Math.max(2, Math.min(6, Math.round(idx.length / 45)))
		const { assign, cents } = await kmeans(
			pool,
			idx,
			k,
			depth === 0 ? 18 : 12,
			5 + depth,
		)
		const groups: number[][] = Array.from({ length: k }, () => [])
		idx.forEach((i, j) => groups[assign[j]].push(i))
		const live = groups.map((g, c) => ({ g, c })).filter((e) => e.g.length)
		// Circle packing: start from the groups' two main directions, then push apart and keep inside.
		const [a, b] = pca2(cents, k)
		const cp = live.map(({ c }) => {
			let x = 0
			let y = 0
			for (let d = 0; d < DD; d++) {
				x += cents[c * DD + d] * a[d]
				y += cents[c * DD + d] * b[d]
			}
			return { x, y }
		})
		const ext = Math.max(1e-6, ...cp.map((p) => Math.hypot(p.x, p.y)))
		const circ = live.map((e, j) => ({
			x: (cp[j].x / ext) * R * 0.55,
			y: (cp[j].y / ext) * R * 0.55,
			r: R * Math.sqrt(e.g.length / idx.length) * 0.86,
		}))
		for (let it = 0; it < 400; it++) {
			for (let p = 0; p < circ.length; p++)
				for (let q = p + 1; q < circ.length; q++) {
					const dx = circ[q].x - circ[p].x
					const dy = circ[q].y - circ[p].y
					const d = Math.hypot(dx, dy) || 1e-3
					const want = circ[p].r + circ[q].r + R * 0.02
					if (d < want) {
						const push = (want - d) / 2 / d
						circ[p].x -= dx * push
						circ[p].y -= dy * push
						circ[q].x += dx * push
						circ[q].y += dy * push
					}
				}
			for (const c of circ) {
				const d = Math.hypot(c.x, c.y)
				if (d + c.r > R) {
					const f = (R - c.r) / (d || 1)
					c.x *= f
					c.y *= f
				}
				c.x *= 0.998
				c.y *= 0.998
			}
		}
		for (let j = 0; j < live.length; j++) {
			const g = live[j].g
			const mean = meanOf(g)
			const nm = nameFor(mean, parentMean, avoid)
			const id = nodes.length
			nodes.push({
				id,
				parent: parentId,
				depth,
				name: nm.name,
				x: cx + circ[j].x,
				y: cy + circ[j].y,
				r: circ[j].r,
				count: g.length,
			})
			await split(
				g,
				cx + circ[j].x,
				cy + circ[j].y,
				circ[j].r,
				depth + 1,
				mean,
				[...avoid, ...nm.keys],
				id,
			)
		}
	}
	await split(all, 0, 0, R0, 0, null, [], -1)
	await relax(X, Y, all, 12, 14)
	return { X, Y, meta: { kind: "zoom", nodes } }
}

async function ringsLayout(pool: Pool, ctx: Ctx): Promise<Layout> {
	const n = pool.n
	const X = new Float32Array(n)
	const Y = new Float32Array(n)
	const R = 1050
	const rank = Array.from({ length: n }, (_, i) => i).sort(
		(a, b) => ctx.sims[b] - ctx.sims[a],
	)
	const rOf = new Float32Array(n)
	rank.forEach((i, r) => {
		rOf[i] = R * Math.sqrt((r + 0.5) / n)
	})
	// Sectors by mood, widths by how many titles carry that mood.
	const counts = MOODS.map((_, m) =>
		pool.mood.reduce((s, x) => s + (x === m ? 1 : 0), 0),
	)
	const sectors: { name: string; color: string; a0: number; a1: number }[] = []
	let a = -Math.PI / 2
	MOODS.forEach((m, j) => {
		const w = (counts[j] / n) * Math.PI * 2
		sectors.push({ name: m.name, color: m.color, a0: a, a1: a + w })
		a += w
	})
	const [pa] = pca2(pool.ZD, n)
	const byMood: number[][] = MOODS.map(() => [])
	for (let i = 0; i < n; i++) byMood[pool.mood[i]].push(i)
	byMood.forEach((idx, m) => {
		const s = sectors[m]
		const t = spread(
			idx.map((i) => proj(pool, i, pa) + hash01(i) * 0.6),
			0.04,
			0.96,
			0.1,
		)
		idx.forEach((i, j) => {
			const ang = s.a0 + t[j] * (s.a1 - s.a0)
			X[i] = Math.cos(ang) * rOf[i]
			Y[i] = Math.sin(ang) * rOf[i]
		})
	})
	await relax(X, Y, rank, 12.5, 12)
	const bands = [
		{ id: "core", name: "Your core", r0: 0, r1: R * Math.sqrt(0.12) },
		{
			id: "edges",
			name: "Your edges",
			r0: R * Math.sqrt(0.12),
			r1: R * Math.sqrt(0.45),
		},
		{
			id: "unexplored",
			name: "Unexplored",
			r0: R * Math.sqrt(0.45),
			r1: R * 1.04,
		},
	]
	return { X, Y, meta: { kind: "rings", bands, sectors } }
}

async function erasLayout(pool: Pool): Promise<Layout> {
	const n = pool.n
	const X = new Float32Array(n)
	const Y = new Float32Array(n)
	const Y0 = 1920
	const Y1 = 2026
	const years = pool.titles.map((t) => Math.max(Y0, Math.min(Y1, t.yr || 2000)))
	// Time runs left to right; busy recent years get more room than the silent era.
	const hist = new Float64Array(Y1 - Y0 + 2)
	for (const y of years) hist[y - Y0 + 1]++
	for (let j = 1; j < hist.length; j++) hist[j] += hist[j - 1]
	const W = 1500
	const xOf = (y: number) => {
		const f = y - Math.floor(y)
		const yi = Math.floor(y)
		const c0 = hist[Math.max(0, Math.min(hist.length - 1, yi - Y0))] / n
		const c1 = hist[Math.max(0, Math.min(hist.length - 1, yi - Y0 + 1))] / n
		const cdf = c0 + (c1 - c0) * f
		const lin = (y - Y0) / (Y1 + 1 - Y0)
		return -W + 2 * W * (0.4 * lin + 0.6 * cdf)
	}
	// Mood lanes, heights by how many titles carry that mood.
	const counts = MOODS.map((_, m) =>
		pool.mood.reduce((s, x) => s + (x === m ? 1 : 0), 0),
	)
	const H = 1700
	const gap = 34
	const lanes: { name: string; color: string; y0: number; y1: number }[] = []
	let y = -H / 2
	const order = [0, 1, 2, 3, 4, 5, 6, 7, 8]
	for (const m of order) {
		const h = Math.max(90, ((H - gap * MOODS.length) * counts[m]) / n)
		lanes.push({ name: MOODS[m].name, color: MOODS[m].color, y0: y, y1: y + h })
		y += h + gap
	}
	for (let i = 0; i < n; i++) {
		const lane = lanes[order.indexOf(pool.mood[i])]
		X[i] = xOf(years[i] + hash01(i * 3 + 1))
		Y[i] = lane.y0 + 6 + hash01(i * 7 + 2) * (lane.y1 - lane.y0 - 12)
	}
	const all = Array.from({ length: n }, (_, i) => i)
	await relax(X, Y, all, 12, 16, (i) => {
		const lane = lanes[order.indexOf(pool.mood[i])]
		if (Y[i] < lane.y0 + 6) Y[i] = lane.y0 + 6
		if (Y[i] > lane.y1 - 6) Y[i] = lane.y1 - 6
	})
	const decades = []
	for (let d = 1920; d <= 2020; d += 10)
		decades.push({
			label: `${d}s`,
			x: xOf(d),
			x1: xOf(Math.min(d + 10, Y1 + 1)),
		})
	return { X, Y, meta: { kind: "eras", lanes, decades } }
}

async function moodsLayout(pool: Pool): Promise<Layout> {
	const n = pool.n
	const X = new Float32Array(n).fill(Number.NaN)
	const Y = new Float32Array(n).fill(Number.NaN)
	const CW = 13
	const CH = 19.5
	// Light at the top, dark at the bottom.
	const grid = [
		["warm", "funny", "romantic"],
		["wonder", "moving", "mind"],
		["tense", "dark", "scary"],
	]
	const byMood: number[][] = MOODS.map(() => [])
	for (let i = 0; i < n; i++) byMood[pool.mood[i]].push(i)
	const side = MOODS.map((_, m) => Math.sqrt(byMood[m].length * CW * CH * 1.5))
	const mIdx = (id: string) => MOODS.findIndex((m) => m.id === id)
	const colW = [0, 1, 2].map((c) =>
		Math.max(...grid.map((row) => side[mIdx(row[c])])),
	)
	const rowH = grid.map((row) => Math.max(...row.map((id) => side[mIdx(id)])))
	const GAP = 70
	const totalW = colW.reduce((a, b) => a + b, 0) + GAP * 2
	const totalH = rowH.reduce((a, b) => a + b, 0) + GAP * 2
	const rooms: LayoutMeta["rooms"] = []
	let oy = -totalH / 2
	for (let r = 0; r < 3; r++) {
		let ox = -totalW / 2
		for (let c = 0; c < 3; c++) {
			const m = mIdx(grid[r][c])
			const s = side[m]
			const x0 = ox + (colW[c] - s) / 2
			const y0 = oy + (rowH[r] - s) / 2
			const room = {
				id: MOODS[m].id,
				name: MOODS[m].name,
				color: MOODS[m].color,
				x0,
				y0,
				x1: x0 + s,
				y1: y0 + s,
				count: byMood[m].length,
				subs: [] as {
					name: string
					x0: number
					y0: number
					x1: number
					y1: number
				}[],
			}
			// Shelves by main genre, the best-known titles first.
			const byGenre = new Map<string, number[]>()
			for (const i of byMood[m]) {
				const g = pool.titles[i].g[0] ?? "Other"
				const l = byGenre.get(g)
				if (l) l.push(i)
				else byGenre.set(g, [i])
			}
			let groups = [...byGenre.entries()].sort(
				(a, b) => b[1].length - a[1].length,
			)
			if (groups.length > 6)
				groups = [
					...groups.slice(0, 5),
					["Other", groups.slice(5).flatMap((g) => g[1])],
				]
			const pad = 8
			let sy = y0 + pad + 26
			const usableH = s - pad * 2 - 26
			for (const [g, list] of groups) {
				list.sort((a, b) => pool.pop[b] - pool.pop[a])
				const cols = Math.max(1, Math.floor((s - pad * 2) / CW))
				const rows = Math.ceil(list.length / cols)
				const h = rows * CH + 22
				room.subs.push({
					name: g,
					x0: x0 + pad,
					y0: sy,
					x1: x0 + s - pad,
					y1: sy + h,
				})
				list.forEach((i, j) => {
					X[i] = x0 + pad + (j % cols) * CW + CW / 2
					Y[i] = sy + 22 + Math.floor(j / cols) * CH + CH / 2
				})
				sy += h + 4
			}
			// Grow the room to fit its shelves.
			room.y1 = Math.max(room.y1, sy + pad)
			void usableH
			rooms.push(room)
			ox += colW[c] + GAP
		}
		oy += Math.max(rowH[r], ...rooms.slice(-3).map((rm) => rm.y1 - oy)) + GAP
	}
	return { X, Y, meta: { kind: "moods", rooms } }
}

async function peopleLayout(pool: Pool): Promise<Layout> {
	const n = pool.n
	const X = new Float32Array(n).fill(Number.NaN)
	const Y = new Float32Array(n).fill(Number.NaN)
	const counts = new Map<number, number>()
	for (const t of pool.titles)
		for (const d of t.dirs) counts.set(d, (counts.get(d) ?? 0) + 1)
	// Each title orbits its most prolific director (or creator) with at least three titles here.
	const members = new Map<number, number[]>()
	pool.titles.forEach((t, i) => {
		let best = -1
		let bc = 2
		for (const d of t.dirs)
			if ((counts.get(d) ?? 0) > bc) {
				bc = counts.get(d) ?? 0
				best = d
			}
		if (best < 0) return
		const l = members.get(best)
		if (l) l.push(i)
		else members.set(best, [i])
	})
	const ids = [...members.keys()].filter(
		(d) => (members.get(d)?.length ?? 0) >= 3,
	)
	const means = ids.map((d) => {
		const idx = members.get(d) as number[]
		const c = new Float32Array(DD)
		for (const i of idx)
			for (let k = 0; k < DD; k++) c[k] += pool.ZD[i * DD + k] / idx.length
		return c
	})
	const flat = new Float32Array(ids.length * DD)
	means.forEach((c, j) => flat.set(c, j * DD))
	const [a, b] = pca2(flat, ids.length)
	const dot = (c: Float32Array, v: Float64Array) =>
		c.reduce((s, x, k) => s + x * v[k], 0)
	const hx = spread(
		means.map((c) => dot(c, a)),
		-1500,
		1500,
		0.35,
	)
	const hy = spread(
		means.map((c) => dot(c, b)),
		-1100,
		1100,
		0.35,
	)
	const hr = ids.map(
		(d) => 16 + 7.5 * Math.sqrt((members.get(d) as number[]).length),
	)
	for (let pass = 0; pass < 60; pass++) {
		for (let p = 0; p < ids.length; p++)
			for (let q = p + 1; q < ids.length; q++) {
				const dx = hx[q] - hx[p]
				const dy = hy[q] - hy[p]
				const want = hr[p] + hr[q] + 14
				if (Math.abs(dx) > want || Math.abs(dy) > want) continue
				const d = Math.hypot(dx, dy) || 1e-3
				if (d < want) {
					const push = (want - d) / 2 / d
					hx[p] -= dx * push
					hy[p] -= dy * push
					hx[q] += dx * push
					hy[q] += dy * push
				}
			}
		if (pass % 10 === 9) await tick()
	}
	const hubs = new Map<number, Hub & { mean: Float32Array }>()
	ids.forEach((d, j) => {
		const idx = (members.get(d) as number[]).sort(
			(p, q) => pool.pop[q] - pool.pop[p],
		)
		idx.forEach((i, m) => {
			const ang = m * 2.39996
			const rr = 17 + 7.2 * Math.sqrt(m + 0.5)
			X[i] = hx[j] + Math.cos(ang) * rr
			Y[i] = hy[j] + Math.sin(ang) * rr
		})
		const p = pool.people.get(d) as Person
		hubs.set(d, {
			id: d,
			name: p.name,
			profile: p.profile,
			x: hx[j],
			y: hy[j],
			r: hr[j],
			count: idx.length,
			mean: means[j],
		})
	})
	return { X, Y, meta: { kind: "people" }, hubs }
}

function getLayout(ctx: Ctx, id: LayoutId): Promise<Layout> {
	const personal = id === "rings"
	const key = `${ctx.pool.country}|${id}${personal ? `|${ctx.key}` : ""}`
	let p = cache.layouts.get(key)
	if (!p) {
		const build = {
			zoom: zoomLayout,
			eras: erasLayout,
			moods: moodsLayout,
			people: peopleLayout,
			rings: (pool: Pool) => ringsLayout(pool, ctx),
		}[id]
		p = build(ctx.pool).catch((e) => {
			cache.layouts.delete(key)
			throw e
		})
		cache.layouts.set(key, p)
	}
	return p
}

// ---------------------------------------------------------------- filters, wire, pyramid

type Filters = { mine: boolean; notSeen: boolean }
const eligible = (ctx: Ctx, i: number, f: Filters) =>
	ctx.seen[i] !== 2 &&
	!(f.notSeen && ctx.seen[i] === 1) &&
	!(f.mine && !ctx.onMine[i])

// Variants of a service (e.g. "Netflix with ads") count as the service itself.
const DUP_TO_BASE = new Map(
	Object.entries(duplicateProviderMapping as Record<string, number[]>).flatMap(
		([base, dups]) => dups.map((d) => [d, Number(base)] as const),
	),
)
const r1 = (v: number) => Math.round(v * 10) / 10
function wire(ctx: Ctx, i: number, lay?: Layout, level?: number): W {
	const t = ctx.pool.titles[i]
	const w: W = {
		k: t.k,
		t: t.t,
		yr: t.yr,
		p: t.p,
		b: t.b,
		g: t.g.slice(0, 2),
		s: t.s,
		m: ctx.match[i],
		a: [
			...new Set(
				t.svc.map((id) =>
					ctx.relevant.has(DUP_TO_BASE.get(id) ?? -1)
						? (DUP_TO_BASE.get(id) as number)
						: id,
				),
			),
		].filter((id) => ctx.relevant.has(id)),
		f:
			(ctx.onMine[i] ? 1 : 0) |
			(ctx.seen[i] === 1 ? 2 : 0) |
			(ctx.want[i] ? 4 : 0),
	}
	if (ctx.rating[i]) w.r = ctx.rating[i]
	if (lay && Number.isFinite(lay.X[i])) {
		w.x = r1(lay.X[i])
		w.y = r1(lay.Y[i])
	}
	if (level != null) w.l = level
	if (t.dirs.length) w.d = t.dirs[0]
	return w
}

type Pyramid = { level: Uint8Array; tiles: Map<string, number[]>; at: number }

/** Which zoom level each title first appears at: the best title per screen cell, cells halving each level. */
function getPyramid(ctx: Ctx, id: LayoutId, lay: Layout, f: Filters): Pyramid {
	const key = `${ctx.key}|${ctx.pool.country}|${id}|${f.mine ? 1 : 0}${f.notSeen ? 1 : 0}|${CELL_PX}`
	const hit = cache.pyramids.get(key)
	if (hit) return hit
	const n = ctx.pool.n
	const level = new Uint8Array(n).fill(255)
	const order: number[] = []
	for (let i = 0; i < n; i++)
		if (Number.isFinite(lay.X[i]) && eligible(ctx, i, f)) order.push(i)
	order.sort((a, b) => ctx.prio[b] - ctx.prio[a])
	for (let L = 0; L < LMAX; L++) {
		const cell = CELL_PX / (S0 * 2 ** L)
		const taken = new Set<number>()
		for (const i of order) {
			const key2 =
				Math.floor(lay.X[i] / cell) * 100003 + Math.floor(lay.Y[i] / cell)
			if (level[i] < L) taken.add(key2)
		}
		for (const i of order) {
			if (level[i] !== 255) continue
			const key2 =
				Math.floor(lay.X[i] / cell) * 100003 + Math.floor(lay.Y[i] / cell)
			if (taken.has(key2)) continue
			taken.add(key2)
			level[i] = L
		}
	}
	for (const i of order) if (level[i] === 255) level[i] = LMAX
	const tiles = new Map<string, number[]>()
	for (const i of order) {
		const L = level[i]
		const T = tileSize(L)
		const k2 = `${L}_${Math.floor(lay.X[i] / T)}_${Math.floor(lay.Y[i] / T)}`
		const l = tiles.get(k2)
		if (l) l.push(i)
		else tiles.set(k2, [i])
	}
	const p = { level, tiles, at: Date.now() }
	cache.pyramids.set(key, p)
	if (cache.pyramids.size > 40) {
		const oldest = [...cache.pyramids.entries()].sort(
			(a, b) => a[1].at - b[1].at,
		)[0]
		cache.pyramids.delete(oldest[0])
	}
	return p
}

/** Where "You" sits in a layout: the densest spot among your best matches, not their average. */
function youIn(ctx: Ctx, lay: Layout, f: Filters) {
	const top: number[] = []
	const order = Array.from({ length: ctx.pool.n }, (_, i) => i).sort(
		(a, b) => ctx.sims[b] - ctx.sims[a],
	)
	for (const i of order) {
		if (!Number.isFinite(lay.X[i]) || !eligible(ctx, i, f)) continue
		top.push(i)
		if (top.length >= 30) break
	}
	if (!top.length) return { x: 0, y: 0 }
	let best = top[0]
	let bestN = -1
	const rad = 90
	for (const a of top) {
		let c = 0
		for (const b of top)
			if (Math.hypot(lay.X[a] - lay.X[b], lay.Y[a] - lay.Y[b]) < rad) c++
		if (c > bestN) {
			bestN = c
			best = a
		}
	}
	const near = top.filter(
		(b) => Math.hypot(lay.X[best] - lay.X[b], lay.Y[best] - lay.Y[b]) < rad,
	)
	return {
		x: r1(near.reduce((s, i) => s + lay.X[i], 0) / near.length),
		y: r1(near.reduce((s, i) => s + lay.Y[i], 0) / near.length),
	}
}

// ---------------------------------------------------------------- neighborhoods

function nearestTo(
	ctx: Ctx,
	target: Float32Array | Float64Array,
	count: number,
	f: Filters,
	skip: Set<number>,
	tasteBonus = 0.06,
) {
	const out: { i: number; c: number }[] = []
	const { U, n } = ctx.pool
	let len = 0
	for (let d = 0; d < DD; d++) len += target[d] * target[d]
	len = Math.sqrt(len) || 1
	for (let i = 0; i < n; i++) {
		if (skip.has(i) || !eligible(ctx, i, f)) continue
		let c = 0
		for (let d = 0; d < DD; d++) c += U[i * DD + d] * target[d]
		c = c / len + tasteBonus * ctx.sims[i] + 0.04 * ctx.pool.pop[i]
		if (out.length < count || c > out[out.length - 1].c) {
			out.push({ i, c })
			out.sort((a, b) => b.c - a.c)
			if (out.length > count) out.pop()
		}
	}
	return out.map((o) => o.i)
}

function reasons(ctx: Ctx, i: number) {
	const { Z } = ctx.pool
	return KEYS.map((key, k) => ({
		key,
		pull: Z[i * K + k] * ctx.taste[k],
		zk: Z[i * K + k],
	}))
		.filter((r) => r.zk > 0.4 && r.pull > 0 && !CRAFT_KEYS.has(r.key))
		.sort((a, b) => b.pull - a.pull)
		.slice(0, 3)
		.map((r) => r.key)
}

function why(ctx: Ctx, i: number) {
	const r = reasons(ctx, i).slice(0, 2).map(phrase).join(" and ")
	let like: number | null = null
	let best = -1
	const { U } = ctx.pool
	for (const l of ctx.loved) {
		if (l === i) continue
		let c = 0
		for (let d = 0; d < DD; d++) c += U[i * DD + d] * U[l * DD + d]
		if (c > best) {
			best = c
			like = l
		}
	}
	const text = [r, like != null ? `like ${ctx.pool.titles[like].t}` : ""]
		.filter(Boolean)
		.join(", ")
	return text.charAt(0).toUpperCase() + text.slice(1)
}

/** The room you reach by walking a path of directions from your taste, and what it's called. */
function rooms(ctx: Ctx, path: string[], f: Filters, size: number) {
	const used = new Set<number>()
	const target = Float64Array.from(ctx.tasteD)
	const out: { dir: string | null; items: number[]; name: string }[] = []
	const step = (dirId: string) => {
		const dir = DIRECTIONS.find((d) => d.id === dirId)
		if (!dir) return
		const v = new Float64Array(DD)
		for (const [k, w] of dir.keys) {
			const d = DESC.indexOf(KEYS.indexOf(k))
			if (d >= 0) v[d] += w
		}
		let l = 0
		for (let d = 0; d < DD; d++) l += v[d] * v[d]
		l = Math.sqrt(l) || 1
		for (let d = 0; d < DD; d++) target[d] += (0.55 * v[d]) / l
	}
	const build = (dir: string | null) => {
		const items = nearestTo(ctx, target, size, f, used, 0.02)
		for (const i of items) used.add(i)
		const c = new Float64Array(DD)
		for (const i of items)
			for (let d = 0; d < DD; d++)
				c[d] += ctx.pool.ZD[i * DD + d] / items.length
		out.push({ dir, items, name: nameFor(c, null).name })
	}
	build(null)
	for (const d of path) {
		step(d)
		build(d)
	}
	return out
}

// ---------------------------------------------------------------- public

export async function getExplorer2(request: Request): Promise<Loaded> {
	const url = new URL(request.url)
	const variant = url.searchParams.get("variant") ?? "zoom"
	const ctx = await getCtx(request)
	const layoutId = (
		{
			zoom: "zoom",
			rings: "rings",
			eras: "eras",
			moods: "moods",
			people: "people",
		} as Record<string, LayoutId>
	)[variant]
	const f: Filters = { mine: ctx.services.some((s) => s.mine), notSeen: true }
	let meta: LayoutMeta | null = null
	let you = { x: 0, y: 0 }
	if (layoutId) {
		const lay = await getLayout(ctx, layoutId)
		meta = lay.meta
		you = layoutId === "rings" ? { x: 0, y: 0 } : youIn(ctx, lay, f)
	}
	return { who: ctx.who, services: ctx.services, meta, you, variant }
}

const hubWire = (h: Hub) => ({
	id: h.id,
	name: h.name,
	profile: h.profile,
	x: r1(h.x),
	y: r1(h.y),
	r: r1(h.r),
	count: h.count,
})

export async function explorer2Api(request: Request) {
	const url = new URL(request.url)
	const q = url.searchParams
	const op = q.get("op")
	const ctx = await getCtx(request)
	const f: Filters = {
		mine: q.get("mine") === "1",
		notSeen: q.get("ns") !== "0",
	}
	const t0 = performance.now()
	const done = <X extends object>(x: X) => ({
		...x,
		ms: Math.round((performance.now() - t0) * 10) / 10,
	})

	if (op === "tiles") {
		const id = q.get("layout") as LayoutId
		const lay = await getLayout(ctx, id)
		const pyr = getPyramid(ctx, id, lay, f)
		const items: W[] = []
		for (const t of (q.get("t") ?? "").split(",").slice(0, 80)) {
			for (const i of pyr.tiles.get(t) ?? [])
				items.push(wire(ctx, i, lay, pyr.level[i]))
			if (items.length > 2500) break
		}
		return done({ items })
	}
	if (op === "you") {
		const id = q.get("layout") as LayoutId
		const lay = await getLayout(ctx, id)
		return done({ you: id === "rings" ? { x: 0, y: 0 } : youIn(ctx, lay, f) })
	}
	if (op === "start") {
		const n = Math.min(40, Number(q.get("n") ?? 16))
		const items = nearestTo(ctx, ctx.tasteD, n, f, new Set(), 0.3)
		return done({ items: items.map((i) => wire(ctx, i)) })
	}
	if (op === "near") {
		const i = ctx.pool.index.get(q.get("k") ?? "")
		if (i == null) return done({ items: [] })
		const n = Math.min(40, Number(q.get("n") ?? 12))
		const target = ctx.pool.U.subarray(i * DD, i * DD + DD)
		const items = nearestTo(ctx, target, n, f, new Set([i]), 0.05)
		return done({ items: items.map((j) => wire(ctx, j)) })
	}
	if (op === "room") {
		const path = (q.get("path") ?? "").split(",").filter(Boolean).slice(0, 30)
		const rs = rooms(ctx, path, f, Math.min(24, Number(q.get("n") ?? 15)))
		const last = rs[rs.length - 1]
		// Directions that still lead somewhere new from here, with a preview of what's there.
		return done({ name: last.name, items: last.items.map((i) => wire(ctx, i)) })
	}
	if (op === "peek") {
		const i = ctx.pool.index.get(q.get("k") ?? "")
		if (i == null) return done({ why: "", people: [] })
		const t = ctx.pool.titles[i]
		return done({
			why: why(ctx, i),
			people: t.dirs
				.slice(0, 2)
				.map((d) => ctx.pool.people.get(d)?.name ?? "")
				.filter(Boolean),
			role: t.type === "show" ? "Created by" : "Directed by",
		})
	}
	if (op === "people-start") {
		const lay = await getLayout(ctx, "people")
		const hubs = lay.hubs as Map<number, Hub & { mean: Float32Array }>
		const score = new Map<number, number>()
		for (const [k, s] of Object.entries(ctx.signals)) {
			if (s.kind !== "score" || s.score < 7) continue
			const i = ctx.pool.index.get(k)
			if (i == null) continue
			for (const d of ctx.pool.titles[i].dirs)
				if (hubs.has(d)) score.set(d, (score.get(d) ?? 0) + (s.score - 6))
		}
		if (score.size < 3) {
			const top = nearestTo(
				ctx,
				ctx.tasteD,
				60,
				{ mine: false, notSeen: false },
				new Set(),
				0.3,
			)
			for (const i of top)
				for (const d of ctx.pool.titles[i].dirs)
					if (hubs.has(d)) score.set(d, (score.get(d) ?? 0) + 0.5)
		}
		const ids = [...score.entries()]
			.sort((a, b) => b[1] - a[1])
			.slice(0, Number(q.get("n") ?? 3))
			.map(([d]) => d)
		return done({ hubs: ids.map((d) => hubWire(hubs.get(d) as Hub)) })
	}
	if (op === "director") {
		const lay = await getLayout(ctx, "people")
		const hubs = lay.hubs as Map<number, Hub & { mean: Float32Array }>
		const h = hubs.get(Number(q.get("id")))
		if (!h) return done({ hub: null, items: [], near: [] })
		const items: W[] = []
		for (let i = 0; i < ctx.pool.n; i++) {
			if (
				!Number.isFinite(lay.X[i]) ||
				!ctx.pool.titles[i].dirs.includes(h.id) ||
				!eligible(ctx, i, f)
			)
				continue
			if (Math.hypot(lay.X[i] - h.x, lay.Y[i] - h.y) > h.r + 4) continue
			items.push(wire(ctx, i, lay))
		}
		// Nearest directors by what their work is like.
		const hl = Math.sqrt(h.mean.reduce((s, x) => s + x * x, 0)) || 1
		const near = [...hubs.values()]
			.filter((o) => o.id !== h.id)
			.map((o) => {
				let d = 0
				let l = 0
				for (let k = 0; k < DD; k++) {
					d += o.mean[k] * h.mean[k]
					l += o.mean[k] * o.mean[k]
				}
				return {
					o,
					c: d / (hl * (Math.sqrt(l) || 1)) + 0.002 * Math.sqrt(o.count),
				}
			})
			.sort((a, b) => b.c - a.c)
			.slice(0, Number(q.get("near") ?? 5))
			.map((e) => hubWire(e.o))
		return done({ hub: hubWire(h), items, near })
	}
	throw new Response("Unknown op", { status: 400 })
}
