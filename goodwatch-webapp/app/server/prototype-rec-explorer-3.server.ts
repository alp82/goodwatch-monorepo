// PROTOTYPE - throwaway. Turns for /prototype/rec-explorer-3 (#180, round 3): few titles, distinct turns, no repeats.
// Reuses round 2's in-memory pool (~12,000 titles with their title analysis) and its nested-map layout, both reached
// through round 2's public loader so they build once and are shared. This file adds one read-only question per
// variant: from where the person stands, which few turns lead somewhere clearly different, and what does each change?
// Every turn is picked so its titles are far apart from the other turns' (greedy max-min over the title analysis),
// never repeats a title the page already showed, and never walks back to ground the path already covered.
// ?as=me (the default when signed in) reads the member's ratings, Wishlist, history, and services; ?as=demo, or signed
// out, uses the Taste prototype's demo member; ?as=<uuid> works on localhost in development only. Only SELECTs.
import { getExplorer2 } from "~/server/prototype-rec-explorer-2.server"
import { getUserSettings } from "~/server/user-settings.server"
import { VALID_FINGERPRINT_KEYS } from "~/server/utils/fingerprint"
import type { LayoutMeta } from "~/ui/prototype-rec-explorer-2/wire"
import type {
	Loaded3,
	Opt,
	Turn,
	W,
	Who,
	ZoomNode,
	ZoomRes,
} from "~/ui/prototype-rec-explorer-3/wire"
import { DIRECTIONS } from "~/ui/prototype-rec-explorer/model"
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

const KEYS = [...VALID_FINGERPRINT_KEYS] as string[]
const K = KEYS.length
const DESC = KEYS.map((k, i) => [k, i] as const)
	.filter(([k]) => !CRAFT_KEYS.has(k) && k !== "homage_and_reference")
	.map(([, i]) => i)
const DD = DESC.length
const COMMON_SERVICES = [8, 9, 337, 350, 1899, 531, 30, 283, 15, 384]

// ---------------------------------------------------------------- round 2's pool and layout

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
type Pool = {
	country: string
	titles: T[]
	index: Map<string, number>
	n: number
	mean: Float64Array
	sd: Float64Array
	Z: Float32Array
	ZD: Float32Array
	U: Float32Array
	pop: Float32Array
	people: Map<number, { id: number; name: string; profile: string }>
}
type Layout = { X: Float32Array; Y: Float32Array; meta: LayoutMeta }
type R2Cache = {
	pools: Map<string, Promise<Pool>>
	layouts: Map<string, Promise<Layout>>
}
const r2 = () => (globalThis as unknown as { __rx2?: R2Cache }).__rx2

/** Round 2's pool for a country, built through round 2's own loader the first time. */
async function poolFor(country: string): Promise<Pool> {
	let p = r2()?.pools.get(country)
	if (!p) {
		await getExplorer2(
			new Request(
				`http://localhost/prototype/rec-explorer-2?as=demo&country=${encodeURIComponent(country)}`,
			),
		)
		p = r2()?.pools.get(country)
	}
	if (!p) throw new Error("Round 2 pool unavailable")
	return p
}
async function zoomLayoutFor(country: string): Promise<Layout> {
	let p = r2()?.layouts.get(`${country}|zoom`)
	if (!p) {
		await getExplorer2(
			new Request(
				`http://localhost/prototype/rec-explorer-2?as=demo&variant=zoom&country=${encodeURIComponent(country)}`,
			),
		)
		p = r2()?.layouts.get(`${country}|zoom`)
	}
	if (!p) throw new Error("Round 2 layout unavailable")
	return p
}

// ---------------------------------------------------------------- the viewer

type Ctx = {
	key: string
	pool: Pool
	who: Who
	services: Service[]
	relevant: Set<number>
	signals: Record<string, Signal>
	taste: Float32Array
	sims: Float32Array
	pct: Float32Array
	match: Uint8Array
	seen: Uint8Array
	rating: Uint8Array
	want: Uint8Array
	onMine: Uint8Array
	q: Float32Array // how good a pick this is for the person: taste, score, how well known
	loved: number[]
	youU: Float64Array // the person's taste as a unit vector over the descriptive attributes
	youZ: Float64Array // the average of their closest titles, for describing turns from "your taste"
}

type Cache = {
	ctx: Map<string, { at: number; p: Promise<Ctx> }>
	zoom: Map<string, Promise<ZoomIndex>>
}
const G = globalThis as unknown as { __rx3?: Cache }
const cache: Cache = (G.__rx3 ??= { ctx: new Map(), zoom: new Map() })

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
			"SELECT tmdb_id, media_type FROM user_watch_state WHERE user_id = ? AND state <> 'not_started' LIMIT 5000",
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

async function whoFor(request: Request) {
	const url = new URL(request.url)
	const as = url.searchParams.get("as") ?? "me"
	const dev =
		/^[0-9a-f-]{36}$/.test(as) &&
		url.hostname === "localhost" &&
		process.env.NODE_ENV !== "production"
	const signedIn = await getUserIdFromRequest({ request }).catch(
		() => undefined,
	)
	const userId = dev ? as : as === "demo" ? undefined : signedIn
	return { userId, signedIn: !!signedIn, dev }
}

async function buildCtx(
	key: string,
	url: URL,
	userId: string | undefined,
	signedIn: boolean,
): Promise<Ctx> {
	const asMe = !!userId
	const settings = (
		userId ? await getUserSettings({ userId }).catch(() => ({})) : {}
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
		poolFor(country),
		userId ? memberSignals(userId) : Promise.resolve({ ...DEMO_RATINGS }),
	])
	const n = pool.n

	// Taste over all attributes, as round 2 builds it (titles outside the pool count too).
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
	const q = new Float32Array(n)
	for (let i = 0; i < n; i++) {
		if (pool.titles[i].svc.some((id) => mine.has(id))) onMine[i] = 1
		q[i] = 0.5 * pct[i] + 0.3 * (pool.titles[i].s / 100) + 0.2 * pool.pop[i]
	}
	const loved = Object.entries(signals)
		.filter(([, s]) => s.kind === "score" && s.score >= 8)
		.map(([k]) => pool.index.get(k))
		.filter((i): i is number => i != null)

	// "Your taste" as a place: the average of your 40 closest titles.
	const youZ = new Float64Array(DD)
	const top = order.slice(-40)
	for (const i of top)
		for (let d = 0; d < DD; d++) youZ[d] += pool.ZD[i * DD + d] / top.length
	const youU = unit(youZ)

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
	const who: Who = {
		mode: asMe ? "me" : "demo",
		country,
		demoServices: !(asMe && saved.length),
		signedIn,
		rated: Object.values(signals).filter((s) => s.kind === "score").length,
		pool: n,
	}
	return {
		key,
		pool,
		who,
		services,
		relevant: new Set(services.map((s) => s.id)),
		signals,
		taste,
		sims,
		pct,
		match,
		seen,
		rating,
		want,
		onMine,
		q,
		loved,
		youU,
		youZ,
	}
}

