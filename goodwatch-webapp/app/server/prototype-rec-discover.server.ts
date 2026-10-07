// PROTOTYPE - throwaway. Real Discover and Search result lists with a per-person taste match, for
// /prototype/rec-discover (#179). Everything is read-only.
// - Discover: today's default Discover query (popularity, at least 1,000 votes), top 110 films and 110 shows.
// - Search: result lists captured once from the real combined search (`captured-search.json`), so viewing the
//   prototype never runs a paid Jev reading. Titles are re-read from Crate for posters, scores and offers.
// - Taste, as decided in #174: 2P - N over all ratings on unit-length fingerprint_v1 vectors, P score-weighted
//   (6 counts 1 ... 10 counts 5) plus Want to See at 0.5, N weighted 6 - score. Match = 50 + 0.49 x percentile
//   of the title's cosine within the person's own distribution over a reference pool of well-known titles.
// ?as=me (default) reads the signed-in person; ?as=demo is round 1's demo member; ?as=<uuid> works on localhost only.
import { VALID_FINGERPRINT_KEYS } from "~/server/utils/fingerprint"
import { FINGERPRINT_META } from "~/ui/fingerprint/fingerprintMeta"
import { isSeen } from "~/ui/prototype-rec-filter-bar/model"
import CAPTURED from "~/ui/prototype-rec-discover/captured-search.json"
import type { DiscTitle, Payload, TasteAttr, Who } from "~/ui/prototype-rec-discover/types"
import { CRAFT_KEYS, DEMO_RATINGS, DEMO_SERVICES, PHRASES } from "~/ui/prototype-rec-taste/model"
import { getAuthFromRequest } from "~/utils/auth"
import { query } from "~/utils/crate"
import { duplicateProviderMapping, getShorterProviderLabel, ignoredProviders } from "~/utils/streaming-links"

const KEYS = [...VALID_FINGERPRINT_KEYS] as string[]
const N = KEYS.length
const SUBSCRIPTION = ["flatrate", "flatrate_and_buy", "free", "ads"]
const PER_TYPE = 110

type Kind = "movie" | "show"
type Row = {
	tmdb_id: number
	title: string
	release_year: number | null
	release_date: string | null
	poster_path: string | null
	backdrop_path: string | null
	popularity: number | null
	genres: string[] | null
	score: number | null
	votes: number | null
	fp: Record<string, number> | null
}
type Base = Omit<DiscTitle, "key" | "seen" | "rated" | "wish" | "match" | "pct" | "why" | "against" | "like" | "hits" | "rel" | "relScore"> & { u: number[] | null; raw: number[] | null }

// Survive dev-server module reloads: the pool and lists take a few seconds to read.
const G = globalThis as unknown as { __recDiscover?: Map<string, Promise<unknown>> }
G.__recDiscover ??= new Map()
function once<X>(key: string, make: () => Promise<X>): Promise<X> {
	const m = G.__recDiscover as Map<string, Promise<unknown>>
	let p = m.get(key) as Promise<X> | undefined
	if (!p) {
		p = make().catch((e) => {
			m.delete(key)
			throw e
		})
		m.set(key, p)
	}
	return p
}

const unit = (v: number[]) => {
	const len = Math.sqrt(v.reduce((a, x) => a + x * x, 0))
	return len ? v.map((x) => x / len) : null
}
const rawOf = (fp: Record<string, number> | null) => (fp ? KEYS.map((k) => Number(fp[k] ?? 0)) : null)
const dot = (a: number[], b: number[]) => {
	let d = 0
	for (let k = 0; k < a.length; k++) d += a[k] * b[k]
	return d
}
const chunks = <X>(xs: X[], n = 700) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n))

const brand = (name: string) =>
	getShorterProviderLabel(name)
		.replace(/\s+(Amazon|Apple TV|Roku Premium)\s+Channel$/i, "")
		.replace(/\s+(Standard|Basic)\s+with\s+Ads$/i, "")
		.replace(/\s+with\s+Ads$/i, "")
		.replace(/\s+(Essential|Premium|Basic|Standard)$/i, "")

