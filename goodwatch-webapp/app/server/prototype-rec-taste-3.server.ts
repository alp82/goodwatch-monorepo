// PROTOTYPE - throwaway. Round 3 of #177 on top of round 2's taste report (imported, unchanged).
// Adds what the Sides direction needs to merge in Frontiers: for each side of someone's taste, its edge,
// the kind of story just past it that they have rarely gone to from there, with titles to cross over with.
// Round 2's country, language and decade frontiers are hung on the side they sit closest to.
// Reads ratings and the title analysis (fingerprint) read-only from Crate. Nothing is written anywhere.
import { getTasteReport } from "~/server/prototype-rec-taste-2.server"
import { VALID_FINGERPRINT_KEYS } from "~/server/utils/fingerprint"
import type { Payload, Ref, Title } from "~/ui/prototype-rec-taste-2/model"
import { cap } from "~/ui/prototype-rec-taste-2/words"
import type { Edge, Payload3 } from "~/ui/prototype-rec-taste-3/model"
import {
	CRAFT_KEYS,
	DEMO_RATINGS,
	PHRASES,
} from "~/ui/prototype-rec-taste/model"
import { query } from "~/utils/crate"

const TMDB = "https://image.tmdb.org/t/p"
const KEYS = [...VALID_FINGERPRINT_KEYS] as string[]
const N = KEYS.length
const NC = KEYS.map((k, i) => (CRAFT_KEYS.has(k) ? -1 : i)).filter(
	(i) => i >= 0,
)

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
	oc: string[] | null
	pc: string[] | null
	lang: string | null
}
type T = Title & { sa: string[]; z: number[] }

const COLS = `tmdb_id, title, release_year, poster_path, backdrop_path, genres,
	goodwatch_overall_score_normalized_percent AS score, goodwatch_overall_score_voting_count AS votes,
	fingerprint_scores AS fp,
	origin_country_codes AS oc, production_country_codes AS pc, original_language_code AS lang`

const toTitle = (type: "movie" | "show", r: Row): T => ({
	key: `${type}-${r.tmdb_id}`,
	type,
	id: r.tmdb_id,
	title: r.title,
	year: r.release_year ?? 0,
	poster: r.poster_path ? `${TMDB}/w342${r.poster_path}` : "",
	backdrop: r.backdrop_path ? `${TMDB}/w1280${r.backdrop_path}` : "",
	genres: r.genres ?? [],
	score: r.score == null ? 0 : Math.floor(r.score),
	votes: r.votes ?? 0,
	fp: KEYS.map((k) => r.fp?.[k] ?? 0),
	services: [],
	directors: [],
	synopsis: "",
	tags: [],
	countries: (r.oc?.length ? r.oc : (r.pc ?? [])).slice(0, 2),
	lang: r.lang ?? "",
	contexts: [],
	cast: [],
	sa: [],
	z: [],
})

// ---------- catalog pool, the same slice round 2 recommends from (cached per server process) ----------

type Pool = { items: T[]; byKey: Map<string, T>; mean: number[]; sd: number[] }

async function loadPool(): Promise<Pool> {
	const [movies, shows] = await Promise.all([
		query<Row>(
			`SELECT ${COLS} FROM movie WHERE poster_path IS NOT NULL AND backdrop_path IS NOT NULL AND fingerprint_scores IS NOT NULL
			 AND goodwatch_overall_score_voting_count >= 3000 ORDER BY goodwatch_overall_score_voting_count DESC LIMIT 2200`,
		),
		query<Row>(
			`SELECT ${COLS} FROM show WHERE poster_path IS NOT NULL AND backdrop_path IS NOT NULL AND fingerprint_scores IS NOT NULL
			 AND goodwatch_overall_score_voting_count >= 1000 ORDER BY goodwatch_overall_score_voting_count DESC LIMIT 800`,
		),
	])
	const items = [
		...movies.map((r) => toTitle("movie", r)),
		...shows.map((r) => toTitle("show", r)),
	]
	const mean = new Array(N).fill(0)
	const sd = new Array(N).fill(0)
	for (const it of items)
		for (let k = 0; k < N; k++) mean[k] += it.fp[k] / items.length
	for (const it of items)
		for (let k = 0; k < N; k++)
			sd[k] += (it.fp[k] - mean[k]) ** 2 / items.length
	for (let k = 0; k < N; k++) sd[k] = Math.sqrt(sd[k]) || 1
	for (const it of items) it.z = it.fp.map((v, k) => (v - mean[k]) / sd[k])
	return { items, byKey: new Map(items.map((i) => [i.key, i])), mean, sd }
}