async function getCtx(request: Request): Promise<Ctx> {
	const url = new URL(request.url)
	const { userId, signedIn } = await whoFor(request)
	const key = `${userId ?? "demo"}|${url.searchParams.get("country") ?? ""}`
	const hit = cache.ctx.get(key)
	if (hit && Date.now() - hit.at < 10 * 60_000) return hit.p
	const p = buildCtx(key, url, userId, signedIn).catch((e) => {
		cache.ctx.delete(key)
		throw e
	})
	cache.ctx.set(key, { at: Date.now(), p })
	return p
}

// ---------------------------------------------------------------- vectors

function unit(v: ArrayLike<number>) {
	const out = new Float64Array(DD)
	let l = 0
	for (let d = 0; d < DD; d++) l += v[d] * v[d]
	l = Math.sqrt(l) || 1
	for (let d = 0; d < DD; d++) out[d] = v[d] / l
	return out
}
const cosTo = (pool: Pool, i: number, v: Float64Array) => {
	let c = 0
	const o = i * DD
	for (let d = 0; d < DD; d++) c += pool.U[o + d] * v[d]
	return c
}
const cosIJ = (pool: Pool, i: number, j: number) => {
	let c = 0
	for (let d = 0; d < DD; d++) c += pool.U[i * DD + d] * pool.U[j * DD + d]
	return c
}
const rowU = (pool: Pool, i: number) =>
	Float64Array.from(pool.U.subarray(i * DD, i * DD + DD))
const rowZ = (pool: Pool, i: number) =>
	Float64Array.from(pool.ZD.subarray(i * DD, i * DD + DD))
function meanZ(pool: Pool, idx: number[]) {
	const c = new Float64Array(DD)
	for (const i of idx)
		for (let d = 0; d < DD; d++) c[d] += pool.ZD[i * DD + d] / idx.length
	return c
}
/** A direction over the descriptive attributes from attribute weights. */
function dirVec(keys: [string, number][]) {
	const v = new Float64Array(DD)
	for (const [k, w] of keys) {
		const d = DESC.indexOf(KEYS.indexOf(k))
		if (d >= 0) v[d] += w
	}
	return unit(v)
}
const dot = (a: Float64Array, b: Float64Array) => {
	let s = 0
	for (let d = 0; d < DD; d++) s += a[d] * b[d]
	return s
}
const r2d = (x: number) => Math.round(x * 1000) / 1000

// ---------------------------------------------------------------- words

// How a rise in an attribute reads as a turn. Humor attributes share "funnier" so a turn never says it twice.
const UP: Record<string, string> = {
	bleakness: "darker",
	hopefulness: "more hopeful",
	wholesome: "warmer",
	slow_burn: "slower",
	fast_pace: "faster",
	adrenaline: "more thrilling",
	tension: "tenser",
	intrigue: "more intriguing",
	mystery: "more mysterious",
	scare: "scarier",
	uncanny: "eerier",
	violence: "more violent",
	grotesque: "more grotesque",
	dark_humor: "more darkly funny",
	situational_comedy: "more situational humor",
	wit_wordplay: "wittier",
	absurdist_humor: "more absurd",
	physical_comedy: "more slapstick",
	satire_parody: "more satirical",
	cringe_humor: "more awkward humor",
	romance: "more romantic",
	eroticism: "sexier",
	wonder: "more wondrous",
	fantasy: "more fantastical",
	futuristic: "more futuristic",
	spectacle: "more spectacular",
	world_immersion: "more immersive",
	pathos: "sadder",
	melancholy: "more melancholy",
	catharsis: "more cathartic",
	nostalgia: "more nostalgic",
	complexity: "more complex",
	philosophical: "more philosophical",
	surrealism: "stranger",
	eccentricity: "quirkier",
	psychedelic: "trippier",
	novelty: "more unexpected",
	non_linear_narrative: "less chronological",
	meta_narrative: "more meta",
	contemporary_realism: "more grounded",
	biographical: "more about real people's lives",
	historical: "more historical",
	crime: "more about crime",
	warfare: "more war-torn",
	political: "more political",
	sports: "sportier",
	coming_of_age: "more about growing up",
	family_dynamics: "more about family",
	psychological: "more psychological",
	social_commentary: "more social critique",
	class_and_capitalism: "more about class and inequality",
	technology_and_humanity: "more about technology’s human impact",
	spiritual: "more spiritual",
	character_depth: "more nuanced characters",
	ambiguity: "more open to interpretation",
	visual_stylization: "more stylized",
	camp_and_irony: "campier",
	dialogue_centrality: "talkier",
	music_centrality: "more shaped by the soundtrack",
	showbiz: "more about showbiz",
}
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const decade = (yr: number) => `${Math.floor(yr / 10) * 10}s`

