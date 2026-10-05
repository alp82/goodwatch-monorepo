import { getTastePool } from "~/server/prototype-rec-taste.server"
// PROTOTYPE - throwaway. Taste report for /prototype/rec-taste-2.
// Reads a signed-in person's ratings, Wishlist, skipped, watched and favorite titles (read-only, straight
// from Crate, bypassing the user-data cache), or falls back to round 1's demo member. Computes the whole
// report on the server so the client only receives the titles it shows. Nothing is written anywhere.
import { VALID_FINGERPRINT_KEYS } from "~/server/utils/fingerprint"
import { FINGERPRINT_META } from "~/ui/fingerprint/fingerprintMeta"
import type {
	Attr,
	CrowdRow,
	Era,
	FriendReport,
	Frontier,
	Mood,
	Payload,
	PersonStat,
	Ref,
	Report,
	Service,
	Side,
	Title,
	Trait,
} from "~/ui/prototype-rec-taste-2/model"
import {
	CONTEXTS,
	FRIENDS,
	adj,
	cap,
	noun,
	persona,
} from "~/ui/prototype-rec-taste-2/words"
import {
	CRAFT_KEYS,
	DEMO_RATINGS,
	DEMO_SERVICES,
	PHRASES,
	SERVICE_IDS,
} from "~/ui/prototype-rec-taste/model"
import { getAuthFromRequest } from "~/utils/auth"
import { query } from "~/utils/crate"

const TMDB = "https://image.tmdb.org/t/p"
const KEYS = [...VALID_FINGERPRINT_KEYS] as string[]
const N = KEYS.length
const NC = KEYS.map((k, i) => (CRAFT_KEYS.has(k) ? -1 : i)).filter(
	(i) => i >= 0,
)
const CONTEXT_COLS = CONTEXTS.map((c) => `context_is_${c.id}`)

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
	tags: string[] | null
	oc: string[] | null
	pc: string[] | null
	lang: string | null
	[ctx: string]: unknown
}

// Server-side title: the client Title plus raw availability and the z-scored fingerprint.
type T = Title & { sa: string[]; z: number[] }

const COLS = `tmdb_id, title, release_year, poster_path, backdrop_path, genres,
	goodwatch_overall_score_normalized_percent AS score, goodwatch_overall_score_voting_count AS votes,
	fingerprint_scores AS fp, streaming_availabilities AS sa, essence_tags AS tags,
	origin_country_codes AS oc, production_country_codes AS pc, original_language_code AS lang, ${CONTEXT_COLS.join(", ")}`

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
	tags: (r.tags ?? []).slice(0, 4),
	countries: (r.oc?.length ? r.oc : (r.pc ?? [])).slice(0, 2),
	lang: r.lang ?? "",
	contexts: CONTEXTS.filter((c) => r[`context_is_${c.id}`] === true).map(
		(c) => c.id,
	),
	cast: [],
	sa: r.sa ?? [],
	z: [],
})

// ---------- catalog pool (cached per server process) ----------

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

// Titles outside the pool (someone's niche ratings), with directors and top cast. Cached by key.
const extraCache = new Map<string, T | null>()
const peopleCache = new Map<string, { directors: string[]; cast: string[] }>()

const chunks = <X>(xs: X[], n = 800) =>
	Array.from({ length: Math.ceil(xs.length / n) }, (_, i) =>
		xs.slice(i * n, i * n + n),
	)

async function loadTitles(keys: string[], pool: Pool): Promise<Map<string, T>> {
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
		for (const ids of chunks(missing[type])) {
			const rows = await query<Row>(
				`SELECT ${COLS} FROM ${type} WHERE fingerprint_scores IS NOT NULL AND poster_path IS NOT NULL AND tmdb_id IN (${ids.join(",")})`,
			)
			const found = new Set<number>()
			for (const r of rows) {
				const t = toTitle(type, r)
				t.z = t.fp.map((v, k) => (v - pool.mean[k]) / pool.sd[k])
				extraCache.set(t.key, t)
				out.set(t.key, t)
				found.add(r.tmdb_id)
			}
			for (const id of ids)
				if (!found.has(id)) extraCache.set(`${type}-${id}`, null)
		}
	}
	// Directors (films only; TV directors change per episode) and the first four billed actors.
	const need = [...out.values()].filter((t) => !peopleCache.has(t.key))
	for (const type of ["movie", "show"] as const) {
		const ids = need.filter((t) => t.type === type).map((t) => t.id)
		for (const part of chunks(ids)) {
			// No joins: Crate answers the join here in over a minute, the two lookups in well under a second.
			const [dirRows, castRows] = await Promise.all([
				type === "movie"
					? query<{ id: number; pid: number }>(
							`SELECT media_tmdb_id AS id, person_tmdb_id AS pid FROM person_worked_on
							 WHERE media_type = 'movie' AND job = 'Director' AND media_tmdb_id IN (${part.join(",")})`,
						)
					: Promise.resolve([]),
				query<{ id: number; pid: number; o: number }>(
					`SELECT media_tmdb_id AS id, person_tmdb_id AS pid, order_default AS o FROM person_appeared_in
					 WHERE media_type = '${type}' AND order_default <= 3 AND media_tmdb_id IN (${part.join(",")})`,
				),
			])
			const pids = [...new Set([...dirRows, ...castRows].map((r) => r.pid))]
			const names = new Map<number, string>()
			for (const pp of chunks(pids, 1500)) {
				const rows = await query<{ tmdb_id: number; name: string }>(
					`SELECT tmdb_id, name FROM person WHERE tmdb_id IN (${pp.join(",")})`,
				)
				for (const r of rows) names.set(r.tmdb_id, r.name)
			}
			const dirs = dirRows
				.map((r) => ({ id: r.id, name: names.get(r.pid) ?? "" }))
				.filter((r) => r.name)
			const cast = castRows
				.map((r) => ({ id: r.id, o: r.o, name: names.get(r.pid) ?? "" }))
				.filter((r) => r.name)
			const entry = (id: number) => {
				const key = `${type}-${id}`
				const e = peopleCache.get(key) ?? { directors: [], cast: [] }
				peopleCache.set(key, e)
				return e
			}
			for (const id of part) entry(id)
			for (const d of dirs)
				if (!entry(d.id).directors.includes(d.name))
					entry(d.id).directors.push(d.name)
			for (const c of cast.sort((a, b) => a.o - b.o))
				if (!entry(c.id).cast.includes(c.name)) entry(c.id).cast.push(c.name)
		}
	}
	for (const t of out.values()) {
		const p = peopleCache.get(t.key)
		if (p) {
			t.directors = p.directors
			t.cast = p.cast
		}
	}
	return out
}

