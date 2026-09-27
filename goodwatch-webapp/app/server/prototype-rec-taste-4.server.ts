// PROTOTYPE - throwaway. Round 4 of #177 on top of round 2's taste report (imported, unchanged).
// Adds only what round 4's third-view candidates need that the report doesn't carry:
// - hidden gems: titles you love that few people have rated, and unseen ones close to your taste,
// - dealbreakers: the kinds of story you reliably rate below your average, with the one you loved anyway,
// - people: portraits of the directors and actors you keep coming back to, and what of theirs you haven't seen.
// Reads ratings, lists and the title analysis (fingerprint) read-only from Crate. Nothing is written anywhere.
import { getTasteReport } from "~/server/prototype-rec-taste-2.server"
import { VALID_FINGERPRINT_KEYS } from "~/server/utils/fingerprint"
import type { Payload, Ref, Title } from "~/ui/prototype-rec-taste-2/model"
import type {
	Dealbreaker,
	Extra,
	Payload4,
	Person,
} from "~/ui/prototype-rec-taste-4/model"
import { CRAFT_KEYS, DEMO_RATINGS } from "~/ui/prototype-rec-taste/model"
import { query } from "~/utils/crate"

const TMDB = "https://image.tmdb.org/t/p"
const KEYS = [...VALID_FINGERPRINT_KEYS] as string[]
const N = KEYS.length
const NC = KEYS.map((k, i) => (CRAFT_KEYS.has(k) ? -1 : i)).filter(
	(i) => i >= 0,
)
const GEM_LIMIT = 30_000

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
type T = Title & { sa: string[] }

const COLS = `tmdb_id, title, release_year, poster_path, backdrop_path, genres,
	goodwatch_overall_score_normalized_percent AS score, goodwatch_overall_score_voting_count AS votes,
	fingerprint_scores AS fp, streaming_availabilities AS sa`

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
	countries: [],
	lang: "",
	contexts: [],
	cast: [],
	sa: r.sa ?? [],
})

const chunks = <X>(xs: X[], n = 800) =>
	Array.from({ length: Math.ceil(xs.length / n) }, (_, i) =>
		xs.slice(i * n, i * n + n),
	)

async function loadTitles(keys: string[]) {
	const byType = { movie: [] as number[], show: [] as number[] }
	for (const k of keys) {
		const [type, id] = k.split("-")
		if (type === "movie" || type === "show") byType[type].push(Number(id))
	}
	const out = new Map<string, T>()
	await Promise.all(
		(["movie", "show"] as const).flatMap((type) =>
			chunks(byType[type]).map(async (ids) => {
				if (!ids.length) return
				const rows = await query<Row>(
					`SELECT ${COLS} FROM ${type} WHERE tmdb_id IN (${ids.join(",")}) AND poster_path IS NOT NULL`,
				)
				for (const r of rows) {
					const t = toTitle(type, r)
					out.set(t.key, t)
				}
			}),
		),
	)
	return out
}

// ---------- well-made titles few people have rated, and the fingerprint scale (cached per process) ----------