/** The attributes that rise most from one place to another, as turn words, strongest first. */
function risers(from: Float64Array, to: Float64Array, min = 0.3) {
	const byWord = new Map<string, number>()
	for (let d = 0; d < DD; d++) {
		const word = UP[KEYS[DESC[d]]]
		if (!word) continue
		const v = to[d] - from[d]
		if (v < min) continue
		if (v > (byWord.get(word) ?? 0)) byWord.set(word, v)
	}
	return [...byWord.entries()].sort((a, b) => b[1] - a[1]).map(([w]) => w)
}
/** What two places share: attributes strong in both. */
function keeps(a: Float64Array, b: Float64Array, n = 1) {
	return Array.from({ length: DD }, (_, d) => ({
		key: KEYS[DESC[d]],
		v: Math.min(a[d], b[d]),
	}))
		.filter((e) => e.v > 0.6)
		.sort((x, y) => y.v - x.v)
		.slice(0, n)
		.map((e) => phrase(e.key))
}
const median = (xs: number[]) => {
	const s = xs.filter(Boolean).sort((a, b) => a - b)
	return s.length ? s[Math.floor(s.length / 2)] : 0
}
/** Extras a turn carries beyond mood, as one short phrase: another era, another format, or both. */
function extras(
	fromYr: number,
	toYr: number,
	fromType: string | null,
	toType: string | null,
) {
	const era = !!(fromYr && toYr && Math.abs(toYr - fromYr) >= 15)
	const fmt = !!(fromType && toType && fromType !== toType)
	const kind = toType === "show" ? "series" : "film"
	if (era && fmt) return [`a ${decade(toYr)} ${kind}`]
	if (era) return [`from the ${decade(toYr)}`]
	if (fmt) return [`as a ${kind}`]
	return []
}
/** The sentence under a label: only what the label doesn't already say. */
function sentence(label: string, words: string[], ex: string[], kept: string[]) {
	const l = label.toLowerCase()
	const rest = words.filter((w) => !l.includes(w)).slice(0, 2)
	const parts: string[] = []
	if (rest.length) parts.push(`Also ${rest.join(" and ")}${ex.length ? `, ${ex[0]}` : ""}.`)
	else if (ex.length) parts.push(`${cap(ex[0])}.`)
	if (kept.length) parts.push(`Keeps ${kept.join(" and ")}.`)
	return parts.join(" ")
}

/** Pick up to two words for a label, skipping words other turns already lead with. */
function labelFrom(words: string[], taken: Set<string>, fallback: string) {
	const free = words.filter((w) => !taken.has(w))
	const pick = (free.length ? free : words).slice(0, 2)
	if (!pick.length) return fallback
	taken.add(pick[0])
	return cap(pick.join(" and "))
}

// ---------------------------------------------------------------- candidates

type Filters = { mine: boolean; notSeen: boolean }
const eligible = (ctx: Ctx, i: number, f: Filters) =>
	ctx.seen[i] !== 2 &&
	!(f.notSeen && ctx.seen[i] === 1) &&
	!(f.mine && !ctx.onMine[i])

type Session = {
	f: Filters
	shown: Set<number>
	names: Set<string> // two titles with one name read as a repeat
	path: number[] // titles the person stood on, oldest first
}
function sessionOf(ctx: Ctx, q: URLSearchParams): Session {
	const keys = (name: string) =>
		(q.get(name) ?? "")
			.split(",")
			.filter(Boolean)
			.slice(0, 400)
			.map((k) => ctx.pool.index.get(k))
			.filter((i): i is number => i != null)
	const shown = new Set(keys("shown"))
	return {
		f: { mine: q.get("mine") === "1", notSeen: q.get("ns") !== "0" },
		shown,
		names: new Set([...shown].map((i) => ctx.pool.titles[i].t)),
		path: keys("path"),
	}
}
/** Marks a title as on screen, so nothing with its name shows again either. */
const show = (ctx: Ctx, s: Session, i: number) => {
	s.shown.add(i)
	s.names.add(ctx.pool.titles[i].t)
}

/** Titles that could appear: pass the filters, not shown yet, decent, and not back on ground the path covered. */
function candidates(ctx: Ctx, s: Session, novelty = 0.82, minScore = 55) {
	const out: number[] = []
	const { pool } = ctx
	const pathU = s.path.slice(-6)
	for (let i = 0; i < pool.n; i++) {
		if (s.shown.has(i) || !eligible(ctx, i, s.f)) continue
		if (s.names.has(pool.titles[i].t)) continue
		if (pool.titles[i].s < minScore) continue
		let back = false
		for (const p of pathU)
			if (cosIJ(pool, i, p) > novelty) {
				back = true
				break
			}
		if (!back) out.push(i)
	}
	return out
}

/** Greedy max-min: each next pick is as far as possible from the ones already picked, nudged by quality. */
function farthest(
	ctx: Ctx,
	pool: number[],
	k: number,
	first: number | null,
	qw = 0.3,
) {
	const picked: number[] = first != null ? [first] : []
	const minD = new Float64Array(pool.length).fill(2)
	for (const p of picked)
		pool.forEach((i, j) => {
			minD[j] = Math.min(minD[j], 1 - cosIJ(ctx.pool, i, p))
		})
	while (picked.length < k) {
		let best = -1
		let bs = Number.NEGATIVE_INFINITY
		pool.forEach((i, j) => {
			if (picked.includes(i)) return
			const s = (picked.length ? minD[j] : 0) + qw * ctx.q[i]
			if (s > bs) {
				bs = s
				best = j
			}
		})
		if (best < 0) break
		const b = pool[best]
		picked.push(b)
		pool.forEach((i, j) => {
			minD[j] = Math.min(minD[j], 1 - cosIJ(ctx.pool, i, b))
		})
	}
	return picked
}
const spreadOf = (ctx: Ctx, idx: number[]) => {
	let s = 0
	let n = 0
	for (let a = 0; a < idx.length; a++)
		for (let b = a + 1; b < idx.length; b++) {
			s += 1 - cosIJ(ctx.pool, idx[a], idx[b])
			n++
		}
	return n ? r2d(s / n) : 0
}

// ---------------------------------------------------------------- wire

const DUP_TO_BASE = new Map(
	Object.entries(duplicateProviderMapping as Record<string, number[]>).flatMap(
		([base, dups]) => dups.map((d) => [d, Number(base)] as const),
	),
)
function wire(ctx: Ctx, i: number): W {
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
	if (t.dirs.length) w.d = t.dirs[0]
	return w
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
	for (const l of ctx.loved) {
		if (l === i) continue
		const c = cosIJ(ctx.pool, i, l)
		if (c > best) {
			best = c
			like = l
		}
	}
	const text = [r, like != null ? `like ${ctx.pool.titles[like].t}` : ""]
		.filter(Boolean)
		.join(", ")
	return cap(text)
}