// ---------- the person ----------

type Signals = {
	scores: Map<string, { score: number; at: number | null }>
	wish: Set<string>
	skip: Set<string>
	watched: Set<string>
	fav: Set<string>
}

type Who = {
	mode: "me" | "demo"
	fellBack: boolean
	name: string
	handle: string | null
	country: string
	services: number[]
}

async function loadMember(
	userId: string,
): Promise<
	Signals & { country: string; services: number[]; handle: string | null }
> {
	const key = (r: { media_type: string; tmdb_id: number }) =>
		`${r.media_type}-${r.tmdb_id}`
	type R = { tmdb_id: number; media_type: string; at?: number }
	const [scores, wish, skip, watched, fav, settings, handle] =
		await Promise.all([
			query<R & { score: number }>(
				"SELECT tmdb_id, media_type, score, updated_at AS at FROM user_score WHERE user_id = ?",
				[userId],
			),
			query<R>(
				"SELECT tmdb_id, media_type FROM user_wishlist WHERE user_id = ?",
				[userId],
			),
			query<R>(
				"SELECT tmdb_id, media_type FROM user_skipped WHERE user_id = ?",
				[userId],
			),
			query<R>(
				"SELECT tmdb_id, media_type FROM user_watch_history WHERE user_id = ?",
				[userId],
			),
			query<R>(
				"SELECT tmdb_id, media_type FROM user_favorite WHERE user_id = ?",
				[userId],
			),
			query<{ key: string; value: string }>(
				"SELECT key, value FROM user_setting WHERE user_id = ?",
				[userId],
			),
			query<{ handle: string }>(
				"SELECT handle FROM user_handle WHERE user_id = ? AND released_at IS NULL AND deleted_at IS NULL LIMIT 1",
				[userId],
			),
		])
	const setting = (k: string) => settings.find((s) => s.key === k)?.value
	return {
		scores: new Map(
			scores.map((r) => [
				key(r),
				{ score: r.score, at: r.at ? Number(new Date(r.at)) : null },
			]),
		),
		wish: new Set(wish.map(key)),
		skip: new Set(skip.map(key)),
		watched: new Set(watched.map(key)),
		fav: new Set(fav.map(key)),
		country: setting("country_default") || "DE",
		services: (setting("streaming_providers_default") ?? "")
			.split(",")
			.map(Number)
			.filter(Boolean),
		handle: handle[0]?.handle ?? null,
	}
}

const demoSignals = (): Signals => {
	const s: Signals = {
		scores: new Map(),
		wish: new Set(),
		skip: new Set(),
		watched: new Set(),
		fav: new Set(),
	}
	for (const [k, sig] of Object.entries(DEMO_RATINGS)) {
		if (sig.kind === "score") s.scores.set(k, { score: sig.score, at: null })
		if (sig.kind === "want") s.wish.add(k)
	}
	return s
}

// ---------- math ----------