let poolPromise: Promise<Pool> | null = null
const getPool = () => {
	poolPromise ??= loadPool().catch((e) => {
		poolPromise = null
		throw e
	})
	return poolPromise
}

const extraCache = new Map<string, T | null>()
async function loadTitles(keys: string[], pool: Pool) {
	const out = new Map<string, T>()
	const missing: Record<"movie" | "show", number[]> = { movie: [], show: [] }
	for (const key of keys) {
		const hit = pool.byKey.get(key) ?? extraCache.get(key)
		if (hit) out.set(key, hit)
		else if (!extraCache.has(key)) {
			const [type, id] = key.split("-")
			if ((type === "movie" || type === "show") && Number(id))
				missing[type].push(Number(id))
		}
	}
	for (const type of ["movie", "show"] as const) {
		const ids = missing[type]
		for (let i = 0; i < ids.length; i += 800) {
			const part = ids.slice(i, i + 800)
			const rows = await query<Row>(
				`SELECT ${COLS} FROM ${type} WHERE fingerprint_scores IS NOT NULL AND poster_path IS NOT NULL AND tmdb_id IN (${part.join(",")})`,
			)
			const found = new Set<number>()
			for (const r of rows) {
				const t = toTitle(type, r)
				t.z = t.fp.map((v, k) => (v - pool.mean[k]) / pool.sd[k])
				extraCache.set(t.key, t)
				out.set(t.key, t)
				found.add(r.tmdb_id)
			}
			for (const id of part)
				if (!found.has(id)) extraCache.set(`${type}-${id}`, null)
		}
	}
	return out
}

// ---------- the person, read-only ----------

type Signals = { scores: Map<string, number>; seen: Set<string> }

async function userIdFor(request: Request, payload: Payload) {
	const url = new URL(request.url)
	const as = url.searchParams.get("as") ?? "me"
	if (
		/^[0-9a-f-]{36}$/.test(as) &&
		url.hostname === "localhost" &&
		process.env.NODE_ENV !== "production"
	)
		return as
	const handle = payload.report.who.handle
	if (payload.report.who.mode !== "me" || !handle) return null
	const rows = await query<{ user_id: string }>(
		"SELECT user_id FROM user_handle WHERE handle = ? AND released_at IS NULL AND deleted_at IS NULL LIMIT 1",
		[handle],
	)
	return rows[0]?.user_id ?? null
}

async function loadSignals(userId: string | null, payload: Payload) {
	const sig: Signals = { scores: new Map(), seen: new Set() }
	if (!userId) {
		if (payload.report.who.mode === "demo")
			for (const [k, s] of Object.entries(DEMO_RATINGS)) {
				if (s.kind === "score") sig.scores.set(k, s.score)
				sig.seen.add(k)
			}
		else
			// Signed in without a handle: fall back to the titles the report already carries.
			for (const t of Object.values(payload.items))
				if (t.mine != null) sig.scores.set(t.key, t.mine)
		for (const k of sig.scores.keys()) sig.seen.add(k)
		return sig
	}
	const key = (r: { media_type: string; tmdb_id: number }) =>
		`${r.media_type}-${r.tmdb_id}`
	type R = { tmdb_id: number; media_type: string }
	const [scores, ...rest] = await Promise.all([
		query<R & { score: number }>(
			"SELECT tmdb_id, media_type, score FROM user_score WHERE user_id = ?",
			[userId],
		),
		...[
			"user_wishlist",
			"user_skipped",
			"user_watch_history",
			"user_favorite",
		].map((table) =>
			query<R>(`SELECT tmdb_id, media_type FROM ${table} WHERE user_id = ?`, [
				userId,
			]),
		),
	])
	for (const r of scores) {
		sig.scores.set(key(r), r.score)
		sig.seen.add(key(r))
	}
	for (const rows of rest) for (const r of rows) sig.seen.add(key(r))
	return sig
}

// ---------- math ----------