// ---------------------------------------------------------------- where the person stands

type Anchor = {
	i: number | null
	U: Float64Array
	Z: Float64Array
	yr: number
	type: string | null
}
function anchorOf(ctx: Ctx, i: number | null): Anchor {
	if (i == null)
		return { i: null, U: ctx.youU, Z: ctx.youZ, yr: 0, type: null }
	const t = ctx.pool.titles[i]
	return {
		i,
		U: rowU(ctx.pool, i),
		Z: rowZ(ctx.pool, i),
		yr: t.yr,
		type: t.type,
	}
}
/** Your closest unseen title that is also good and reasonably known: where title-anchored walks begin. */
function startTitle(ctx: Ctx, s: Session) {
	let best = -1
	let bs = Number.NEGATIVE_INFINITY
	for (const i of candidates(ctx, s, 2, 68)) {
		if (ctx.pool.pop[i] < 0.35) continue
		const v = 0.75 * ctx.pct[i] + 0.25 * (ctx.pool.titles[i].s / 100)
		if (v > bs) {
			bs = v
			best = i
		}
	}
	return best >= 0 ? best : null
}
const hereAt = (ctx: Ctx, q: URLSearchParams) => {
	const k = q.get("at")
	return k ? (ctx.pool.index.get(k) ?? null) : null
}

// ---------------------------------------------------------------- the turns

/** Titles close to a lead, closer to it than to the other leads: a small, readable cluster. */
function companions(
	ctx: Ctx,
	cands: number[],
	lead: number,
	others: number[],
	used: Set<number>,
	n: number,
	minCos = 0.45,
) {
	const scored: { i: number; v: number }[] = []
	for (const i of cands) {
		if (used.has(i) || i === lead) continue
		const c = cosIJ(ctx.pool, i, lead)
		if (c < minCos) continue
		if (others.some((o) => cosIJ(ctx.pool, i, o) > c - 0.1)) continue
		scored.push({ i, v: c + 0.35 * ctx.q[i] })
	}
	scored.sort((a, b) => b.v - a.v)
	const out: number[] = []
	for (const s of scored) {
		// Companions differ a little from each other too.
		if (out.some((o) => cosIJ(ctx.pool, o, s.i) > 0.9)) continue
		out.push(s.i)
		used.add(s.i)
		if (out.length >= n) break
	}
	return out
}

/** Roads: three very different next steps, each a small cluster with a sentence. */
function roads(ctx: Ctx, s: Session, a: Anchor): Turn {
	const cands = candidates(ctx, s)
	const cs = cands
		.map((i) => ({ i, c: cosTo(ctx.pool, i, a.U) }))
		.sort((x, y) => y.c - x.c)
	// A coherent step: well inside the closest tenth, but not the look-alikes at the very top.
	const lo = Math.floor(cs.length * 0.004)
	const hi = Math.max(lo + 80, Math.floor(cs.length * 0.08))
	const band = cs
		.slice(lo, hi)
		.filter((e) => e.c < 0.8)
		.sort((x, y) => ctx.q[y.i] - ctx.q[x.i])
	const good = band.slice(0, Math.max(40, Math.floor(band.length * 0.6)))
	const leads = farthest(
		ctx,
		good.map((e) => e.i),
		3,
		null,
		0.35,
	)
	const used = new Set(leads)
	const taken = new Set<string>()
	const wide = cs.slice(0, Math.floor(cs.length * 0.2)).map((e) => e.i)
	const options: Opt[] = leads.map((lead, j) => {
		const others = leads.filter((o) => o !== lead)
		const more = companions(ctx, wide, lead, others, used, 3)
		const items = [lead, ...more]
		const z = meanZ(ctx.pool, items)
		const yr = median(items.map((i) => ctx.pool.titles[i].yr))
		const words = risers(a.Z, z)
		const label = labelFrom(words, taken, "Close by")
		const ex = extras(a.yr || median(s.path.map((i) => ctx.pool.titles[i].yr)), yr, null, null)
		const line = sentence(label, words, ex, keeps(a.Z, z))
		return {
			id: `road-${j}`,
			label,
			line,
			items: items.map((i) => wire(ctx, i)),
			dist: r2d(1 - cosTo(ctx.pool, lead, a.U)),
		}
	})
	return {
		here: a.i == null ? null : wire(ctx, a.i),
		hereLine:
			a.i == null
				? "Your taste, from your ratings. Three roads lead out; each goes somewhere the others don't."
				: why(ctx, a.i),
		options,
		spread: spreadOf(ctx, leads),
	}
}

// Four compass directions come from two of these axes, whichever pair gives the most different four titles.
const AXES3: {
	id: string
	pos: [string, number][]
	neg: [string, number][]
	up: string
	down: string
}[] = [
	{
		id: "mood",
		pos: [
			["bleakness", 1],
			["melancholy", 0.6],
		],
		neg: [
			["hopefulness", 1],
			["wholesome", 0.7],
		],
		up: "Bleaker",
		down: "More hopeful",
	},
	{
		id: "pace",
		pos: [
			["fast_pace", 1],
			["adrenaline", 0.8],
		],
		neg: [["slow_burn", 1]],
		up: "Faster",
		down: "Slower",
	},
	{
		id: "nerve",
		pos: [
			["tension", 1],
			["scare", 0.6],
			["violence", 0.5],
		],
		neg: [["wholesome", 0.8]],
		up: "Tenser",
		down: "Gentler",
	},
	{
		id: "world",
		pos: [
			["fantasy", 1],
			["futuristic", 0.7],
			["wonder", 0.6],
		],
		neg: [
			["contemporary_realism", 1],
			["biographical", 0.4],
		],
		up: "More fantastical",
		down: "More grounded",
	},
	{
		id: "funny",
		pos: [
			["situational_comedy", 0.8],
			["wit_wordplay", 1],
			["absurdist_humor", 0.6],
		],
		neg: [
			["pathos", 1],
			["melancholy", 0.5],
		],
		up: "Funnier",
		down: "More serious",
	},
	{
		id: "mind",
		pos: [
			["complexity", 1],
			["philosophical", 0.8],
			["non_linear_narrative", 0.6],
		],
		neg: [
			["romance", 1],
			["wholesome", 0.5],
		],
		up: "More cerebral",
		down: "More heartfelt",
	},
	{
		id: "odd",
		pos: [
			["surrealism", 1],
			["eccentricity", 0.8],
			["psychedelic", 0.5],
		],
		neg: [
			["contemporary_realism", 0.8],
			["biographical", 0.5],
		],
		up: "Stranger",
		down: "Straighter",
	},
]
const AXIS_V = AXES3.map((ax) =>
	dirVec([...ax.pos, ...ax.neg.map(([k, w]) => [k, -w] as [string, number])]),
)

