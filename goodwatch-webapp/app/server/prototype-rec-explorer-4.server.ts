// PROTOTYPE - throwaway. Map data for /prototype/rec-explorer-4 (#180, round 4): the whole pool laid out by a grouping
// the person picks (genre, mood, streaming service, decade, country, taste distance).
// Reuses round 2's in-memory pool (~12,000 titles with their title analysis), reached through round 2's public loader
// so it builds once and is shared. Adds one small read per pool (original language and country, for the country
// grouping) and answers four read-only questions: the regions of a grouping with their best picks, more titles of one
// region, where each door from a title leads (the closest title in a neighboring region), and a title's neighbors.
// ?as=me (the default when signed in) reads the member's ratings, Wishlist, history, and services; ?as=demo, or signed
// out, uses the Taste prototype's demo member; ?as=<uuid> works on localhost in development only. Only SELECTs.
import { getExplorer2 } from "~/server/prototype-rec-explorer-2.server"
import { getUserSettings } from "~/server/user-settings.server"
import { VALID_FINGERPRINT_KEYS } from "~/server/utils/fingerprint"
import { MOODS } from "~/ui/prototype-rec-explorer-2/wire"
import {
	BANDS,
	type GroupId,
	GROUPINGS,
	type Loaded4,
	type MapRes,
	type Region,
	type W,
	type Who,
	bandOf,
} from "~/ui/prototype-rec-explorer-4/wire4"
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
const PAGE = 1500
// Bump when the viewer context or its groupings change shape, so contexts cached before a dev reload are rebuilt.
const CTX_V = 2

// ---------------------------------------------------------------- round 2's pool

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
	mood: Uint8Array
	people: Map<number, { id: number; name: string; profile: string }>
}
type R2Cache = { pools: Map<string, Promise<Pool>> }
const r2 = () => (globalThis as unknown as { __rx2?: R2Cache }).__rx2

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

// ---------------------------------------------------------------- caches

type Def = { id: string; name: string; color: string }
type Groups = { gid: Int16Array; defs: Def[] }
type Cache = {
	ctx: Map<string, { at: number; p: Promise<Ctx> }>
	origin: Map<string, Promise<Origin>>
	groups: Map<string, Groups>
}
const G = globalThis as unknown as { __rx4?: Cache }
const cache: Cache = (G.__rx4 ??= {
	ctx: new Map(),
	origin: new Map(),
	groups: new Map(),
})

// ---------------------------------------------------------------- origin (language and country), read once per pool

type Origin = { lang: string[]; land: string[] }
async function originOf(pool: Pool): Promise<Origin> {
	let p = cache.origin.get(pool.country)
	if (!p) {
		p = (async () => {
			const lang = new Array<string>(pool.n).fill("")
			const land = new Array<string>(pool.n).fill("")
			for (const [type, col] of [
				["movie", "production_country_codes"],
				["show", "origin_country_codes"],
			] as const) {
				const ids = pool.titles.filter((t) => t.type === type).map((t) => t.id)
				for (let o = 0; o < ids.length; o += PAGE) {
					const rows = await query<{
						tmdb_id: number
						lang: string | null
						pc: string[] | null
					}>(
						`SELECT tmdb_id, original_language_code AS lang, ${col} AS pc FROM ${type} WHERE tmdb_id IN (${ids.slice(o, o + PAGE).join(",")})`,
					)
					for (const r of rows) {
						const i = pool.index.get(`${type}-${r.tmdb_id}`)
						if (i == null) continue
						lang[i] = r.lang ?? ""
						land[i] = r.pc?.[0] ?? ""
					}
				}
			}
			return { lang, land }
		})().catch((e) => {
			cache.origin.delete(pool.country)
			throw e
		})
		cache.origin.set(pool.country, p)
	}
	return p
}

// ---------------------------------------------------------------- the viewer (as round 3 builds it)