const dot = (a: number[], b: number[], idx?: number[]) => {
	let d = 0
	let na = 0
	let nb = 0
	const it = idx ?? a.map((_, i) => i)
	for (const k of it) {
		d += a[k] * b[k]
		na += a[k] * a[k]
		nb += b[k] * b[k]
	}
	return na && nb ? d / Math.sqrt(na * nb) : 0
}
const unit = (v: number[]) => {
	const len = Math.sqrt(v.reduce((a, x) => a + x * x, 0)) || 1
	return v.map((x) => x / len)
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
const label = (k: string) => FINGERPRINT_META[k]?.label ?? k
const phrase = (k: string) => PHRASES[k] ?? label(k).toLowerCase()
const list = (xs: string[]) =>
	xs.length > 1
		? `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`
		: (xs[0] ?? "")

/** A taste vector: half what you choose to watch, half what you rate above your own average. */
function tasteVector(
	scored: { t: T; score: number }[],
	chosen: T[],
	wish: T[],
	skip: T[],
) {
	const scores = scored.map((s) => s.score)
	const mu = avgOf(scores)
	const sigma = Math.sqrt(avgOf(scores.map((s) => (s - mu) ** 2))) || 1
	const pref = new Array(N).fill(0)
	let total = 0
	const add = (t: T, w: number) => {
		total += Math.abs(w)
		for (let k = 0; k < N; k++) pref[k] += w * t.z[k]
	}
	for (const s of scored)
		add(s.t, Math.max(-2, Math.min(2, (s.score - mu) / sigma)))
	for (const t of wish) add(t, 0.3)
	for (const t of skip) add(t, -0.6)
	if (total) for (let k = 0; k < N; k++) pref[k] /= total
	const sel = unit(meanVec(chosen))
	const p = unit(pref)
	return { v: sel.map((x, k) => (0.45 * x + 0.55 * p[k]) * 2), mu, sigma }
}

function kmeans(points: T[], k: number, seed: number[]) {
	if (points.length < k * 3) k = Math.max(1, Math.floor(points.length / 2.5))
	// Farthest-first init from the title closest to the person's taste.
	const start = [...points].sort(
		(a, b) => dot(b.z, seed, NC) - dot(a.z, seed, NC),
	)[0]
	const centers: number[][] = [start.z]
	while (centers.length < k) {
		let best: T = points[0]
		let bestD = Number.POSITIVE_INFINITY
		for (const p of points) {
			const d = Math.max(...centers.map((c) => dot(p.z, c, NC)))
			if (d < bestD) {
				bestD = d
				best = p
			}
		}
		centers.push(best.z)
	}
	let assign = new Array(points.length).fill(0)
	for (let iter = 0; iter < 20; iter++) {
		assign = points.map((p) => {
			let bi = 0
			let bs = Number.NEGATIVE_INFINITY
			centers.forEach((c, i) => {
				const s = dot(p.z, c, NC)
				if (s > bs) {
					bs = s
					bi = i
				}
			})
			return bi
		})
		for (let i = 0; i < centers.length; i++) {
			const members = points.filter((_, j) => assign[j] === i)
			if (members.length) centers[i] = meanVec(members)
		}
	}
	return centers.map((c, i) => ({
		center: c,
		members: points.filter((_, j) => assign[j] === i),
	}))
}

// ---------- the report ----------

function analyze(
	who: Who,
	sig: Signals,
	titles: Map<string, T>,
	pool: Pool,
): Payload {
	const used = new Set<string>()
	const ref = (t: T, v: number[]): Ref => {
		used.add(t.key)
		return { key: t.key, match: toMatch(dot(t.z, v)) }
	}
	const use = (ts: T[]) => ts.map((t) => (used.add(t.key), t.key))
	const get = (k: string) => titles.get(k)

	const scored = [...sig.scores.entries()]
		.map(([k, s]) => ({ t: get(k), ...s }))
		.filter((s): s is { t: T; score: number; at: number | null } => !!s.t)
	const ms = (t: T) => sig.scores.get(t.key)?.score ?? 0
	const chosenKeys = new Set([...sig.scores.keys(), ...sig.watched, ...sig.fav])
	const chosen = [...chosenKeys].map(get).filter((t): t is T => !!t)
	const wishT = [...sig.wish].map(get).filter((t): t is T => !!t)
	const skipT = [...sig.skip].map(get).filter((t): t is T => !!t)
	const { v, mu, sigma } = tasteVector(
		scored,
		chosen.length ? chosen : scored.map((s) => s.t),
		wishT,
		skipT,
	)

	const seen = new Set([
		...sig.scores.keys(),
		...sig.watched,
		...sig.fav,
		...sig.skip,
		...sig.wish,
	])
	const unseen = pool.items.filter((t) => !seen.has(t.key))
	const rankUnseen = (
		vec: number[],
		filter: (t: T) => boolean = () => true,
		n = 12,
		quality = 0.4,
	) =>
		unseen
			.filter(filter)
			.map((t) => ({
				t,
				value: dot(t.z, vec) + quality * ((t.score - 72) / 100),
			}))
			.sort((a, b) => b.value - a.value)
			.slice(0, n)
			.map((x) => ref(x.t, v))

	const lovedCut = Math.max(8, Math.round(mu + 0.6 * sigma))
	const loved = scored
		.filter((s) => s.score >= lovedCut || sig.fav.has(s.t.key))
		.map((s) => s.t)
	const lovedOrAll =
		loved.length >= 6
			? loved
			: scored.filter((s) => s.score >= mu).map((s) => s.t)
	const disliked = [
		...scored.filter((s) => s.score <= mu - sigma).map((s) => s.t),
		...skipT,
	]

	// Attributes
	const vector: Attr[] = KEYS.map((key, k) => ({
		key,
		label: label(key),
		phrase: phrase(key),
		color: FINGERPRINT_META[key]?.color ?? "rgba(160,160,160,0.6)",
		emoji: FINGERPRINT_META[key]?.emoji ?? "",
		value: round1(v[k] * 10) / 10,
	}))
	const ranked = NC.map((k) => ({ k, key: KEYS[k], w: v[k] })).sort(
		(a, b) => b.w - a.w,
	)
	// Titles that carry an attribute most strongly. Titles already shown for another attribute rank lower,
	// so one broad favorite doesn't illustrate every trait.
	const shown = new Map<string, number>()
	const evidence = (k: number, from: T[], n = 4) => {
		const out = [...from]
			.filter((t) => t.z[k] > 0.5)
			.sort(
				(a, b) =>
					b.z[k] +
					ms(b) * 0.1 -
					0.9 * (shown.get(b.key) ?? 0) -
					(a.z[k] + ms(a) * 0.1 - 0.9 * (shown.get(a.key) ?? 0)),
			)
			.slice(0, n)
		for (const t of out) shown.set(t.key, (shown.get(t.key) ?? 0) + 1)
		return use(out)
	}
	const loves: Trait[] = ranked
		.slice(0, 6)
		.map((r) => ({ ...vector[r.k], evidence: evidence(r.k, lovedOrAll) }))
	const avoids: Trait[] = ranked
		.slice(-4)
		.reverse()
		.map((r) => ({ ...vector[r.k], evidence: evidence(r.k, disliked, 3) }))

	// Name the viewing preference; applying a title adjective to a person changes its meaning.
	const [t1, t2, t3] = ranked.map((r) => r.key)
	const archetype = {
		name: `The ${persona(t1)}`,
		line: `${cap(noun(t1))}, ${noun(t2)} and ${noun(t3)}, rarely ${noun(ranked[ranked.length - 1].key)}.`,
	}

	// Canon: favorites and top ratings that sit closest to the center of the taste, kept varied.
	const canonPool = scored
		.filter((s) => s.score >= Math.min(9, lovedCut) || sig.fav.has(s.t.key))
		.map((s) => ({
			t: s.t,
			value:
				(s.score - mu) / sigma +
				(sig.fav.has(s.t.key) ? 1.2 : 0) +
				1.6 * dot(s.t.z, v),
		}))
		.sort((a, b) => b.value - a.value)
	const canonT: T[] = []
	for (const c of canonPool) {
		if (canonT.length >= 8) break
		if (canonT.some((x) => dot(x.z, c.t.z) > 0.82)) continue
		canonT.push(c.t)
	}
	// Why a title belongs: the attributes it shares with your taste, spread so not every entry says the same thing.
	const whyCount = new Map<string, number>()
	const whyOf = (t: T, vec: number[], n = 3) => {
		const out = NC.map((k) => ({
			key: KEYS[k],
			pull: t.z[k] * vec[k],
			zk: t.z[k],
		}))
			.filter((r) => r.zk > 0.4 && r.pull > 0)
			.map((r) => ({
				...r,
				pull: r.pull / (1 + 0.8 * (whyCount.get(r.key) ?? 0)),
			}))
			.sort((a, b) => b.pull - a.pull)
			.slice(0, n)
			.map((r) => r.key)
		for (const k of out) whyCount.set(k, (whyCount.get(k) ?? 0) + 1)
		return out
	}
	const canon = canonT.map((t) => ({
		key: (used.add(t.key), t.key),
		why: whyOf(t, v),
		reason: sig.fav.has(t.key)
			? "One of your favorites"
			: `You gave it ${ms(t)}`,
		next: rankUnseen(
			t.z.map((x, k) => x * 0.65 + v[k] * 0.35),
			() => true,
			14,
			0.6,
		),
	}))
	// Titles behind every attribute, for pages that let you tap any part of the signature.
	const attrEvidence: Record<string, string[]> = {}
	for (const k of NC)
		attrEvidence[KEYS[k]] =
			v[k] >= 0
				? evidence(k, lovedOrAll, 4)
				: evidence(k, disliked.length ? disliked : scored.map((s) => s.t), 4)

	// Sides: clusters of what you love, named by what sets each cluster apart.
	const clusters = kmeans(
		lovedOrAll,
		lovedOrAll.length >= 60 ? 4 : 3,
		v,
	).filter((c) => c.members.length >= (lovedOrAll.length >= 30 ? 3 : 2))
	const lovedMean = meanVec(lovedOrAll)
	const names = new Set<string>()
	const sides: (Side & { center: number[] })[] = clusters
		.map((c, i) => {
			const rel = NC.map((k) => ({
				key: KEYS[k],
				w: c.center[k] - 0.5 * lovedMean[k],
			})).sort((a, b) => b.w - a.w)
			let name = `${cap(adj(rel[1].key))} ${noun(rel[0].key)}`
			if (names.has(name)) name = `${cap(adj(rel[2].key))} ${noun(rel[0].key)}`
			names.add(name)
			const members = [...c.members].sort(
				(a, b) =>
					ms(b) - ms(a) || dot(b.z, c.center, NC) - dot(a.z, c.center, NC),
			)
			return {
				id: `side-${i}`,
				name,
				attrs: rel.slice(0, 4).map((r) => r.key),
				share: c.members.length / lovedOrAll.length,
				avg: round1(avgOf(c.members.map(ms).filter(Boolean))),
				titles: use(members.slice(0, 10)),
				picks: rankUnseen(
					c.center.map((x, k) => x * 0.45 + v[k] * 0.55),
					() => true,
					24,
					0.8,
				)
					.filter((p) => p.match >= 65)
					.slice(0, 12),
				center: c.center,
			}
		})
		.sort((a, b) => b.share - a.share)
	let contradiction: Report["contradiction"] = null
	if (sides.length >= 2) {
		let best = { a: sides[0], b: sides[1], s: Number.POSITIVE_INFINITY }
		for (const a of sides)
			for (const b of sides)
				if (a !== b) {
					const s = dot(a.center, b.center, NC)
					if (s < best.s) best = { a, b, s }
				}
		const ex = (s: Side) => s.titles.slice(0, 2).map((k) => get(k)?.title ?? "")
		contradiction = {
			a: best.a.id,
			b: best.b.id,
			text: `You love ${best.a.name.toLowerCase()} like ${list(ex(best.a))}, and also ${best.b.name.toLowerCase()} like ${list(ex(best.b))}.`,
		}
	}

	// You versus the crowd.
	const vsCrowd = scored.filter((s) => s.t.score > 0 && s.t.votes >= 1000)
	const deltas = vsCrowd.map((s) => s.score * 10 - s.t.score)
	const offset = avgOf(deltas)
	const rows: CrowdRow[] = vsCrowd.map((s, i) => ({
		key: s.t.key,
		mine: s.score,
		crowd: s.t.score,
		delta: Math.round(deltas[i] - offset),
	}))
	// Sorted by the gap, nudged toward titles people know so the list reads as a conversation, not trivia.
	const fame = (r: CrowdRow) =>
		5 * Math.log10(Math.max(1000, get(r.key)?.votes ?? 1000))
	const byDelta = [...rows].sort(
		(a, b) =>
			b.delta +
			Math.sign(b.delta) * fame(b) -
			(a.delta + Math.sign(a.delta) * fame(a)),
	)
	const higher = byDelta.slice(0, 30).filter((r) => r.delta > 0)
	const lower = byDelta
		.slice(-30)
		.reverse()
		.filter((r) => r.delta < 0)
	for (const r of [...higher, ...lower]) used.add(r.key)
	const mx = avgOf(vsCrowd.map((s) => s.score))
	const my = avgOf(vsCrowd.map((s) => s.t.score))
	const cov = avgOf(vsCrowd.map((s) => (s.score - mx) * (s.t.score - my)))
	const sx = Math.sqrt(avgOf(vsCrowd.map((s) => (s.score - mx) ** 2))) || 1
	const sy = Math.sqrt(avgOf(vsCrowd.map((s) => (s.t.score - my) ** 2))) || 1
	const agreement = round1((cov / (sx * sy)) * 100) / 100
	const minN = Math.max(4, Math.round(vsCrowd.length * 0.04))
	const crowdAttrs = NC.map((k) => {
		const hit = vsCrowd
			.map((s, i) => ({ s, d: deltas[i] - offset }))
			.filter((x) => x.s.t.z[k] > 1)
		return {
			key: KEYS[k],
			delta: Math.round(avgOf(hit.map((x) => x.d))),
			count: hit.length,
		}
	})
		.filter((a) => a.count >= minN)
		.sort((a, b) => b.delta - a.delta)
	const genreMap = new Map<string, number[]>()
	vsCrowd.forEach((s, i) => {
		for (const g of s.t.genres)
			genreMap.set(g, [...(genreMap.get(g) ?? []), deltas[i] - offset])
	})
	const crowdGenres = [...genreMap.entries()]
		.filter(([, ds]) => ds.length >= minN)
		.map(([name, ds]) => ({
			name,
			delta: Math.round(avgOf(ds)),
			count: ds.length,
		}))
		.sort((a, b) => b.delta - a.delta)
	const warm = crowdAttrs[0]
	const cold = crowdAttrs[crowdAttrs.length - 1]
	const stance =
		agreement > 0.6
			? "You mostly agree with the crowd, and your exceptions say a lot."
			: agreement > 0.35
				? "You agree with the crowd about as often as you don't."
				: "You don't take the crowd's word for much."
	const crowd = {
		offset: Math.round(offset),
		agreement,
		higher,
		lower,
		attrs: [...crowdAttrs.slice(0, 4), ...crowdAttrs.slice(-4)].filter(
			(a, i, xs) => xs.findIndex((b) => b.key === a.key) === i,
		),
		genres: [...crowdGenres.slice(0, 3), ...crowdGenres.slice(-3)].filter(
			(g, i, xs) => xs.findIndex((b) => b.name === g.name) === i,
		),
		stance,
	}

	// Frontiers: places you have barely been but rated well, and attributes you rarely pick but rate high.
	const frontiers: Frontier[] = []
	const region = new Intl.DisplayNames(["en"], { type: "region" })
	const language = new Intl.DisplayNames(["en"], { type: "language" })
	const group = (keyOf: (t: T) => string[]) => {
		const m = new Map<string, { t: T; score: number }[]>()
		for (const s of scored)
			for (const g of keyOf(s.t)) m.set(g, [...(m.get(g) ?? []), s])
		return m
	}
	const countries = group((t) => t.countries.slice(0, 1))
	const langs = group((t) => (t.lang ? [t.lang] : []))
	const decades = group((t) =>
		t.year ? [String(Math.floor(t.year / 10) * 10)] : [],
	)
	const safeName = (fn: () => string | undefined, fallback: string) => {
		try {
			return fn() ?? fallback
		} catch {
			return fallback
		}
	}
	const LANG_FIX: Record<string, string> = { cn: "Cantonese" }
	const candidates: (Frontier & { strength: number })[] = []
	const addFrontier = (
		kind: Frontier["kind"],
		id: string,
		name: string,
		items: { t: T; score: number }[],
		filter: (t: T) => boolean,
		headline: string,
		line?: string,
	) => {
		const picks = rankUnseen(v, filter, 10).filter((p) => p.match >= 56)
		if (picks.length < 4) return
		const a = avgOf(items.map((x) => x.score))
		candidates.push({
			id: `${kind}-${id}`,
			kind,
			name,
			headline,
			line:
				line ??
				(items.length
					? `You've rated ${items.length} ${items.length === 1 ? "title" : "titles"} here and gave ${items.length === 1 ? "it" : "them"} ${round1(a)} on average, against your usual ${round1(mu)}.`
					: "You haven't rated anything here yet."),
			evidence: use(
				[...items]
					.sort((x, y) => y.score - x.score)
					.map((x) => x.t)
					.slice(0, 4),
			),
			picks: picks.slice(0, 8),
			strength:
				(a - mu) * Math.sqrt(Math.max(1, items.length)) +
				avgOf(picks.slice(0, 4).map((p) => p.match)) / 40,
		})
	}
	const few = (n: number, min: number, share: number) =>
		n >= min && n <= Math.max(min + 3, scored.length * share)
	for (const [code, items] of langs) {
		if (!few(items.length, 1, 0.012) || code === "en") continue
		if (avgOf(items.map((x) => x.score)) < mu + 0.2) continue
		const name = LANG_FIX[code] ?? safeName(() => language.of(code), code)
		addFrontier(
			"language",
			code,
			name,
			items,
			(t) => t.lang === code,
			`${name}-language titles`,
		)
	}
	for (const [code, items] of countries) {
		if (!few(items.length, 2, 0.008) || ["US", "GB"].includes(code)) continue
		if (avgOf(items.map((x) => x.score)) < mu + 0.3) continue
		const name = safeName(() => region.of(code), code)
		addFrontier(
			"country",
			code,
			name,
			items,
			(t) => t.countries[0] === code,
			`Titles from ${name}`,
		)
	}
	// Attributes you rarely choose, but rate above your average when you do.
	const selMean = meanVec(chosen.length ? chosen : scored.map((s) => s.t))
	NC.map((k) => {
		const hit = scored.filter((s) => s.t.z[k] > 1.2)
		return {
			k,
			sel: selMean[k],
			hit,
			lift: avgOf(hit.map((s) => s.score)) - mu,
		}
	})
		.filter((a) => a.sel < 0.05 && a.hit.length >= 2 && a.lift > 0.15)
		.sort((a, b) => b.lift - b.sel - (a.lift - a.sel))
		.slice(0, 4)
		.forEach((a) => {
			const key = KEYS[a.k]
			addFrontier(
				"attr",
				key,
				cap(noun(key)),
				a.hit,
				(t) => t.z[a.k] > 1.2,
				cap(noun(key)),
				`You rarely pick ${noun(key)}, but you rate them ${round1(mu + a.lift)} on average, against your usual ${round1(mu)}.`,
			)
		})
	for (const [dec, items] of decades) {
		if (items.length > Math.max(6, scored.length * 0.01)) continue
		if (items.length && avgOf(items.map((x) => x.score)) < mu + 0.3) continue
		addFrontier(
			"decade",
			dec,
			`The ${dec}s`,
			items,
			(t) => t.year >= Number(dec) && t.year < Number(dec) + 10,
			`The ${dec}s`,
		)
	}
	// Keep it varied: at most two of each kind, strongest first.
	const perKind: Record<string, number> = {}
	for (const c of candidates.sort((a, b) => b.strength - a.strength)) {
		if ((perKind[c.kind] ?? 0) >= 2 || frontiers.length >= 6) continue
		if (
			frontiers.some(
				(f) =>
					f.picks.filter((p) => c.picks.some((q) => q.key === p.key)).length >=
					3,
			)
		)
			continue
		perKind[c.kind] = (perKind[c.kind] ?? 0) + 1
		const { strength, ...f } = c
		frontiers.push(f)
	}

	// Eras by release decade.
	const eras: Era[] = [...decades.entries()]
		.filter(([, items]) => items.length >= 3)
		.sort((a, b) => Number(a[0]) - Number(b[0]))
		.map(([dec, items]) => {
			const c = meanVec(items.filter((x) => x.score >= mu).map((x) => x.t))
			const top = NC.map((k) => ({
				key: KEYS[k],
				w: c[k] - lovedMean[k] * 0.6,
			})).sort((a, b) => b.w - a.w)[0]
			return {
				decade: Number(dec),
				count: items.length,
				avg: round1(avgOf(items.map((x) => x.score))),
				top: use(
					[...items]
						.sort((a, b) => b.score - a.score || b.t.votes - a.t.votes)
						.slice(0, 8)
						.map((x) => x.t),
				),
				trait: top?.key ?? null,
				picks: rankUnseen(
					v,
					(t) => t.year >= Number(dec) && t.year < Number(dec) + 10,
					16,
				),
			}
		})

	// Drift: ratings since the first bulk import versus everything.
	let drift: Report["drift"] = null
	const dated = scored
		.filter((s) => s.at)
		.sort((a, b) => (a.at ?? 0) - (b.at ?? 0))
	if (dated.length >= 30) {
		const cutoff = (dated[Math.floor(dated.length * 0.85)].at ?? 0) as number
		const recent = dated.filter((s) => (s.at ?? 0) >= cutoff && s.score >= mu)
		if (recent.length >= 6) {
			const rv = meanVec(recent.map((s) => s.t))
			const diff = NC.map((k) => ({
				key: KEYS[k],
				d: rv[k] - lovedMean[k],
			})).sort((a, b) => b.d - a.d)
			drift = {
				toward: diff.slice(0, 3).map((d) => d.key),
				away: diff
					.slice(-3)
					.reverse()
					.map((d) => d.key),
				recent: use(
					recent
						.sort((a, b) => b.score - a.score)
						.slice(0, 8)
						.map((s) => s.t),
				),
				since: cutoff,
			}
		}
	}

	// Moods: how you rate each viewing context.
	const moods: Mood[] = CONTEXTS.map((c) => {
		const items = scored.filter((s) => s.t.contexts.includes(c.id))
		const a = avgOf(items.map((s) => s.score))
		return {
			id: c.id,
			name: c.name,
			line: c.line,
			count: items.length,
			avg: round1(a),
			delta: round1(a - mu),
			top: use(
				items
					.sort((x, y) => y.score - x.score || y.t.votes - x.t.votes)
					.slice(0, 6)
					.map((s) => s.t),
			),
			picks: rankUnseen(v, (t) => t.contexts.includes(c.id), 16),
		}
	}).filter((m) => m.count >= 3)

	// People and places.
	const people = (
		keyOf: (t: T) => string[],
		min: number,
		n: number,
		rename: (s: string) => string = (s) => s,
	): PersonStat[] =>
		[...group(keyOf).entries()]
			.filter(([, items]) => items.length >= min)
			.map(([name, items]) => ({
				name: rename(name),
				count: items.length,
				avg: round1(avgOf(items.map((x) => x.score))),
				items,
			}))
			.sort((a, b) => b.avg * Math.sqrt(b.count) - a.avg * Math.sqrt(a.count))
			.slice(0, n)
			.map(({ items, ...p }) => ({
				...p,
				keys: use(
					items
						.sort((a, b) => b.score - a.score)
						.slice(0, 4)
						.map((x) => x.t),
				),
			}))
	const minPeople = scored.length > 200 ? 3 : 2
	const peopleOut = {
		directors: people((t) => t.directors, minPeople, 8),
		actors: people((t) => t.cast.slice(0, 3), minPeople + 1, 8),
		countries: people(
			(t) => t.countries.slice(0, 1),
			3,
			6,
			(c) => safeName(() => region.of(c), c),
		),
		languages: people(
			(t) => (t.lang ? [t.lang] : []),
			3,
			6,
			(c) => LANG_FIX[c] ?? safeName(() => language.of(c), c),
		),
	}

	// A few sentences about the person.
	const portrait = [
		`You watch for ${phrase(t1)} and ${phrase(t2)}, and you'll forgive a lot for ${phrase(t3)}.`,
		warm && warm.delta > 3
			? `You rate ${noun(warm.key)} ${warm.delta} points higher than everyone else does.`
			: "",
		cold && cold.delta < -3
			? `The crowd loves ${noun(cold.key)} more than you do.`
			: "",
		`You have little patience for ${phrase(avoids[0].key)} or ${phrase(avoids[1].key)}.`,
		peopleOut.directors[0]
			? `You keep coming back to ${list(peopleOut.directors.slice(0, 2).map((d) => d.name))}.`
			: "",
		drift
			? `Lately you've been drifting toward ${phrase(drift.toward[0])}.`
			: "",
	].filter(Boolean)

	// Friends: two demo tastes to compare against.
	const friendVec = (ratings: Record<string, number>) => {
		const fs = Object.entries(ratings)
			.map(([k, score]) => ({ t: pool.byKey.get(k) ?? titles.get(k), score }))
			.filter((x): x is { t: T; score: number } => !!x.t)
		return {
			fs,
			...tasteVector(
				fs,
				fs.map((x) => x.t),
				[],
				[],
			),
		}
	}
	const friends: FriendReport[] = FRIENDS.map((f) => {
		const { fs, v: fv } = friendVec(f.ratings)
		const cosv = dot(v, fv, NC)
		const shared = NC.filter((k) => v[k] > 0.05 && fv[k] > 0.05)
			.sort((a, b) => Math.min(v[b], fv[b]) - Math.min(v[a], fv[a]))
			.slice(0, 5)
			.map((k) => KEYS[k])
		const split = NC.map((k) => ({
			key: KEYS[k],
			me: round1(v[k]),
			them: round1(fv[k]),
		}))
			.filter((x) => Math.sign(x.me) !== Math.sign(x.them))
			.sort((a, b) => Math.abs(b.me - b.them) - Math.abs(a.me - a.them))
			.slice(0, 5)
		const fSeen = new Set(fs.map((x) => x.t.key))
		const both = unseen
			.filter((t) => !fSeen.has(t.key))
			.map((t) => ({
				t,
				me: toMatch(dot(t.z, v)),
				them: toMatch(dot(t.z, fv)),
			}))
			.sort(
				(a, b) =>
					Math.min(b.me, b.them) +
					b.t.score * 0.05 -
					(Math.min(a.me, a.them) + a.t.score * 0.05),
			)
			.slice(0, 10)
			.map((x) => ({
				key: (used.add(x.t.key), x.t.key),
				me: x.me,
				them: x.them,
			}))
		const common = fs
			.filter((x) => sig.scores.has(x.t.key))
			.map((x) => ({
				key: x.t.key,
				me: sig.scores.get(x.t.key)?.score ?? 0,
				them: x.score,
			}))
		for (const c of common) used.add(c.key)
		const fr = NC.map((k) => ({ key: KEYS[k], w: fv[k] })).sort(
			(a, b) => b.w - a.w,
		)
		return {
			id: f.id,
			name: f.name,
			blurb: f.blurb,
			archetype: `The ${persona(fr[0].key)}`,
			overlap: Math.round(50 + 50 * cosv),
			shared,
			split,
			both,
			agree: common.filter((c) => Math.abs(c.me - c.them) <= 1).slice(0, 6),
			disagree: common
				.filter((c) => Math.abs(c.me - c.them) >= 3)
				.sort((a, b) => Math.abs(b.me - b.them) - Math.abs(a.me - a.them))
				.slice(0, 6),
			canon: use(
				fs
					.sort((a, b) => b.score - a.score || b.t.votes - a.t.votes)
					.slice(0, 4)
					.map((x) => x.t),
			),
			vector: fv.map((x) => round1(x * 10) / 10),
		}
	})

	const picks = rankUnseen(v, () => true, 36)

	// Only ship the titles the page shows, without fingerprints.
	const serviceIds = new Set([...SERVICE_IDS, ...who.services])
	const items: Record<string, Title> = {}
	for (const key of used) {
		const t = titles.get(key) ?? pool.byKey.get(key)
		if (!t) continue
		const { sa, z, ...rest } = t
		items[key] = {
			...rest,
			fp: [],
			mine: sig.scores.get(key)?.score,
			fav: sig.fav.has(key) || undefined,
			services: [...serviceIds].filter((id) =>
				sa.includes(`${who.country}_${id}`),
			),
		}
	}

	const allDates = scored.map((s) => s.at).filter((x): x is number => !!x)
	const report: Report = {
		who: {
			mode: who.mode,
			fellBack: who.fellBack,
			name: who.name,
			handle: who.handle,
			rated: sig.scores.size,
			watched: sig.watched.size,
			wish: sig.wish.size,
			skipped: sig.skip.size,
			favorites: sig.fav.size,
			since: allDates.length ? Math.min(...allDates) : null,
			avg: round1(mu),
			country: who.country,
		},
		archetype,
		portrait,
		vector,
		loves,
		avoids,
		canon,
		attrEvidence,
		sides: sides.map(({ center, ...s }) => s),
		contradiction,
		crowd,
		frontiers,
		eras,
		drift,
		moods,
		people: peopleOut,
		picks,
		friends,
	}
	return { report, items, services: [] }
}

// ---------- entry ----------

const reportCache = new Map<string, { at: number; payload: Payload }>()

export async function getTasteReport(
	request: Request,
): Promise<{ payload: Payload; headers: Headers }> {
	const url = new URL(request.url)
	const as = url.searchParams.get("as") ?? "me"
	const { user, headers } = await getAuthFromRequest({ request })
	// Dev-only escape hatch for verifying with real data in a headless browser: ?as=<user uuid> on localhost.
	const devUser =
		/^[0-9a-f-]{36}$/.test(as) &&
		url.hostname === "localhost" &&
		process.env.NODE_ENV !== "production"
			? as
			: null
	const userId = devUser ?? (as === "me" ? user?.id : undefined)

	const cacheKey = userId ?? "demo"
	const hit = reportCache.get(cacheKey)
	if (hit && Date.now() - hit.at < 5 * 60_000)
		return {
			payload: {
				...hit.payload,
				report: {
					...hit.payload.report,
					who: { ...hit.payload.report.who, fellBack: as === "me" && !userId },
				},
			},
			headers,
		}

	const [pool, round1Pool] = await Promise.all([getPool(), getTastePool()])
	let sig: Signals
	let who: Who
	if (userId) {
		const m = await loadMember(userId)
		sig = m
		const meta = (devUser ? null : user?.user_metadata) as {
			full_name?: string
			name?: string
		} | null
		who = {
			mode: "me",
			fellBack: false,
			name:
				meta?.full_name?.split(" ")[0] ??
				meta?.name ??
				(m.handle ? `@${m.handle}` : "You"),
			handle: m.handle,
			country: m.country,
			services: m.services.length ? m.services : DEMO_SERVICES,
		}
	} else {
		sig = demoSignals()
		who = {
			mode: "demo",
			fellBack: as === "me",
			name: "Demo member",
			handle: null,
			country: "DE",
			services: DEMO_SERVICES,
		}
	}
	const keys = new Set([
		...sig.scores.keys(),
		...sig.wish,
		...sig.skip,
		...sig.watched,
		...sig.fav,
		...FRIENDS.flatMap((f) => Object.keys(f.ratings)),
	])
	const titles = await loadTitles([...keys], pool)
	const payload = analyze(who, sig, titles, pool)

	// Service names and logos: round 1's list plus any service the person saved.
	const extraIds = who.services.filter(
		(id) => !round1Pool.services.some((s) => s.id === id),
	)
	const extra = extraIds.length
		? await query<{ tmdb_id: number; name: string; logo_path: string }>(
				`SELECT tmdb_id, name, logo_path FROM streaming_service WHERE tmdb_id IN (${extraIds.join(",")})`,
			)
		: []
	const services: Service[] = [
		...round1Pool.services.map((s) => ({
			...s,
			mine: who.services.includes(s.id),
		})),
		...extra
			.filter((s, i) => extra.findIndex((x) => x.tmdb_id === s.tmdb_id) === i)
			.map((s) => ({
				id: s.tmdb_id,
				name: s.name,
				logo: `https://www.themoviedb.org/t/p/original${s.logo_path}`,
				mine: true,
			})),
	].sort((a, b) => Number(b.mine) - Number(a.mine))
	payload.services = services

	reportCache.set(cacheKey, { at: Date.now(), payload })
	return { payload, headers }
}