/** The best title one clear step along a direction: it moves that way a lot and still resembles here. */
function stepAlong(
	ctx: Ctx,
	cands: number[],
	a: Anchor,
	v: Float64Array,
	used: Set<number>,
	minGain = 1,
) {
	const base = dot(a.Z, v)
	let best = -1
	let bs = Number.NEGATIVE_INFINITY
	for (const i of cands) {
		if (used.has(i)) continue
		let g = 0
		for (let d = 0; d < DD; d++) g += ctx.pool.ZD[i * DD + d] * v[d]
		g -= base
		if (g < minGain) continue
		const c = cosTo(ctx.pool, i, a.U)
		if (c < 0.1 || c > 0.7) continue
		const s = 0.7 * c + 0.35 * Math.min(g, 3) + 0.45 * ctx.q[i]
		if (s > bs) {
			bs = s
			best = i
		}
	}
	return best >= 0 ? best : null
}

/** Compass: four opposing directions from the current title. */
function compass(ctx: Ctx, s: Session, a: Anchor, lastAxis: string | null): Turn {
	// Stricter about the ground already covered, so four turns in a row can't all stay in one corner.
	const cands = candidates(ctx, s, 0.7)
	const picks = AXES3.map((_, x) => {
		const v = AXIS_V[x]
		const neg = v.map((e) => -e) as Float64Array
		const used = new Set<number>()
		const up = stepAlong(ctx, cands, a, v, used)
		if (up != null) used.add(up)
		const down = stepAlong(ctx, cands, a, neg, used)
		return { x, up, down }
	})
	let best: { A: (typeof picks)[0]; B: (typeof picks)[0]; v: number } | null =
		null
	// The axis you just walked along isn't offered again right away: every turn opens new directions.
	const fresh = picks.filter((p) => AXES3[p.x].id !== lastAxis)
	for (let p = 0; p < fresh.length; p++)
		for (let r = p + 1; r < fresh.length; r++) {
			const A = fresh[p]
			const B = fresh[r]
			const four = [A.up, A.down, B.up, B.down]
			if (four.some((i) => i == null)) continue
			if (new Set(four).size < 4) continue
			const idx = four as number[]
			let mn = 2
			for (let u = 0; u < 4; u++)
				for (let w = u + 1; w < 4; w++)
					mn = Math.min(mn, 1 - cosIJ(ctx.pool, idx[u], idx[w]))
			// Near-orthogonal axes read as a real compass.
			const ortho = 1 - Math.abs(dot(AXIS_V[A.x], AXIS_V[B.x]))
			const v = mn + 0.2 * ortho
			if (!best || v > best.v) best = { A, B, v }
		}
	const options: Opt[] = []
	const leads: number[] = []
	if (best) {
		const used = new Set<number>()
		const four: [number, number, string, "n" | "e" | "s" | "w"][] = [
			[best.A.up as number, best.A.x, AXES3[best.A.x].up, "n"],
			[best.B.up as number, best.B.x, AXES3[best.B.x].up, "e"],
			[best.A.down as number, best.A.x, AXES3[best.A.x].down, "s"],
			[best.B.down as number, best.B.x, AXES3[best.B.x].down, "w"],
		]
		for (const [lead] of four) used.add(lead)
		for (const [lead, x, word, side] of four) {
			leads.push(lead)
			const v = side === "n" || side === "e" ? AXIS_V[x] : AXIS_V[x].map((e) => -e)
			const others = four.map((f) => f[0]).filter((o) => o !== lead)
			// One companion that goes the same way, so each arm reads as a direction, not a single title.
			const base = dot(a.Z, v as Float64Array)
			const more = companions(
				ctx,
				cands.filter((i) => {
					let g = 0
					for (let d = 0; d < DD; d++) g += ctx.pool.ZD[i * DD + d] * v[d]
					return g - base > 0.6
				}),
				lead,
				others,
				used,
				1,
				0.4,
			)
			const items = [lead, ...more]
			const z = meanZ(ctx.pool, items)
			const t = ctx.pool.titles[lead]
			const words = risers(a.Z, z).filter(
				(w) => w.toLowerCase() !== word.toLowerCase(),
			)
			const ex = extras(a.yr, t.yr, a.type, t.type)
			const line = sentence(word, words.slice(0, 1), ex, keeps(a.Z, rowZ(ctx.pool, lead)))
			options.push({
				id: `${AXES3[x].id}-${side}`,
				label: word,
				line,
				items: items.map((i) => wire(ctx, i)),
				dist: r2d(1 - cosTo(ctx.pool, lead, a.U)),
				side,
			})
		}
	}
	return {
		here: a.i == null ? null : wire(ctx, a.i),
		hereLine: a.i == null ? "" : why(ctx, a.i),
		options,
		spread: spreadOf(ctx, leads),
	}
}