type Ctx = {
	key: string
	pool: Pool
	who: Who
	services: Service[]
	mineIds: Set<number>
	relevant: Set<number>
	taste: Float32Array
	pct: Float32Array
	match: Uint8Array
	seen: Uint8Array
	rating: Uint8Array
	want: Uint8Array
	onMine: Uint8Array
	q: Float32Array
	loved: number[]
	groups: Map<string, Groups>
	maps: Map<string, MapRes>
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
	return { userId, signedIn: !!signedIn }
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
		mineIds: mine,
		relevant: new Set(services.map((s) => s.id)),
		taste,
		pct,
		match,
		seen,
		rating,
		want,
		onMine,
		q,
		loved,
		groups: new Map(),
		maps: new Map(),
	}
}

async function getCtx(request: Request): Promise<Ctx> {
	const url = new URL(request.url)
	const { userId, signedIn } = await whoFor(request)
	const key = `v${CTX_V}|${userId ?? "demo"}|${url.searchParams.get("country") ?? ""}`
	const hit = cache.ctx.get(key)
	if (hit && Date.now() - hit.at < 10 * 60_000) return hit.p
	const p = buildCtx(key, url, userId, signedIn).catch((e) => {
		cache.ctx.delete(key)
		throw e
	})
	cache.ctx.set(key, { at: Date.now(), p })
	return p
}

// ---------------------------------------------------------------- groupings