const COLS = (type: Kind) => `tmdb_id, title, release_year, ${type === "movie" ? "release_date" : "first_air_date"} AS release_date,
	poster_path, backdrop_path, popularity, genres, goodwatch_overall_score_normalized_percent AS score,
	goodwatch_overall_score_voting_count AS votes, fingerprint_scores AS fp`

async function offersFor(type: Kind, ids: number[], country: string) {
	const byId = new Map<number, { id: number; name: string; logo: string }[]>()
	for (const part of chunks(ids, 400)) {
		const rows = await query<{ media_tmdb_id: number; sid: number; name: string; logo: string }>(
			`SELECT sa.media_tmdb_id, sa.streaming_service_id AS sid, s.name, s.logo_path AS logo
			 FROM streaming_availability sa
			 JOIN streaming_service s ON s.tmdb_id = sa.streaming_service_id AND s.media_type = sa.media_type
			 WHERE sa.media_type = ? AND sa.country_code = ? AND sa.streaming_type IN ('${SUBSCRIPTION.join("','")}')
				AND sa.media_tmdb_id IN (${part.map(() => "?").join(",")})
			 ORDER BY s.order_default LIMIT 10000`,
			[type, country, ...part],
		)
		for (const o of rows) {
			if (ignoredProviders.includes(o.sid)) continue
			const list = byId.get(o.media_tmdb_id) ?? []
			const name = brand(o.name)
			if (list.some((x) => x.name === name)) continue
			list.push({ id: o.sid, name, logo: o.logo })
			byId.set(o.media_tmdb_id, list)
		}
	}
	return byId
}

const toBase = (type: Kind, r: Row, offers: Map<number, { id: number; name: string; logo: string }[]>): Base => {
	const raw = rawOf(r.fp)
	return {
		ref: `${type}-${r.tmdb_id}`,
		tmdb_id: r.tmdb_id,
		media_type: type,
		title: r.title,
		release_year: String(r.release_year ?? ""),
		release_date: String(r.release_date ?? ""),
		poster_path: r.poster_path ?? "",
		backdrop_path: r.backdrop_path ?? "",
		popularity: r.popularity ?? 0,
		genres: r.genres ?? [],
		offers: offers.get(r.tmdb_id) ?? [],
		goodwatch_overall_score_normalized_percent: r.score,
		goodwatch_overall_score_voting_count: r.votes,
		raw,
		u: raw ? unit(raw) : null,
	}
}

// ---------------------------------------------------------------- lists

// Today's default Discover order: popularity, both types, at least 1,000 votes, with a poster.
const loadDiscover = (country: string) =>
	once(`discover:${country}`, async () => {
		const lists = await Promise.all(
			(["movie", "show"] as const).map(async (type) => {
				const rows = await query<Row>(
					`SELECT ${COLS(type)} FROM ${type}
					 WHERE title IS NOT NULL AND release_year IS NOT NULL AND poster_path IS NOT NULL AND popularity IS NOT NULL
						AND goodwatch_overall_score_voting_count >= 1000 AND backdrop_path IS NOT NULL
					 ORDER BY popularity DESC LIMIT ${PER_TYPE}`,
				)
				const offers = await offersFor(type, rows.map((r) => r.tmdb_id), country)
				return rows.map((r) => toBase(type, r, offers))
			}),
		)
		return lists.flat().sort((a, b) => b.popularity - a.popularity)
	})

type Captured = { q: string; reading: { text: string; kind: string }[]; rows: { key: string; score: number }[] }