/** Doors: from a room of five, the three directions whose rooms differ most from each other and from here. */
const OPPOSITE: Record<string, string> = {
	darker: "lighter",
	lighter: "darker",
	faster: "slower",
	slower: "faster",
	stranger: "grounded",
	grounded: "stranger",
	funnier: "tenser",
	tenser: "funnier",
}
function doors(
	ctx: Ctx,
	s: Session,
	room: number[],
	a: Anchor,
	last: string | null,
): Turn {
	const cands = candidates(ctx, s, 0.75)
	// The way you came in, and straight back, aren't new ground.
	const dirs = DIRECTIONS.filter(
		(d) => !last || (d.id !== last && d.id !== OPPOSITE[last]),
	)
	const preview = dirs.map((dir) => {
		const v = dirVec(dir.keys)
		const target = new Float64Array(DD)
		for (let d = 0; d < DD; d++) target[d] = a.U[d] + 1.3 * v[d]
		const tu = unit(target)
		const scored = cands
			.map((i) => ({ i, v: cosTo(ctx.pool, i, tu) + 0.15 * ctx.q[i] }))
			.sort((x, y) => y.v - x.v)
		const items: number[] = []
		for (const e of scored) {
			if (items.some((o) => cosIJ(ctx.pool, o, e.i) > 0.9)) continue
			items.push(e.i)
			if (items.length >= 5) break
		}
		// The lead is the best pick for the person among the room's five.
		items.sort((x, y) => ctx.q[y] - ctx.q[x])
		return { dir, items, U: unit(meanZ(ctx.pool, items)) }
	}).filter((p) => p.items.length >= 3)
	// Three doors, as far apart as possible, with no title behind two doors.
	let best: number[] = []
	let bv = Number.NEGATIVE_INFINITY
	for (let x = 0; x < preview.length; x++)
		for (let y = x + 1; y < preview.length; y++)
			for (let z = y + 1; z < preview.length; z++) {
				const trio = [preview[x], preview[y], preview[z]]
				const all = trio.flatMap((p) => p.items)
				if (new Set(all).size < all.length) continue
				const d = Math.min(
					1 - dot(trio[0].U, trio[1].U),
					1 - dot(trio[0].U, trio[2].U),
					1 - dot(trio[1].U, trio[2].U),
				)
				const away =
					trio.reduce((acc, p) => acc + (1 - dot(p.U, a.U)), 0) / 3
				const v = d + 0.3 * away
				if (v > bv) {
					bv = v
					best = [x, y, z]
				}
			}
	const options: Opt[] = best.map((x) => {
		const p = preview[x]
		const z = meanZ(ctx.pool, p.items)
		const yr = median(p.items.map((i) => ctx.pool.titles[i].yr))
		const fromYr = median(room.map((i) => ctx.pool.titles[i].yr))
		const words = risers(a.Z, z).filter(
			(w) => w !== p.dir.label.toLowerCase(),
		)
		const ex = extras(fromYr, yr, null, null)
		return {
			id: p.dir.id,
			label: p.dir.label,
			line: sentence(p.dir.label, words, ex, []),
			items: p.items.map((i) => wire(ctx, i)),
			dist: r2d(1 - cosTo(ctx.pool, p.items[0], a.U)),
		}
	})
	return {
		here: null,
		hereLine: "",
		options,
		spread: spreadOf(
			ctx,
			best.map((x) => preview[x].items[0]),
		),
	}
}

/** The room you start in: five of your closest titles, different from each other. */
function firstRoom(ctx: Ctx, s: Session) {
	const cands = candidates(ctx, s, 2, 62)
	const cs = cands
		.map((i) => ({ i, v: cosTo(ctx.pool, i, ctx.youU) + 0.35 * ctx.q[i] }))
		.sort((x, y) => y.v - x.v)
		.slice(0, 60)
		.map((e) => e.i)
	return farthest(ctx, cs, 5, cs[0] ?? null, 0.6)
}

/** Leap: one bold jump to something far from here that you'd still love, and the title that connects them. */
function leap(ctx: Ctx, s: Session, a: Anchor): Turn {
	const cands = candidates(ctx, s, 0.5, 66)
	let best = -1
	let bs = Number.NEGATIVE_INFINITY
	for (const i of cands) {
		if (ctx.pct[i] < 0.82 || ctx.pool.pop[i] < 0.2) continue
		const c = cosTo(ctx.pool, i, a.U)
		if (c > 0.25 || c < -0.25) continue
		const v = ctx.q[i] + 0.15 * (0.25 - c)
		if (v > bs) {
			bs = v
			best = i
		}
	}
	const options: Opt[] = []
	let bridge: number | null = null
	let bridgeLine = ""
	if (best >= 0) {
		const t = ctx.pool.titles[best]
		const tz = rowZ(ctx.pool, best)
		const tu = rowU(ctx.pool, best)
		let bb = Number.NEGATIVE_INFINITY
		for (const i of cands) {
			if (i === best) continue
			const ca = cosTo(ctx.pool, i, a.U)
			const ct = cosTo(ctx.pool, i, tu)
			if (ca < 0.25 || ct < 0.25) continue
			const v = Math.min(ca, ct) + 0.25 * ctx.q[i]
			if (v > bb) {
				bb = v
				bridge = i
			}
		}
		const words = risers(a.Z, tz, 0.5)
		const kept = keeps(a.Z, tz)
		const ex = extras(a.yr, t.yr, a.type, t.type)
		const label = labelFrom(words, new Set(), "Somewhere new")
		const line = [
			sentence(label, words, ex, []),
			kept.length
				? `Keeps ${kept[0]}, and not much else.`
				: "Almost nothing in common, on purpose.",
			`${ctx.match[best]}% your taste.`,
		]
			.filter(Boolean)
			.join(" ")
		options.push({
			id: "leap",
			label,
			line,
			items: [wire(ctx, best)],
			dist: r2d(1 - cosTo(ctx.pool, best, a.U)),
		})
		if (bridge != null) {
			const bz = rowZ(ctx.pool, bridge)
			const k1 = keeps(a.Z, bz)[0]
			const k2 = keeps(tz, bz).find((k) => k !== k1)
			const here = a.i == null ? "your taste" : ctx.pool.titles[a.i].t
			bridgeLine =
				k1 && k2
					? `Shares ${k1} with ${here} and ${k2} with ${t.t}.`
					: `Halfway between ${here} and ${t.t}.`
		}
	}
	return {
		here: a.i == null ? null : wire(ctx, a.i),
		hereLine: a.i == null ? "" : why(ctx, a.i),
		options,
		spread: 0,
		bridge: bridge == null ? null : wire(ctx, bridge),
		bridgeLine,
	}
}