// Most specific genre wins, so a crime drama lands in Crime and an animated comedy in Animation.
const GENRES: (Def & { from: string[] })[] = [
	{ id: "animation", name: "Animation", color: "#e38fb8", from: ["Animation"] },
	{
		id: "docs",
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
	{ id: "fantasy", name: "Fantasy", color: "#9b7bea", from: ["Fantasy"] },
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
const DECADES: (Def & { lo: number; hi: number })[] = [
	{ id: "old", name: "Before 1970", color: "#9c7a52", lo: 1, hi: 1969 },
	{ id: "1970", name: "1970s", color: "#c0703c", lo: 1970, hi: 1979 },
	{ id: "1980", name: "1980s", color: "#d4508a", lo: 1980, hi: 1989 },
	{ id: "1990", name: "1990s", color: "#8e62d6", lo: 1990, hi: 1999 },
	{ id: "2000", name: "2000s", color: "#4f86d9", lo: 2000, hi: 2009 },
	{ id: "2010", name: "2010s", color: "#37b3a4", lo: 2010, hi: 2019 },
	{ id: "2020", name: "2020s", color: "#8ccf4d", lo: 2020, hi: 3000 },
]
const LANDS: Def[] = [
	{ id: "us", name: "American", color: "#5b7fa8" },
	{ id: "gb", name: "British", color: "#c2413a" },
	{ id: "en", name: "English, elsewhere", color: "#3fc1b0" },
	{ id: "fr", name: "French", color: "#9b7bea" },
	{ id: "es", name: "Spanish-language", color: "#e8793d" },
	{ id: "it", name: "Italian", color: "#7fae3a" },
	{ id: "de", name: "German-language", color: "#b98a5a" },
	{ id: "nordic", name: "Nordic", color: "#7cc4e8" },
	{ id: "ja", name: "Japanese", color: "#e0607e" },
	{ id: "ko", name: "Korean", color: "#e2cf55" },
	{ id: "zh", name: "Chinese-language", color: "#d4508a" },
	{ id: "in", name: "Indian", color: "#e9a23b" },
	{ id: "world", name: "Rest of the world", color: "#9aa3ad" },
]
const LANG_TO: Record<string, string> = {
	fr: "fr",
	es: "es",
	it: "it",
	de: "de",
	ja: "ja",
	ko: "ko",
	zh: "zh",
	cn: "zh",
	hi: "in",
	ta: "in",
	te: "in",
	ml: "in",
	kn: "in",
	bn: "in",
	mr: "in",
	sv: "nordic",
	da: "nordic",
	no: "nordic",
	nb: "nordic",
	fi: "nordic",
	is: "nordic",
}
const TASTE: (Def & { min: number })[] = [
	{ id: "near", name: "Near you", color: "#f5a524", min: 90 },
	{ id: "close", name: "Close by", color: "#c9a04e", min: 80 },
	{ id: "edges", name: "The edges", color: "#7d8fa3", min: 65 },
	{ id: "far", name: "Unexplored", color: "#6a5aa8", min: 0 },
]
const SERVICE_COLORS = [
	"#e8793d",
	"#5b7fa8",
	"#3fc1b0",
	"#c2413a",
	"#9b7bea",
	"#e2cf55",
	"#7fae3a",
	"#e0607e",
	"#7cc4e8",
	"#b98a5a",
	"#d4508a",
	"#9aa3ad",
]

const DUP_TO_BASE = new Map(
	Object.entries(duplicateProviderMapping as Record<string, number[]>).flatMap(
		([base, dups]) => dups.map((d) => [d, Number(base)] as const),
	),
)
const baseService = (id: number) => DUP_TO_BASE.get(id) ?? id

async function groupsFor(ctx: Ctx, group: GroupId): Promise<Groups> {
	const { pool } = ctx
	const n = pool.n
	const personal = group === "service" || group === "taste"
	const ck = `${pool.country}|${group}`
	const hit = personal ? ctx.groups.get(group) : cache.groups.get(ck)
	if (hit) return hit
	const gid = new Int16Array(n).fill(-1)
	let defs: Def[] = []
	if (group === "genre") {
		defs = GENRES
		const idx = new Map<string, number>()
		GENRES.forEach((g, j) => {
			for (const f of g.from) idx.set(f, j)
		})
		for (let i = 0; i < n; i++) {
			let best = 99
			for (const g of pool.titles[i].g) {
				const j = idx.get(g)
				if (j != null && j < best) best = j
			}
			if (best < 99) gid[i] = best
		}
	} else if (group === "mood") {
		defs = MOODS.map((m) => ({ id: m.id, name: m.name, color: m.color }))
		for (let i = 0; i < n; i++) gid[i] = pool.mood[i]
	} else if (group === "decade") {
		defs = DECADES
		for (let i = 0; i < n; i++) {
			const yr = pool.titles[i].yr
			if (!yr) continue
			gid[i] = DECADES.findIndex((d) => yr >= d.lo && yr <= d.hi)
		}
	} else if (group === "country") {
		defs = LANDS
		const o = await originOf(pool)
		const at = new Map(LANDS.map((l, j) => [l.id, j]))
		for (let i = 0; i < n; i++) {
			const l = o.lang[i]
			if (!l) continue
			let id = "world"
			if (l === "en") id = o.land[i] === "US" ? "us" : o.land[i] === "GB" ? "gb" : "en"
			else id = LANG_TO[l] ?? "world"
			gid[i] = at.get(id) ?? -1
		}
	} else if (group === "taste") {
		defs = TASTE
		for (let i = 0; i < n; i++)
			gid[i] = TASTE.findIndex((t) => ctx.match[i] >= t.min)
	} else if (group === "service") {
		// A title on several services goes to the smallest catalog, so the big ones don't swallow everything.
		const size = new Map<number, number>()
		for (const t of pool.titles) for (const id of new Set(t.svc.map(baseService))) size.set(id, (size.get(id) ?? 0) + 1)
		const svcs = [...ctx.services].sort((a, b) => (size.get(a.id) ?? 0) - (size.get(b.id) ?? 0))
		const order = svcs.map((s) => s.id)
		defs = [
			...svcs.map((s, j) => ({
				id: String(s.id),
				name: s.name,
				color: SERVICE_COLORS[j % SERVICE_COLORS.length],
			})),
			{ id: "none", name: "Rent or buy", color: "#57534e" },
		]
		for (let i = 0; i < n; i++) {
			const have = new Set(pool.titles[i].svc.map(baseService))
			const j = order.findIndex((id) => have.has(id))
			gid[i] = j >= 0 ? j : order.length
		}
	}
	const out = { gid, defs }
	if (personal) ctx.groups.set(group, out)
	else cache.groups.set(ck, out)
	return out
}

// ---------------------------------------------------------------- helpers

type Filters = { mine: boolean; notSeen: boolean }
const filtersOf = (q: URLSearchParams): Filters => ({
	mine: q.get("mine") === "1",
	notSeen: q.get("ns") !== "0",
})
const eligible = (ctx: Ctx, i: number, f: Filters) =>
	ctx.seen[i] !== 2 &&
	!(f.notSeen && ctx.seen[i] === 1) &&
	!(f.mine && !ctx.onMine[i])

const cosIJ = (pool: Pool, i: number, j: number) => {
	let c = 0
	const a = i * DD
	const b = j * DD
	for (let d = 0; d < DD; d++) c += pool.U[a + d] * pool.U[b + d]
	return c
}
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

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
		a: [...new Set(t.svc.map(baseService))].filter((id) => ctx.relevant.has(id)),
		f:
			(ctx.onMine[i] ? 1 : 0) |
			(ctx.seen[i] === 1 ? 2 : 0) |
			(ctx.want[i] ? 4 : 0),
	}
	if (ctx.rating[i]) w.r = ctx.rating[i]
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
		.slice(0, 2)
		.map((r) => r.key)
}
function why(ctx: Ctx, i: number) {
	const r = reasons(ctx, i).map(phrase).join(" and ")
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
	return cap(
		[r, like != null ? `like ${ctx.pool.titles[like].t}` : ""]
			.filter(Boolean)
			.join(", "),
	)
}