const dot = (a: number[], b: number[], idx: number[] = NC) => {
	let d = 0
	let na = 0
	let nb = 0
	for (const k of idx) {
		d += a[k] * b[k]
		na += a[k] * a[k]
		nb += b[k] * b[k]
	}
	return na && nb ? d / Math.sqrt(na * nb) : 0
}
const avgOf = (xs: number[]) =>
	xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0
const meanVec = (ts: T[]) => {
	const v = new Array(N).fill(0)
	for (const t of ts) for (let k = 0; k < N; k++) v[k] += t.z[k] / ts.length
	return v
}
const toMatch = (sim: number) =>
	Math.max(40, Math.min(99, Math.round(52 + sim * 58)))
const round1 = (x: number) => Math.round(x * 10) / 10
const phrase = (k: string) => PHRASES[k] ?? k.replace(/_/g, " ")

// ---------- edges ----------

function addEdges(
	payload: Payload,
	sig: Signals,
	titles: Map<string, T>,
	pool: Pool,
) {
	const r = payload.report
	const v = r.vector.map((a) => a.value)
	const scored = [...sig.scores.entries()]
		.map(([k, score]) => ({ t: titles.get(k), score }))
		.filter((s): s is { t: T; score: number } => !!s.t)
	const mu = avgOf(scored.map((s) => s.score))
	const selMean = meanVec(scored.map((s) => s.t))
	const unseen = pool.items.filter((t) => !sig.seen.has(t.key))
	const added = new Map<string, T>()
	const ref = (t: T): Ref => {
		added.set(t.key, t)
		return { key: t.key, match: toMatch(dot(t.z, v)) }
	}

	const centers = new Map(
		r.sides.map((s) => {
			const ts = s.titles.map((k) => titles.get(k)).filter((t): t is T => !!t)
			return [s.id, ts.length ? meanVec(ts) : v] as const
		}),
	)

	// Every side's own attributes are home ground, not an edge.
	const home = new Set(r.sides.flatMap((s) => s.attrs))
	const taken = new Set<string>()
	const shownPicks = new Set<string>()
	const edges: Record<string, Edge | null> = {}
	for (const side of r.sides) {
		const c = centers.get(side.id) as number[]
		const near = scored.filter((s) => dot(s.t.z, c) > 0.3)
		const around = unseen.filter((t) => dot(t.z, c) > 0.25)
		let best: (Omit<Edge, "picks"> & { value: number; pickTs: T[] }) | null =
			null
		for (const k of NC) {
			const key = KEYS[k]
			if (home.has(key) || taken.has(key)) continue
			if (c[k] > 0.6 || selMean[k] > 0.15 || v[k] < -0.3) continue
			const hit = near.filter((s) => s.t.z[k] > 1)
			const lift = hit.length >= 2 ? avgOf(hit.map((s) => s.score)) - mu : 0
			if (hit.length >= 2 && lift < -0.2) continue
			const share = near.length ? hit.length / near.length : 0
			if (share > 0.12) continue // you already go there often enough
			const cands = around
				.filter(
					(t) =>
						t.z[k] > 1.2 && !shownPicks.has(t.key) && toMatch(dot(t.z, v)) >= 58,
				)
				.map((t) => ({
					t,
					value:
						dot(t.z, c) +
						0.6 * dot(t.z, v) +
						0.12 * Math.min(3, t.z[k]) +
						0.4 * ((t.score - 72) / 100),
				}))
				.sort((a, b) => b.value - a.value)
			if (cands.length < 5) continue
			const value =
				1.2 * lift * Math.sqrt(Math.min(hit.length, 6)) +
				2 * avgOf(cands.slice(0, 4).map((x) => dot(x.t.z, c))) +
				avgOf(cands.slice(0, 4).map((x) => dot(x.t.z, v))) +
				3 * (0.12 - share)
			if (best && value <= best.value) continue
			const n = hit.length
			const avg = n >= 2 ? round1(avgOf(hit.map((s) => s.score))) : null
			best = {
				value,
				key,
				name: cap(phrase(key)),
				phrase: phrase(key),
				rated: n,
				of: near.length,
				avg,
				line:
					avg != null && n >= 2
						? `Only ${n} of the ${near.length} titles you rated on this side go there, and you gave them ${avg} on average, against your usual ${round1(mu)}.`
						: "You've barely gone there from this side.",
				evidence: [...hit]
					.map((s) => ({
						...s,
						w: (s.score - mu) / 2 + 2 * dot(s.t.z, c) + 0.3 * s.t.z[k],
					}))
					.sort((a, b) => b.w - a.w)
					.slice(0, 4)
					.map((s) => s.t.key),
				pickTs: cands.slice(0, 10).map((x) => x.t),
			}
		}
		if (best) {
			taken.add(best.key)
			const { value, pickTs, ...edge } = best
			const picks = pickTs.map(ref)
			for (const t of pickTs) shownPicks.add(t.key)
			for (const k of edge.evidence) {
				const t = titles.get(k)
				if (t) added.set(k, t)
			}
			edges[side.id] = { ...edge, picks }
		} else edges[side.id] = null
	}

	// Round 2's country, language and decade frontiers, each hung on the side it sits closest to.
	const further: Record<string, string[]> = Object.fromEntries(
		r.sides.map((s) => [s.id, []]),
	)
	for (const f of r.frontiers) {
		if (f.kind === "attr") continue
		const ts = [...f.picks.map((p) => p.key), ...f.evidence]
			.map((k) => titles.get(k) ?? pool.byKey.get(k))
			.filter((t): t is T => !!t)
		if (!ts.length || !r.sides.length) continue
		const fv = meanVec(ts)
		const side = [...r.sides].sort(
			(a, b) =>
				dot(fv, centers.get(b.id) as number[]) -
				dot(fv, centers.get(a.id) as number[]),
		)[0]
		further[side.id].push(f.id)
	}

	return { added, edges, further }
}