/** Lens: change one thing about the current title: its era, its format, its maker, or one side of its mood. */
function lens(ctx: Ctx, s: Session, a: Anchor): Turn {
	const cands = candidates(ctx, s)
	const here = ctx.pool.titles[a.i as number]
	type C = { i: number; kind: string; label: string; line: string; v: number }
	const all: C[] = []
	const bestOf = (
		test: (i: number, c: number) => boolean,
		score: (i: number, c: number) => number,
	) => {
		let best = -1
		let bs = Number.NEGATIVE_INFINITY
		for (const i of cands) {
			const c = cosTo(ctx.pool, i, a.U)
			if (!test(i, c)) continue
			const v = score(i, c)
			if (v > bs) {
				bs = v
				best = i
			}
		}
		return best >= 0 ? best : null
	}
	// Another era, same feel.
	const era = bestOf(
		(i, c) => c >= 0.5 && Math.abs(ctx.pool.titles[i].yr - here.yr) >= 20,
		(i, c) => c + 0.4 * ctx.q[i],
	)
	if (era != null) {
		const t = ctx.pool.titles[era]
		const kept = keeps(a.Z, rowZ(ctx.pool, era), 2)
		all.push({
			i: era,
			kind: "era",
			label: `Same feel, ${decade(t.yr)}`,
			line: `${kept.length ? `Keeps ${kept.join(" and ")}` : "The same feel"}, ${Math.abs(t.yr - here.yr)} years ${t.yr < here.yr ? "earlier" : "later"}.`,
			v: 1,
		})
	}
	// The other format.
	const fmt = bestOf(
		(i, c) => c >= 0.45 && ctx.pool.titles[i].type !== here.type,
		(i, c) => c + 0.4 * ctx.q[i],
	)
	if (fmt != null) {
		const kept = keeps(a.Z, rowZ(ctx.pool, fmt), 2)
		all.push({
			i: fmt,
			kind: "format",
			label: here.type === "movie" ? "Same feel, as a series" : "Same feel, as a film",
			line: `${kept.length ? `Keeps ${kept.join(" and ")}` : "The same feel"}, ${here.type === "movie" ? "with seasons to sink into" : "in one sitting"}.`,
			v: 1,
		})
	}
	// The same maker.
	if (here.dirs.length) {
		const mk = bestOf(
			(i) => ctx.pool.titles[i].dirs.some((d) => here.dirs.includes(d)),
			(i) => ctx.q[i],
		)
		if (mk != null) {
			const d = ctx.pool.titles[mk].dirs.find((x) => here.dirs.includes(x))
			const name = d != null ? ctx.pool.people.get(d)?.name : null
			const words = risers(a.Z, rowZ(ctx.pool, mk), 0.5)
			all.push({
				i: mk,
				kind: "maker",
				label: name ? `Same ${here.type === "show" ? "creator" : "director"}` : "Same maker",
				line: `${name ?? "The same hands"}${words.length ? `, ${words.slice(0, 2).join(" and ")}` : ", another side"}.`,
				v: 1,
			})
		}
	}
	// One side of the mood, the rest kept.
	for (const dir of DIRECTIONS) {
		const v = dirVec(dir.keys)
		const base = dot(a.Z, v)
		const i = bestOf(
			(j, c) => {
				if (c < 0.3) return false
				let g = 0
				for (let d = 0; d < DD; d++) g += ctx.pool.ZD[j * DD + d] * v[d]
				return g - base > 0.9
			},
			(j, c) => c + 0.4 * ctx.q[j],
		)
		if (i == null) continue
		const kept = keeps(a.Z, rowZ(ctx.pool, i), 2)
		all.push({
			i,
			kind: dir.id,
			label: dir.label,
			line: kept.length ? `Keeps ${kept.join(" and ")}.` : "Close to it in most ways.",
			v: 0.9,
		})
	}
	// Keep the four that are most different from each other; one title per option.
	const uniq = all.filter(
		(c, j) => all.findIndex((o) => o.i === c.i) === j,
	)
	const chosen: C[] = []
	const byKind = (k: string) => uniq.find((c) => c.kind === k)
	for (const k of ["era", "maker"]) {
		const c = byKind(k)
		if (c) chosen.push(c)
	}
	while (chosen.length < 4) {
		let best: C | null = null
		let bv = Number.NEGATIVE_INFINITY
		for (const c of uniq) {
			if (chosen.includes(c)) continue
			const mn = chosen.length
				? Math.min(...chosen.map((o) => 1 - cosIJ(ctx.pool, o.i, c.i)))
				: 1
			const v = mn + 0.25 * ctx.q[c.i] + 0.1 * c.v
			if (v > bv) {
				bv = v
				best = c
			}
		}
		if (!best) break
		chosen.push(best)
	}
	return {
		here: wire(ctx, a.i as number),
		hereLine: why(ctx, a.i as number),
		options: chosen.map((c) => ({
			id: `${c.kind}-${c.i}`,
			label: c.label,
			line: c.line,
			items: [wire(ctx, c.i)],
			dist: r2d(1 - cosTo(ctx.pool, c.i, a.U)),
			kind: c.kind,
		})),
		spread: spreadOf(
			ctx,
			chosen.map((c) => c.i),
		),
	}
}

// ---------------------------------------------------------------- nested map

type ZoomIndex = {
	nodes: NonNullable<LayoutMeta["nodes"]>
	kids: Map<number, number[]> // parent id (-1 = root) -> child ids
	members: Map<number, number[]> // node id -> titles in it (all depths)
	cent: Map<number, Float64Array> // node id -> mean title analysis
}
async function zoomIndex(country: string, pool: Pool): Promise<ZoomIndex> {
	let p = cache.zoom.get(country)
	if (!p) {
		p = (async () => {
			const lay = await zoomLayoutFor(country)
			const nodes = lay.meta.nodes ?? []
			const kids = new Map<number, number[]>()
			for (const n of nodes) {
				const l = kids.get(n.parent)
				if (l) l.push(n.id)
				else kids.set(n.parent, [n.id])
			}
			const leaves = nodes.filter((n) => !kids.has(n.id))
			const members = new Map<number, number[]>()
			for (let i = 0; i < pool.n; i++) {
				const x = lay.X[i]
				const y = lay.Y[i]
				if (!Number.isFinite(x)) continue
				let best = leaves[0]
				let bd = Number.POSITIVE_INFINITY
				for (const n of leaves) {
					const d = Math.hypot(x - n.x, y - n.y) / n.r
					if (d < bd) {
						bd = d
						best = n
					}
				}
				// Credit the title to its leaf and every group above it.
				let id = best.id
				while (id >= 0) {
					const l = members.get(id)
					if (l) l.push(i)
					else members.set(id, [i])
					id = nodes[id].parent
				}
			}
			const cent = new Map<number, Float64Array>()
			for (const [id, idx] of members) cent.set(id, meanZ(pool, idx))
			return { nodes, kids, members, cent }
		})().catch((e) => {
			cache.zoom.delete(country)
			throw e
		})
		cache.zoom.set(country, p)
	}
	return p
}