/** Top two components of the region means, so similar regions sit close together. */
function pca2(rows: Float64Array[]): [number, number][] {
	const m = rows.length
	if (m < 3) return rows.map((_, j) => [j ? 0.6 : -0.6, 0])
	const mu = new Float64Array(DD)
	for (const r of rows) for (let d = 0; d < DD; d++) mu[d] += r[d] / m
	const X = rows.map((r) => r.map((v, d) => v - mu[d]))
	const comps: Float64Array[] = []
	for (let c = 0; c < 2; c++) {
		let v = new Float64Array(DD).map((_, d) => Math.sin(d * 1.7 + c * 3.1) + 0.01)
		for (let it = 0; it < 60; it++) {
			const nv = new Float64Array(DD)
			for (const x of X) {
				let s = 0
				for (let d = 0; d < DD; d++) s += x[d] * v[d]
				for (let d = 0; d < DD; d++) nv[d] += s * x[d]
			}
			for (const p of comps) {
				let s = 0
				for (let d = 0; d < DD; d++) s += nv[d] * p[d]
				for (let d = 0; d < DD; d++) nv[d] -= s * p[d]
			}
			let l = 0
			for (let d = 0; d < DD; d++) l += nv[d] * nv[d]
			l = Math.sqrt(l) || 1
			v = nv.map((x) => x / l)
		}
		comps.push(v)
	}
	const pts = X.map((x) =>
		comps.map((p) => {
			let s = 0
			for (let d = 0; d < DD; d++) s += x[d] * p[d]
			return s
		}),
	) as [number, number][]
	const mx = Math.max(1e-6, ...pts.map(([a, b]) => Math.max(Math.abs(a), Math.abs(b))))
	return pts.map(([a, b]) => [a / mx, b / mx])
}

// ---------------------------------------------------------------- the map

function members(ctx: Ctx, g: Groups, f: Filters) {
	const out: number[][] = g.defs.map(() => [])
	for (let i = 0; i < ctx.pool.n; i++) {
		const j = g.gid[i]
		if (j < 0 || !eligible(ctx, i, f)) continue
		out[j].push(i)
	}
	return out
}