type GemPool = { items: T[]; mean: number[]; sd: number[] }
let gemPool: Promise<GemPool> | null = null
const getGemPool = () => {
	gemPool ??= (async () => {
		const where = `poster_path IS NOT NULL AND backdrop_path IS NOT NULL AND fingerprint_scores IS NOT NULL
			AND goodwatch_overall_score_normalized_percent >= 72`
		const [movies, shows] = await Promise.all([
			query<Row>(
				`SELECT ${COLS} FROM movie WHERE ${where} AND goodwatch_overall_score_voting_count BETWEEN 1500 AND ${GEM_LIMIT}
				 ORDER BY goodwatch_overall_score_normalized_percent DESC LIMIT 2000`,
			),
			query<Row>(
				`SELECT ${COLS} FROM show WHERE ${where} AND goodwatch_overall_score_voting_count BETWEEN 800 AND ${GEM_LIMIT}
				 ORDER BY goodwatch_overall_score_normalized_percent DESC LIMIT 800`,
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
		return { items, mean, sd }
	})().catch((e) => {
		gemPool = null
		throw e
	})
	return gemPool
}

// ---------- the person ----------

type Signals = {
	scores: Map<string, number>
	fav: Set<string>
	skip: Set<string>
	seen: Set<string>
}

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

async function loadSignals(
	userId: string | null,
	payload: Payload,
): Promise<Signals> {
	const sig: Signals = {
		scores: new Map(),
		fav: new Set(),
		skip: new Set(),
		seen: new Set(),
	}
	if (!userId) {
		if (payload.report.who.mode === "demo") {
			for (const [k, s] of Object.entries(DEMO_RATINGS)) {
				if (s.kind === "score") sig.scores.set(k, s.score)
				if (s.kind === "no") sig.skip.add(k)
				sig.seen.add(k)
			}
		} else {
			// Signed in without a handle: fall back to the titles the report already carries.
			for (const t of Object.values(payload.items))
				if (t.mine != null) sig.scores.set(t.key, t.mine)
		}
		for (const k of sig.scores.keys()) sig.seen.add(k)
		return sig
	}
	const key = (r: { media_type: string; tmdb_id: number }) =>
		`${r.media_type}-${r.tmdb_id}`
	type R = { tmdb_id: number; media_type: string }
	const [scores, fav, skip, ...rest] = await Promise.all([
		query<R & { score: number }>(
			"SELECT tmdb_id, media_type, score FROM user_score WHERE user_id = ?",
			[userId],
		),
		query<R>(
			"SELECT tmdb_id, media_type FROM user_favorite WHERE user_id = ?",
			[userId],
		),
		query<R>("SELECT tmdb_id, media_type FROM user_skipped WHERE user_id = ?", [
			userId,
		]),
		...["user_wishlist", "user_watch_history"].map((table) =>
			query<R>(`SELECT tmdb_id, media_type FROM ${table} WHERE user_id = ?`, [
				userId,
			]),
		),
	])
	for (const r of scores) sig.scores.set(key(r), r.score)
	for (const r of fav) sig.fav.add(key(r))
	for (const r of skip) sig.skip.add(key(r))
	for (const k of [...sig.scores.keys(), ...sig.fav, ...sig.skip])
		sig.seen.add(k)
	for (const rows of rest) for (const r of rows) sig.seen.add(key(r))
	return sig
}

// ---------- math ----------

const avgOf = (xs: number[]) =>
	xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0
const round1 = (x: number) => Math.round(x * 10) / 10
const toMatch = (sim: number) =>
	Math.max(40, Math.min(99, Math.round(52 + sim * 58)))
const cosine = (a: number[], b: number[]) => {
	let d = 0
	let na = 0
	let nb = 0
	for (const k of NC) {
		d += a[k] * b[k]
		na += a[k] * a[k]
		nb += b[k] * b[k]
	}
	return na && nb ? d / Math.sqrt(na * nb) : 0
}

// ---------- extras ----------

async function buildExtra(
	payload: Payload,
	sig: Signals,
): Promise<{ extra: Extra; items: Record<string, Title> }> {
	const r = payload.report
	const [rated, pool] = await Promise.all([
		loadTitles([...new Set([...sig.scores.keys(), ...sig.fav, ...sig.skip])]),
		getGemPool(),
	])
	const v = r.vector.map((a) => a.value)
	const z = (t: T) => t.fp.map((x, k) => (x - pool.mean[k]) / pool.sd[k])
	const ref = (t: T): Ref => ({ key: t.key, match: toMatch(cosine(z(t), v)) })
	const ship = new Map<string, T>()

	const scored = [...sig.scores.entries()]
		.map(([k, score]) => ({ t: rated.get(k), score }))
		.filter((x): x is { t: T; score: number } => !!x.t)
	const mu = avgOf(scored.map((s) => s.score))
	const sigma = Math.sqrt(avgOf(scored.map((s) => (s.score - mu) ** 2))) || 1
	const lovedCut = Math.max(8, Math.round(mu + 0.6 * sigma))

	// Hidden gems: loved titles with few ratings; a 10 nobody knows says more than an 8 nobody knows.
	const loved = scored.filter(
		(s) => s.score >= lovedCut || sig.fav.has(s.t.key),
	)
	const few = loved
		.filter((s) => s.t.votes > 0 && s.t.votes < GEM_LIMIT)
		.sort(
			(a, b) =>
				Math.log10(a.t.votes) -
				0.5 * (a.score - lovedCut) -
				(Math.log10(b.t.votes) - 0.5 * (b.score - lovedCut)),
		)
	const relative = few.length < 4
	const gemKeys = (
		relative
			? [...loved].sort((a, b) => a.t.votes - b.t.votes).slice(0, 8)
			: few.slice(0, 16)
	).map((s) => {
		ship.set(s.t.key, s.t)
		return s.t.key
	})
	// Few little-known titles stream anywhere, so keep the best ones on your services alongside the best overall.
	const onMine = payload.services
		.filter((sv) => sv.mine)
		.map((sv) => `${r.who.country}_${sv.id}`)
	const rankedGems = pool.items
		.filter((t) => !sig.seen.has(t.key))
		.map((t) => ({ t, value: cosine(z(t), v) + 0.4 * ((t.score - 72) / 100) }))
		.sort((a, b) => b.value - a.value)
	const gemPicks = [
		...rankedGems.slice(0, 12),
		...rankedGems
			.slice(12)
			.filter((x) => x.t.sa.some((a) => onMine.includes(a)))
			.slice(0, 8),
	]
		.sort((a, b) => b.value - a.value)
		.map((x) => {
			ship.set(x.t.key, x.t)
			return ref(x.t)
		})

	// Dealbreakers: kinds of story (attribute score 7+) you pass on (skip) or pan (rate 5 or lower) far more
	// often than anything else. Sensual titles are left out: skipped adult titles aren't a taste worth showing.
	const panned = (key: string) =>
		sig.skip.has(key) || (sig.scores.get(key) ?? 10) <= 5
	const met = [
		...scored.map((s) => s.t),
		...[...sig.skip]
			.filter((k) => !sig.scores.has(k))
			.map((k) => rated.get(k))
			.filter((t): t is T => !!t),
	]
	const base = met.filter((t) => panned(t.key)).length / (met.length || 1)
	const minN = Math.max(5, Math.round(met.length * 0.02))
	const cands = NC.filter((k) => KEYS[k] !== "eroticism")
		.map((k) => {
			const hit = met.filter((t) => t.fp[k] >= 7)
			const lost = hit.filter((t) => panned(t.key))
			return { k, hit, lost, rate: lost.length / (hit.length || 1) }
		})
		.filter(
			(c) =>
				c.hit.length >= minN &&
				c.lost.length >= 3 &&
				c.rate >= Math.max(base * 1.25, base + 0.05),
		)
		.sort(
			(a, b) =>
				(b.rate - base) * Math.sqrt(b.hit.length) -
				(a.rate - base) * Math.sqrt(a.hit.length),
		)
	const picked: typeof cands = []
	for (const c of cands) {
		if (picked.length >= 4) break
		const keys = new Set(c.lost.map((t) => t.key))
		const overlap = (p: (typeof cands)[number]) =>
			p.lost.filter((t) => keys.has(t.key)).length /
			Math.min(p.lost.length, c.lost.length)
		if (picked.some((p) => overlap(p) > 0.6)) continue
		picked.push(c)
	}
	const dealbreakers: Dealbreaker[] = picked.map((c) => {
		const low = c.lost
			.filter((t) => sig.scores.has(t.key))
			.sort(
				(a, b) =>
					(sig.scores.get(a.key) ?? 0) - (sig.scores.get(b.key) ?? 0) ||
					b.votes - a.votes,
			)
		const skipped = c.lost
			.filter((t) => !sig.scores.has(t.key) && t.votes >= 20_000)
			.sort((a, b) => b.votes - a.votes)
		const lost = [...low, ...skipped].slice(0, 6)
		// The exception: a title you loved that is most strongly this kind of story.
		const exception = c.hit
			.filter((t) => (sig.scores.get(t.key) ?? 0) >= lovedCut)
			.sort(
				(a, b) =>
					b.fp[c.k] - a.fp[c.k] ||
					(sig.scores.get(b.key) ?? 0) - (sig.scores.get(a.key) ?? 0) ||
					b.votes - a.votes,
			)[0]
		for (const t of [...lost, ...(exception ? [exception] : [])])
			ship.set(t.key, t)
		return {
			key: KEYS[c.k],
			met: c.hit.length,
			panned: c.lost.length,
			lost: lost.map((t) => t.key),
			exception: exception?.key ?? null,
		}
	})

	// People: portraits and what of theirs you haven't seen.
	const stats = [
		...r.people.directors
			.slice(0, 6)
			.map((p) => ({ ...p, role: "director" as const })),
		...r.people.actors
			.slice(0, 6)
			.map((p) => ({ ...p, role: "actor" as const })),
	]
	const names = [...new Set(stats.map((p) => p.name))]
	const found = names.length
		? await query<{
				tmdb_id: number
				original_name: string
				profile_path: string | null
				popularity: number | null
			}>(
				`SELECT tmdb_id, original_name, profile_path, popularity FROM person WHERE original_name IN (${names.map(() => "?").join(",")})`,
				names,
			)
		: []
	const byName = new Map<string, (typeof found)[number]>()
	for (const f of found) {
		const prev = byName.get(f.original_name)
		if (!prev || (f.popularity ?? 0) > (prev.popularity ?? 0))
			byName.set(f.original_name, f)
	}
	const ids = [...byName.values()].map((f) => f.tmdb_id)
	type Link = { pid: number; media_type: string; mid: number }
	const [directed, acted] = ids.length
		? await Promise.all([
				query<Link>(
					`SELECT person_tmdb_id AS pid, media_type, media_tmdb_id AS mid FROM person_worked_on
					 WHERE person_tmdb_id IN (${ids.join(",")}) AND job = 'Director' LIMIT 3000`,
				),
				query<Link>(
					`SELECT person_tmdb_id AS pid, media_type, media_tmdb_id AS mid FROM person_appeared_in
					 WHERE person_tmdb_id IN (${ids.join(",")}) AND order_default <= 3 LIMIT 3000`,
				),
			])
		: [[], []]
	const linkKeys = [...directed, ...acted]
		.map((l) => `${l.media_type}-${l.mid}`)
		.filter((k) => !sig.seen.has(k))
	const theirs = await loadTitles([...new Set(linkKeys)])
	const people: Person[] = stats.map((p) => {
		const f = byName.get(p.name)
		const links = f
			? (p.role === "director" ? directed : acted).filter(
					(l) => l.pid === f.tmdb_id,
				)
			: []
		const unseen = links
			.map((l) => theirs.get(`${l.media_type}-${l.mid}`))
			// Films only for directors (a TV credit is usually one episode); known work only, no cuts or making-ofs.
			.filter(
				(t): t is T =>
					!!t &&
					!!t.backdrop &&
					t.votes >= 20_000 &&
					t.score > 0 &&
					(p.role === "actor" || t.type === "movie") &&
					t.year <= new Date().getFullYear() &&
					!/extended|making|behind the|director's cut|special edition|untitled/i.test(
						t.title,
					),
			)
			.filter((t, i, xs) => xs.findIndex((x) => x.title === t.title) === i)
			.sort((a, b) => b.score - a.score)
			.slice(0, 6)
		for (const t of unseen) ship.set(t.key, t)
		return {
			name: p.name,
			role: p.role,
			id: f?.tmdb_id ?? null,
			portrait: f?.profile_path ?? null,
			count: p.count,
			avg: p.avg,
			keys: p.keys,
			unseen: unseen.map(ref),
		}
	})

	// Titles the extras show, in the shape the client expects (fingerprint stripped).
	const allIds = payload.services.map((s) => s.id)
	const items: Record<string, Title> = {}
	for (const [key, t] of ship) {
		if (payload.items[key]) continue
		const { sa, ...rest } = t
		items[key] = {
			...rest,
			fp: [],
			mine: sig.scores.get(key),
			fav: sig.fav.has(key) || undefined,
			services: allIds.filter((id) =>
				sa.includes(`${payload.report.who.country}_${id}`),
			),
		}
	}
	return {
		extra: {
			mu: round1(mu),
			gems: {
				keys: gemKeys,
				loved: loved.length,
				few: few.length,
				limit: GEM_LIMIT,
				relative,
				picks: gemPicks,
			},
			dealbreakers,
			pannedBase: Math.round(base * 100) / 100,
			people,
		},
		items,
	}
}

// ---------- entry ----------

const cache = new Map<
	string,
	{ at: number; extra: Extra; items: Record<string, Title> }
>()

export async function getTasteReport4(
	request: Request,
): Promise<{ payload: Payload4; headers: Headers }> {
	const { payload, headers } = await getTasteReport(request)
	const userId = await userIdFor(request, payload)
	const cacheKey = userId ?? payload.report.who.mode
	let hit = cache.get(cacheKey)
	if (!hit || Date.now() - hit.at > 5 * 60_000) {
		const sig = await loadSignals(userId, payload)
		hit = { at: Date.now(), ...(await buildExtra(payload, sig)) }
		cache.set(cacheKey, hit)
	}
	return {
		payload: {
			...payload,
			items: { ...hit.items, ...payload.items },
			extra: hit.extra,
		},
		headers,
	}
}