const loadSearch = (country: string) =>
	once(`search:${country}`, async () => {
		const captured = CAPTURED as Captured[]
		const byType: Record<Kind, Set<number>> = { movie: new Set(), show: new Set() }
		for (const c of captured)
			for (const r of c.rows) {
				const [type, id] = r.key.split(":")
				if ((type === "movie" || type === "show") && Number(id)) byType[type].add(Number(id))
			}
		const found = new Map<string, Base>()
		for (const type of ["movie", "show"] as const) {
			const ids = [...byType[type]]
			for (const part of chunks(ids)) {
				const rows = await query<Row>(`SELECT ${COLS(type)} FROM ${type} WHERE poster_path IS NOT NULL AND tmdb_id IN (${part.join(",")})`)
				const offers = await offersFor(type, rows.map((r) => r.tmdb_id), country)
				for (const r of rows) found.set(`${type}:${r.tmdb_id}`, toBase(type, r, offers))
			}
		}
		return captured.map((c) => ({
			q: c.q,
			reading: c.reading,
			rows: c.rows.flatMap((r) => {
				const b = found.get(r.key)
				return b ? [{ base: b, score: r.score }] : []
			}),
		}))
	})

// The reference pool the match percentile is measured against: well-known titles with a title analysis.
const loadPool = () =>
	once("pool", async () => {
		const [movies, shows] = await Promise.all([
			query<{ fp: Record<string, number> }>(
				`SELECT fingerprint_scores AS fp FROM movie WHERE fingerprint_scores IS NOT NULL AND goodwatch_overall_score_voting_count >= 1000
				 ORDER BY goodwatch_overall_score_voting_count DESC LIMIT 4500`,
			),
			query<{ fp: Record<string, number> }>(
				`SELECT fingerprint_scores AS fp FROM show WHERE fingerprint_scores IS NOT NULL AND goodwatch_overall_score_voting_count >= 1000
				 ORDER BY goodwatch_overall_score_voting_count DESC LIMIT 1500`,
			),
		])
		const us = [...movies, ...shows].map((r) => unit(rawOf(r.fp) as number[])).filter((u): u is number[] => !!u)
		const mean = new Array(N).fill(0)
		const sd = new Array(N).fill(0)
		for (const u of us) for (let k = 0; k < N; k++) mean[k] += u[k] / us.length
		for (const u of us) for (let k = 0; k < N; k++) sd[k] += (u[k] - mean[k]) ** 2 / us.length
		for (let k = 0; k < N; k++) sd[k] = Math.sqrt(sd[k]) || 1
		return { us, mean, sd }
	})

// Fingerprints of the titles a person rated, cached per title.
const fpCache = new Map<string, { u: number[]; title: string; poster_path: string } | null>()
async function ratedTitles(keys: string[]) {
	const need: Record<Kind, number[]> = { movie: [], show: [] }
	for (const k of keys) {
		if (fpCache.has(k)) continue
		const [type, id] = k.split("-")
		if ((type === "movie" || type === "show") && Number(id)) need[type].push(Number(id))
	}
	for (const type of ["movie", "show"] as const)
		for (const part of chunks(need[type])) {
			const rows = await query<{ tmdb_id: number; title: string; poster_path: string | null; fp: Record<string, number> | null }>(
				`SELECT tmdb_id, title, poster_path, fingerprint_scores AS fp FROM ${type} WHERE tmdb_id IN (${part.join(",")})`,
			)
			const got = new Set<number>()
			for (const r of rows) {
				const u = unit(rawOf(r.fp) ?? [])
				fpCache.set(`${type}-${r.tmdb_id}`, u ? { u, title: r.title, poster_path: r.poster_path ?? "" } : null)
				got.add(r.tmdb_id)
			}
			for (const id of part) if (!got.has(id)) fpCache.set(`${type}-${id}`, null)
		}
	return new Map(keys.map((k) => [k, fpCache.get(k) ?? null]))
}

// ---------------------------------------------------------------- the person

type Signals = { scores: Map<string, number>; wish: Set<string>; watched: Set<string>; country: string; services: number[] }

async function loadMember(userId: string): Promise<Signals> {
	type R = { tmdb_id: number; media_type: string }
	const key = (r: R) => `${r.media_type}-${r.tmdb_id}`
	const [scores, wish, watched, settings] = await Promise.all([
		query<R & { score: number }>("SELECT tmdb_id, media_type, score FROM user_score WHERE user_id = ?", [userId]),
		query<R>("SELECT tmdb_id, media_type FROM user_wishlist WHERE user_id = ?", [userId]),
		query<R>("SELECT tmdb_id, media_type FROM user_watch_state WHERE user_id = ? AND state <> 'not_started'", [userId]),
		query<{ key: string; value: string }>("SELECT key, value FROM user_setting WHERE user_id = ?", [userId]),
	])
	const setting = (k: string) => settings.find((s) => s.key === k)?.value
	return {
		scores: new Map(scores.map((r) => [key(r), Number(r.score)])),
		wish: new Set(wish.map(key)),
		watched: new Set(watched.map(key)),
		country: setting("country_default") || "DE",
		services: (setting("streaming_providers_default") ?? "").split(",").map(Number).filter(Boolean),
	}
}