async function mapOf(ctx: Ctx, group: GroupId, f: Filters): Promise<MapRes> {
	const mk = `${group}|${f.mine ? 1 : 0}${f.notSeen ? 1 : 0}`
	const hit = ctx.maps.get(mk)
	if (hit) return hit
	const g = await groupsFor(ctx, group)
	const { pool } = ctx
	const mem = members(ctx, g, f)
	const live = g.defs.map((d, j) => ({ d, j, idx: mem[j] })).filter((r) => r.idx.length >= 3)
	// What sets each region apart: its mean over the descriptive attributes, against the other regions' means.
	const means = live.map(({ idx }) => {
		const v = new Float64Array(DD)
		for (const i of idx) for (let d = 0; d < DD; d++) v[d] += pool.ZD[i * DD + d] / idx.length
		return v
	})
	const avg = new Float64Array(DD)
	for (const v of means) for (let d = 0; d < DD; d++) avg[d] += v[d] / Math.max(1, means.length)
	const pos = pca2(means)
	const regions: Region[] = live.map(({ d, idx }, r) => {
		const sorted = [...idx].sort((a, b) => ctx.q[b] - ctx.q[a])
		const bands: [number, number, number] = [0, 0, 0]
		for (const i of idx) bands[bandOf(ctx.match[i])]++
		const pick = new Set(sorted.slice(0, 12))
		for (let b = 0; b < BANDS.length; b++) {
			let got = 0
			for (const i of sorted) {
				if (got >= 5) break
				if (bandOf(ctx.match[i]) === b) {
					pick.add(i)
					got++
				}
			}
		}
		const ms = idx.map((i) => ctx.match[i]).sort((a, b) => a - b)
		const top = DESC.map((k, dd) => ({ key: KEYS[k], v: means[r][dd] - avg[dd] }))
			.sort((a, b) => b.v - a.v)
			.slice(0, 2)
			.map((x) => phrase(x.key))
		return {
			id: d.id,
			name: d.name,
			color: d.color,
			count: idx.length,
			fit: ms[Math.floor(ms.length / 2)] ?? 50,
			bands,
			x: Math.round(pos[r][0] * 1000) / 1000,
			y: Math.round(pos[r][1] * 1000) / 1000,
			line: cap(top.join(" and ")),
			items: [...pick].sort((a, b) => ctx.q[b] - ctx.q[a]).map((i) => wire(ctx, i)),
		}
	})
	regions.sort((a, b) => b.count - a.count)
	const res: MapRes = {
		group,
		regions,
		total: regions.reduce((s, r) => s + r.count, 0),
	}
	ctx.maps.set(mk, res)
	return res
}

/** The titles of one region (optionally one taste band), best picks first. */
async function regionOf(
	ctx: Ctx,
	group: GroupId,
	id: string,
	band: number | null,
	f: Filters,
	offset: number,
) {
	const g = await groupsFor(ctx, group)
	const j = g.defs.findIndex((d) => d.id === id)
	if (j < 0) return { items: [] as W[], count: 0 }
	const idx = members(ctx, g, f)[j].filter((i) => band == null || bandOf(ctx.match[i]) === band)
	idx.sort((a, b) => ctx.q[b] - ctx.q[a])
	return { items: idx.slice(offset, offset + 60).map((i) => wire(ctx, i)), count: idx.length }
}

const parseTarget = (s: string) => {
	const [id, b] = s.split("@")
	return { id, band: b == null || b === "" ? null : Number(b) }
}

/** Where each door leads: the title in the target region closest to this one that is also a good pick. */
async function stepsFrom(
	ctx: Ctx,
	group: GroupId,
	k: string,
	targets: string[],
	shown: Set<number>,
	f: Filters,
) {
	const at = ctx.pool.index.get(k)
	const g = await groupsFor(ctx, group)
	const mem = members(ctx, g, f)
	const taken = new Set(shown)
	// A film and its series remake share a name; landing on one from the other reads as going nowhere.
	const names = new Set([...shown].map((i) => ctx.pool.titles[i].t))
	if (at != null) names.add(ctx.pool.titles[at].t)
	return targets.map((to) => {
		const { id, band } = parseTarget(to)
		const j = g.defs.findIndex((d) => d.id === id)
		if (j < 0 || at == null) return { to, item: null }
		let best = -1
		let bs = Number.NEGATIVE_INFINITY
		for (const i of mem[j]) {
			if (i === at || taken.has(i) || names.has(ctx.pool.titles[i].t)) continue
			if (band != null && bandOf(ctx.match[i]) !== band) continue
			if (ctx.pool.titles[i].s < 55) continue
			const v = 0.65 * cosIJ(ctx.pool, at, i) + 0.35 * ctx.q[i]
			if (v > bs) {
				bs = v
				best = i
			}
		}
		if (best >= 0) {
			taken.add(best)
			names.add(ctx.pool.titles[best].t)
		}
		return { to, item: best >= 0 ? wire(ctx, best) : null }
	})
}