async function zoom(ctx: Ctx, s: Session, nodeId: number): Promise<ZoomRes> {
	const zi = await zoomIndex(ctx.pool.country, ctx.pool)
	const node = nodeId >= 0 ? zi.nodes[nodeId] : null
	const kidIds = zi.kids.get(nodeId) ?? []
	const pass = (i: number) =>
		!s.shown.has(i) &&
		!s.names.has(ctx.pool.titles[i].t) &&
		eligible(ctx, i, s.f) &&
		ctx.pool.titles[i].s >= 55
	const R = node ? node.r : 1600
	const cx = node ? node.x : 0
	const cy = node ? node.y : 0
	if (node && !kidIds.length) {
		// The finest level: a handful of titles, each for a reason.
		const idx = (zi.members.get(node.id) ?? []).filter(pass)
		const top = idx.sort((a, b) => ctx.q[b] - ctx.q[a]).slice(0, 40)
		const picks = farthest(ctx, top, 7, top[0] ?? null, 0.9)
		return {
			node: { id: node.id, name: node.name, line: "", count: node.count },
			kids: [],
			titles: picks.map((i) => ({ ...wire(ctx, i), why: why(ctx, i) })),
			spread: spreadOf(ctx, picks),
		}
	}
	// One representative per group at the top, two a level down: the best for you, then the most different.
	const per = node ? 2 : 1
	const siblingsMean = new Float64Array(DD)
	for (const id of kidIds) {
		const c = zi.cent.get(id)
		if (c) for (let d = 0; d < DD; d++) siblingsMean[d] += c[d] / kidIds.length
	}
	const taken = new Set<string>()
	const leads: number[] = []
	const kids: ZoomNode[] = []
	for (const id of kidIds) {
		const n = zi.nodes[id]
		const idx = (zi.members.get(id) ?? []).filter(pass)
		if (!idx.length) continue
		const top = idx.sort((a, b) => ctx.q[b] - ctx.q[a]).slice(0, 30)
		const reps = farthest(ctx, top, Math.min(per, top.length), top[0], 0.8)
		leads.push(reps[0])
		const c = zi.cent.get(id) as Float64Array
		const words = risers(siblingsMean, c, 0.15)
		const label = labelFrom(words, taken, "")
		kids.push({
			id,
			name: n.name,
			line: label ? `${label} than its neighbors.` : "",
			count: idx.length,
			x: (n.x - cx) / R,
			y: (n.y - cy) / R,
			r: n.r / R,
			items: reps.map((i) => wire(ctx, i)),
			leaf: !(zi.kids.get(id) ?? []).length,
		})
	}
	return {
		node: node
			? { id: node.id, name: node.name, line: "", count: node.count }
			: null,
		kids,
		titles: [],
		spread: spreadOf(ctx, leads),
	}
}

// ---------------------------------------------------------------- public

export async function getExplorer3(request: Request): Promise<Loaded3> {
	const url = new URL(request.url)
	const ctx = await getCtx(request)
	return {
		who: ctx.who,
		services: ctx.services,
		variant: url.searchParams.get("variant") ?? "roads",
	}
}

export async function explorer3Api(request: Request) {
	const url = new URL(request.url)
	const q = url.searchParams
	const op = q.get("op")
	const t0 = performance.now()
	const ctx = await getCtx(request)
	const s = sessionOf(ctx, q)
	const done = <X extends object>(x: X) => ({
		...x,
		ms: Math.round((performance.now() - t0) * 10) / 10,
	})
	if (op === "turn") {
		const mode = q.get("mode")
		let at = hereAt(ctx, q)
		const titleAnchored = mode === "compass" || mode === "leap" || mode === "lens"
		if (at == null && titleAnchored) at = startTitle(ctx, s)
		if (at != null) show(ctx, s, at)
		const a = anchorOf(ctx, at)
		if (mode === "roads") return done(roads(ctx, s, a))
		if (mode === "compass")
			return done(compass(ctx, s, a, q.get("last")?.split("-")[0] ?? null))
		if (mode === "leap") return done(leap(ctx, s, a))
		if (mode === "lens" && at != null) return done(lens(ctx, s, a))
		if (mode === "doors") {
			const room = (q.get("room") ?? "")
				.split(",")
				.map((k) => ctx.pool.index.get(k))
				.filter((i): i is number => i != null)
			const first = room.length ? room : firstRoom(ctx, s)
			for (const i of first) show(ctx, s, i)
			const z = meanZ(ctx.pool, first)
			const anchor: Anchor = room.length
				? {
						i: null,
						U: unit(z),
						Z: z,
						yr: median(first.map((i) => ctx.pool.titles[i].yr)),
						type: null,
					}
				: { i: null, U: ctx.youU, Z: ctx.youZ, yr: 0, type: null }
			const turn = doors(ctx, s, first, anchor, q.get("last"))
			return done({ ...turn, room: first.map((i) => wire(ctx, i)) })
		}
		throw new Response("Unknown mode", { status: 400 })
	}
	if (op === "zoom") return done(await zoom(ctx, s, Number(q.get("node") ?? -1)))
	if (op === "dist") {
		// For the verification scripts: fingerprint distance between consecutive titles of a walk.
		const ks = (q.get("keys") ?? "")
			.split(",")
			.map((k) => ctx.pool.index.get(k))
			.filter((i): i is number => i != null)
		return done({
			steps: ks.slice(1).map((i, j) => r2d(1 - cosIJ(ctx.pool, ks[j], i))),
		})
	}
	if (op === "peek") {
		const i = ctx.pool.index.get(q.get("k") ?? "")
		if (i == null) return done({ why: "", people: [], role: "" })
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
	throw new Response("Unknown op", { status: 400 })
}