const demoSignals = (): Signals => {
	const s: Signals = { scores: new Map(), wish: new Set(), watched: new Set(), country: "DE", services: [] }
	for (const [k, sig] of Object.entries(DEMO_RATINGS)) {
		if (sig.kind === "score") s.scores.set(k, sig.score)
		if (sig.kind === "want") s.wish.add(k)
	}
	return s
}

const attr = (key: string): TasteAttr => ({
	key,
	label: FINGERPRINT_META[key]?.label ?? key,
	phrase: PHRASES[key] ?? (FINGERPRINT_META[key]?.label ?? key).toLowerCase(),
	emoji: FINGERPRINT_META[key]?.emoji ?? "",
})

// The bar decides "Not seen yet" from a hash of the key; pick a key suffix whose hash agrees with the truth.
function craftKey(ref: string, seen: boolean) {
	const base = ref.replace("-", ":")
	for (let i = 0; i < 400; i++) {
		const key = i ? `${base}~${i}` : base
		if (isSeen({ key } as never) === seen) return key
	}
	return base
}

export async function getDiscoverData(request: Request): Promise<{ payload: Payload; headers: Headers }> {
	const started = Date.now()
	const url = new URL(request.url)
	const as = url.searchParams.get("as") ?? "me"
	const { user, headers } = await getAuthFromRequest({ request })
	const devUser = /^[0-9a-f-]{36}$/.test(as) && url.hostname === "localhost" && process.env.NODE_ENV !== "production" ? as : null
	const userId = devUser ?? (as === "me" ? user?.id : undefined)
	const sig = userId ? await loadMember(userId) : demoSignals()
	const country = sig.country
	const mineBase = sig.services.length ? sig.services : DEMO_SERVICES
	const mine = mineBase.flatMap((id) => (id in duplicateProviderMapping ? [id, ...duplicateProviderMapping[id]] : [id]))

	const [pool, discover, search, rated] = await Promise.all([
		loadPool(),
		loadDiscover(country),
		loadSearch(country),
		ratedTitles([...new Set([...sig.scores.keys(), ...sig.wish])]),
	])

	// Taste vector: 2P - N, as #174 recommends.
	const P = new Array(N).fill(0)
	const Nv = new Array(N).fill(0)
	let wp = 0
	let wn = 0
	let liked = 0
	let disliked = 0
	for (const [k, score] of sig.scores) {
		const t = rated.get(k)
		if (!t) continue
		if (score >= 6) {
			const w = score - 5
			wp += w
			liked++
			for (let i = 0; i < N; i++) P[i] += w * t.u[i]
		} else {
			const w = 6 - score
			wn += w
			disliked++
			for (let i = 0; i < N; i++) Nv[i] += w * t.u[i]
		}
	}
	for (const k of sig.wish) {
		const t = rated.get(k)
		if (!t || sig.scores.has(k)) continue
		wp += 0.5
		for (let i = 0; i < N; i++) P[i] += 0.5 * t.u[i]
	}
	const raw = P.map((p, i) => (wp ? p / wp : 0) * (wn ? 2 : 1) - (wn ? Nv[i] / wn : 0))
	const taste = unit(raw) ?? pool.mean
	// The person's own distribution over the reference pool, as a sorted list of cosines.
	const dist = pool.us.map((u) => dot(u, taste)).sort((a, b) => a - b)
	const percentile = (c: number) => {
		let lo = 0
		let hi = dist.length
		while (lo < hi) {
			const mid = (lo + hi) >> 1
			if (dist[mid] < c) lo = mid + 1
			else hi = mid
		}
		return (lo / dist.length) * 100
	}
	// Where the person leans compared with the pool, in pool standard deviations.
	const lean = taste.map((x, k) => (x - pool.mean[k]) / pool.sd[k])
	const ranked = KEYS.map((key, k) => ({ key, v: lean[k] })).filter((a) => !CRAFT_KEYS.has(a.key))
	const top = [...ranked].sort((a, b) => b.v - a.v).slice(0, 5)
	const avoid = [...ranked].sort((a, b) => a.v - b.v).slice(0, 2)
	const topIdx = top.map((a) => KEYS.indexOf(a.key))

	// "Because you liked": the closest of their favorites, compared on the centered fingerprint.
	const center = (u: number[]) => u.map((x, k) => (x - pool.mean[k]) / pool.sd[k])
	const favorites = [...sig.scores.entries()]
		.filter(([, s]) => s >= 8)
		.sort((a, b) => b[1] - a[1])
		.slice(0, 400)
		.flatMap(([k, score]) => {
			const t = rated.get(k)
			if (!t) return []
			const c = center(t.u)
			const len = Math.sqrt(dot(c, c)) || 1
			return [{ k, score, t, c: c.map((x) => x / len) }]
		})

	const enrich = (b: Base, rel: number, relScore: number): DiscTitle => {
		const seen = sig.scores.has(b.ref) || sig.watched.has(b.ref)
		const { u, raw: fp, ...rest } = b
		let match: number | null = null
		let pct: number | null = null
		let why: string[] = []
		let against: string | null = null
		let like: DiscTitle["like"] = null
		if (u && fp) {
			pct = Math.round(percentile(dot(u, taste)) * 10) / 10
			match = Math.round(50 + 0.49 * pct)
			const z = center(u)
			why = KEYS.map((key, k) => ({ key, s: lean[k] > 0.25 && z[k] > 0.5 && fp[k] >= 6 ? lean[k] * z[k] : 0 }))
				.filter((r) => r.s > 0 && !CRAFT_KEYS.has(r.key))
				.sort((a, b) => b.s - a.s)
				.slice(0, 2)
				.map((r) => attr(r.key).phrase)
			const worst = KEYS.map((key, k) => ({ key, s: lean[k] < -0.3 && z[k] > 0.8 && fp[k] >= 6 ? -lean[k] * z[k] : 0 }))
				.filter((r) => r.s > 0 && !CRAFT_KEYS.has(r.key))
				.sort((a, b) => b.s - a.s)[0]
			against = worst ? attr(worst.key).phrase : null
			const zl = Math.sqrt(dot(z, z)) || 1
			let best = 0.35
			for (const f of favorites) {
				if (f.k === b.ref) continue
				const c = dot(f.c, z) / zl
				if (c > best) {
					best = c
					like = { title: f.t.title, poster_path: f.t.poster_path, score: f.score }
				}
			}
		}
		return {
			...rest,
			key: craftKey(b.ref, seen),
			seen,
			rated: sig.scores.get(b.ref) ?? null,
			wish: sig.wish.has(b.ref),
			match,
			pct,
			why,
			against,
			like,
			hits: fp ? topIdx.map((k) => fp[k]) : [],
			rel,
			relScore,
		}
	}

	const who: Who = {
		mode: userId ? "me" : "demo",
		fellBack: as === "me" && !userId,
		name: userId ? "You" : "Demo member",
		rated: sig.scores.size,
		liked,
		disliked,
		wish: sig.wish.size,
		watched: sig.watched.size,
	}
	const payload: Payload = {
		who,
		country,
		mine,
		demoServices: !sig.services.length,
		top: top.map((a) => attr(a.key)),
		avoid: avoid.map((a) => attr(a.key)),
		discover: discover.map((b, i) => enrich(b, i, b.popularity)),
		search: search.map((s) => ({ q: s.q, reading: s.reading, titles: s.rows.map((r, i) => enrich(r.base, i, r.score)) })),
		ms: 0,
	}
	payload.ms = Date.now() - started
	return { payload, headers }
}