/** The titles closest to this one inside its own region. */
async function nearOf(
	ctx: Ctx,
	group: GroupId,
	k: string,
	band: number | null,
	shown: Set<number>,
	f: Filters,
) {
	const at = ctx.pool.index.get(k)
	if (at == null) return { items: [] as W[] }
	const g = await groupsFor(ctx, group)
	const j = g.gid[at]
	if (j < 0) return { items: [] as W[] }
	const cand: [number, number][] = []
	for (let i = 0; i < ctx.pool.n; i++) {
		if (g.gid[i] !== j || i === at || shown.has(i) || !eligible(ctx, i, f)) continue
		if (band != null && bandOf(ctx.match[i]) !== band) continue
		if (ctx.pool.titles[i].s < 55) continue
		cand.push([i, cosIJ(ctx.pool, at, i) + 0.15 * ctx.q[i]])
	}
	cand.sort((a, b) => b[1] - a[1])
	const names = new Set([ctx.pool.titles[at].t])
	const out: number[] = []
	for (const [i] of cand) {
		if (out.length >= 6) break
		const t = ctx.pool.titles[i].t
		if (names.has(t)) continue
		names.add(t)
		out.push(i)
	}
	return { items: out.map((i) => wire(ctx, i)) }
}

// ---------------------------------------------------------------- public

const groupParam = (q: URLSearchParams): GroupId => {
	const g = q.get("group") as GroupId
	return GROUPINGS.some((x) => x.id === g) ? g : "genre"
}

export async function getExplorer4(request: Request): Promise<Loaded4> {
	const url = new URL(request.url)
	const ctx = await getCtx(request)
	const hasMine = ctx.services.some((s) => s.mine)
	const group = url.searchParams.get("variant") === "rings" && groupParam(url.searchParams) === "taste" ? "mood" : groupParam(url.searchParams)
	return {
		who: ctx.who,
		services: ctx.services,
		map: await mapOf(ctx, group, { mine: hasMine, notSeen: true }),
	}
}

export async function explorer4Api(request: Request) {
	const url = new URL(request.url)
	const q = url.searchParams
	const op = q.get("op")
	const t0 = performance.now()
	const ctx = await getCtx(request)
	const f = filtersOf(q)
	const group = groupParam(q)
	const done = <X extends object>(x: X) => ({
		...x,
		ms: Math.round((performance.now() - t0) * 10) / 10,
	})
	const shown = new Set(
		(q.get("shown") ?? "")
			.split(",")
			.filter(Boolean)
			.slice(0, 300)
			.map((k) => ctx.pool.index.get(k))
			.filter((i): i is number => i != null),
	)
	const band = q.get("band")
	const bandN = band == null || band === "" ? null : Number(band)
	if (op === "map") return done(await mapOf(ctx, group, f))
	if (op === "region")
		return done(
			await regionOf(ctx, group, q.get("id") ?? "", bandN, f, Number(q.get("offset") ?? 0)),
		)
	if (op === "step")
		return done({
			steps: await stepsFrom(
				ctx,
				group,
				q.get("k") ?? "",
				(q.get("to") ?? "").split(",").filter(Boolean).slice(0, 6),
				shown,
				f,
			),
		})
	if (op === "near") return done(await nearOf(ctx, group, q.get("k") ?? "", bandN, shown, f))
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