// Availability only for the titles the page ships: the pool query skips it, it's most of the bytes.
async function loadAvailability(keys: string[]) {
	const out = new Map<string, string[]>()
	for (const type of ["movie", "show"] as const) {
		const ids = keys
			.filter((k) => k.startsWith(`${type}-`))
			.map((k) => Number(k.split("-")[1]))
			.filter(Boolean)
		if (!ids.length) continue
		const rows = await query<{ tmdb_id: number; sa: string[] | null }>(
			`SELECT tmdb_id, streaming_availabilities AS sa FROM ${type} WHERE tmdb_id IN (${ids.join(",")})`,
		)
		for (const r of rows) out.set(`${type}-${r.tmdb_id}`, r.sa ?? [])
	}
	return out
}

function ship(
	payload: Payload,
	sig: Signals,
	found: ReturnType<typeof addEdges>,
	sa: Map<string, string[]>,
): Payload3 {
	const r = payload.report
	const { added, edges, further } = found
	// Ship the new titles in the client shape, with availability for the person's country.
	const ids = payload.services.map((s) => s.id)
	const items = { ...payload.items }
	for (const [key, t] of added) {
		if (items[key]) continue
		const { sa: _sa, z, ...rest } = t
		const avail = sa.get(key) ?? []
		items[key] = {
			...rest,
			fp: [],
			mine: sig.scores.get(key),
			services: ids.filter((id) => avail.includes(`${r.who.country}_${id}`)),
		}
	}
	return { ...payload, items, edges, further }
}

// ---------- entry ----------

const cache = new Map<string, { at: number; payload: Payload3 }>()

export async function getTasteReport3(request: Request) {
	const { payload, headers } = await getTasteReport(request)
	const userId = await userIdFor(request, payload)
	const cacheKey = userId ?? payload.report.who.mode
	const hit = cache.get(cacheKey)
	if (hit && Date.now() - hit.at < 5 * 60_000)
		return {
			payload: {
				...hit.payload,
				report: { ...hit.payload.report, who: payload.report.who },
			},
			headers,
		}
	const [pool, sig] = await Promise.all([
		getPool(),
		loadSignals(userId, payload),
	])
	const keys = new Set([
		...sig.scores.keys(),
		...payload.report.sides.flatMap((s) => s.titles),
		...payload.report.frontiers.flatMap((f) => [
			...f.evidence,
			...f.picks.map((p) => p.key),
		]),
	])
	const titles = await loadTitles([...keys], pool)
	const found = addEdges(payload, sig, titles, pool)
	const sa = await loadAvailability(
		[...found.added.keys()].filter((k) => !payload.items[k]),
	)
	const out = ship(payload, sig, found, sa)
	cache.set(cacheKey, { at: Date.now(), payload: out })
	return { payload: out, headers }
}
