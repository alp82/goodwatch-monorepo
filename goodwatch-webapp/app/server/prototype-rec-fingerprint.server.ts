// PROTOTYPE - throwaway. Fingerprint page data for /prototype/rec-fingerprint (#181).
// On top of round 2's taste report (imported, unchanged, cached), computes what the fingerprint page needs:
// the person's 74-attribute signature and the same signature for everyone (from what everyone watches and
// how the GoodWatch score rates it), the titles that carry each attribute for the person, the signature per
// period of their rating history, title fingerprints to overlay, and unseen candidates to re-rank live.
// Reads ratings, lists and the title analysis (fingerprint) read-only from Crate. Nothing is written anywhere.
import { getTasteReport } from "~/server/prototype-rec-taste-2.server"
import { VALID_FINGERPRINT_KEYS } from "~/server/utils/fingerprint"
import { FINGERPRINT_META } from "~/ui/fingerprint/fingerprintMeta"
import type { Payload } from "~/ui/prototype-rec-taste-2/model"
import { FRIENDS, noun } from "~/ui/prototype-rec-taste-2/words"
import {
	DEMO_RATINGS,
	PHRASES,
	SERVICE_IDS,
} from "~/ui/prototype-rec-taste/model"
import {
	FAMILY_DEFS,
	FAMILY_SIZES,
	type Family,
	type FamilyId,
	type FpAttr,
	type FpPayload,
	type Period,
	type Probe,
	type Title,
} from "~/ui/prototype-rec-fingerprint/model"
import { getAuthFromRequest } from "~/utils/auth"
import { query } from "~/utils/crate"

const TMDB = "https://image.tmdb.org/t/p"
const KEYS = [...VALID_FINGERPRINT_KEYS] as string[]
const N = KEYS.length

const FAMILY_OF: FamilyId[] = FAMILY_DEFS.flatMap((f) =>
	Array.from({ length: FAMILY_SIZES[f.id] }, () => f.id),
)
const FAMILIES: Family[] = FAMILY_DEFS.map((f) => ({
	...f,
	keys: KEYS.filter((_, i) => FAMILY_OF[i] === f.id),
}))

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
	adult: boolean | null
}
type T = Title & { sa: string[]; z: number[]; adult: boolean }

const COLS = `tmdb_id, title, release_year, poster_path, backdrop_path, genres,
	goodwatch_overall_score_normalized_percent AS score, goodwatch_overall_score_voting_count AS votes,
	fingerprint_scores AS fp, streaming_availabilities AS sa, adult`

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
	z: [],
	adult: !!r.adult,
})

// ---------- catalog pool: the same popular titles round 2 z-scores against, cached per process ----------

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
		for (let k = 0; k < N; k++) sd[k] += (it.fp[k] - mean[k]) ** 2 / items.length
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
const chunks = <X>(xs: X[], n = 800) =>
	Array.from({ length: Math.ceil(xs.length / n) }, (_, i) =>
		xs.slice(i * n, i * n + n),
	)

async function loadTitles(keys: string[], pool: Pool) {
	const out = new Map<string, T>()
	const missing = { movie: [] as number[], show: [] as number[] }
	for (const key of keys) {
		const hit = pool.byKey.get(key) ?? extraCache.get(key)
		if (hit) out.set(key, hit)
		else if (!extraCache.has(key)) {
			const [type, id] = key.split("-")
			if ((type === "movie" || type === "show") && Number(id))
				missing[type].push(Number(id))
		}
	}
	for (const type of ["movie", "show"] as const)
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
	return out
}

// ---------- the person ----------

type Signals = {
	scores: Map<string, { score: number; at: number | null; order: number }>
	wish: Set<string>
	skip: Set<string>
	watched: Set<string>
	fav: Set<string>
	dated: boolean
}

async function loadSignals(userId: string | null): Promise<Signals> {
	const sig: Signals = {
		scores: new Map(),
		wish: new Set(),
		skip: new Set(),
		watched: new Set(),
		fav: new Set(),
		dated: !!userId,
	}
	if (!userId) {
		let order = 0
		for (const [k, s] of Object.entries(DEMO_RATINGS)) {
			if (s.kind === "score")
				sig.scores.set(k, { score: s.score, at: null, order: order++ })
			if (s.kind === "want") sig.wish.add(k)
			if (s.kind === "no") sig.skip.add(k)
		}
		return sig
	}
	const key = (r: { media_type: string; tmdb_id: number }) =>
		`${r.media_type}-${r.tmdb_id}`
	type R = { tmdb_id: number; media_type: string }
	const [scores, wish, skip, watched, fav] = await Promise.all([
		query<R & { score: number; at: string | null }>(
			"SELECT tmdb_id, media_type, score, created_at AS at FROM user_score WHERE user_id = ?",
			[userId],
		),
		query<R>("SELECT tmdb_id, media_type FROM user_wishlist WHERE user_id = ?", [
			userId,
		]),
		query<R>("SELECT tmdb_id, media_type FROM user_skipped WHERE user_id = ?", [
			userId,
		]),
		query<R>(
			"SELECT tmdb_id, media_type FROM user_watch_state WHERE user_id = ? AND state <> 'not_started'",
			[userId],
		),
		query<R>("SELECT tmdb_id, media_type FROM user_favorite WHERE user_id = ?", [
			userId,
		]),
	])
	scores.forEach((r, i) =>
		sig.scores.set(key(r), {
			score: r.score,
			at: r.at ? Number(new Date(r.at)) : null,
			order: i,
		}),
	)
	for (const r of wish) sig.wish.add(key(r))
	for (const r of skip) sig.skip.add(key(r))
	for (const r of watched) sig.watched.add(key(r))
	for (const r of fav) sig.fav.add(key(r))
	return sig
}

// ---------- math (round 2's signature formula, applied to the person, to everyone and to periods) ----------

const avgOf = (xs: number[]) =>
	xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0
const unit = (v: number[]) => {
	const len = Math.sqrt(v.reduce((a, x) => a + x * x, 0)) || 1
	return v.map((x) => x / len)
}
const cos = (a: number[], b: number[]) => {
	let d = 0
	let na = 0
	let nb = 0
	for (let k = 0; k < a.length; k++) {
		d += a[k] * b[k]
		na += a[k] * a[k]
		nb += b[k] * b[k]
	}
	return na && nb ? d / Math.sqrt(na * nb) : 0
}
const toMatch = (sim: number) =>
	Math.max(40, Math.min(99, Math.round(52 + sim * 58)))
const r2 = (x: number) => Math.round(x * 100) / 100
const r1 = (x: number) => Math.round(x * 10) / 10

/** The two raw halves of a signature: what you choose (mean z) and what you rate above your own average. */
function halves(
	scored: { t: T; score: number }[],
	chosen: { t: T; w: number }[],
	extra: { t: T; w: number }[],
	mu: number,
	sigma: number,
) {
	const pref = new Array(N).fill(0)
	let total = 0
	const add = (t: T, w: number) => {
		total += Math.abs(w)
		for (let k = 0; k < N; k++) pref[k] += w * t.z[k]
	}
	for (const s of scored)
		add(s.t, Math.max(-2, Math.min(2, (s.score - mu) / sigma)))
	for (const e of extra) add(e.t, e.w)
	if (total) for (let k = 0; k < N; k++) pref[k] /= total
	const sel = new Array(N).fill(0)
	const wsum = chosen.reduce((a, c) => a + c.w, 0) || 1
	for (const c of chosen)
		for (let k = 0; k < N; k++) sel[k] += (c.w * c.t.z[k]) / wsum
	return { sel, pref }
}

/** Round 2's taste vector, used to rank titles: half direction of choice, half direction of preference. */
const signature = (h: { sel: number[]; pref: number[] }) => {
	const su = unit(h.sel)
	const pu = unit(h.pref)
	return su.map((x, k) => (0.45 * x + 0.55 * pu[k]) * 2)
}

const rms = (v: number[]) => Math.sqrt(avgOf(v.map((x) => x * x))) || 1

/** Per attribute, against everyone: how much more you choose it than everyone does (in catalog standard
 * deviations), plus how much higher you rate it than your own average. Each half is scaled to the person's
 * own spread so neither drowns the other. Pass the scales to read a period on the same ruler. */
function edgeOf(
	h: { sel: number[]; pref: number[] },
	crowdSel: number[],
	scales?: { s: number; p: number },
) {
	const d = h.sel.map((x, k) => x - crowdSel[k])
	const sc = scales ?? { s: rms(d), p: rms(h.pref) }
	return {
		edge: d.map((x, k) => 0.5 * (x / sc.s) + 0.5 * (h.pref[k] / sc.p)),
		scales: sc,
	}
}

let crowdCache: { sel: number[]; share: number[]; thr: number[] } | null =
	null
/** Everyone: what people watch, each title weighted by how many rated it. */
function crowdOf(pool: Pool) {
	if (crowdCache) return crowdCache
	const w = pool.items.map((t) => Math.sqrt(t.votes))
	const wsum = w.reduce((a, b) => a + b, 0)
	const sel = KEYS.map((_, k) =>
		pool.items.reduce((a, t, i) => a + (w[i] * t.z[k]) / wsum, 0),
	)
	// "Carries it strongly": in the top quarter of titles for that attribute (at least a 3 of 10).
	const thr = KEYS.map((_, k) => {
		const v = pool.items.map((t) => t.fp[k]).sort((a, b) => a - b)
		return Math.max(3, v[Math.floor(v.length * 0.75)])
	})
	const share = KEYS.map(
		(_, k) =>
			pool.items.reduce((a, t, i) => a + (t.fp[k] >= thr[k] ? w[i] : 0), 0) /
			wsum,
	)
	crowdCache = { sel, share, thr }
	return crowdCache
}

// ---------- the page ----------

function build(payload: Payload, sig: Signals, titles: Map<string, T>, pool: Pool): FpPayload {
	const used = new Set<string>()
	const use = (ts: T[]) => ts.map((t) => (used.add(t.key), t.key))
	const scored = [...sig.scores.entries()]
		.map(([k, s]) => ({ t: titles.get(k), ...s }))
		.filter(
			(s): s is { t: T; score: number; at: number | null; order: number } =>
				!!s.t,
		)
	const scoreOf = (t: { key: string }) => sig.scores.get(t.key)?.score
	const mu = avgOf(scored.map((s) => s.score))
	const sigma = Math.sqrt(avgOf(scored.map((s) => (s.score - mu) ** 2))) || 1
	const get = (k: string) => titles.get(k)
	const listOf = (s: Set<string>) =>
		[...s].map(get).filter((t): t is T => !!t)
	const chosenKeys = new Set([...sig.scores.keys(), ...sig.watched, ...sig.fav])
	const chosen = [...chosenKeys].map(get).filter((t): t is T => !!t)
	const extra = [
		...listOf(sig.wish).map((t) => ({ t, w: 0.3 })),
		...listOf(sig.skip).map((t) => ({ t, w: -0.6 })),
	]
	const h = halves(
		scored,
		(chosen.length ? chosen : scored.map((s) => s.t)).map((t) => ({ t, w: 1 })),
		extra,
		mu,
		sigma,
	)
	const you = signature(h)
	const crowd = crowdOf(pool)
	const { edge, scales } = edgeOf(h, crowd.sel)
	const edgeSd = Math.sqrt(avgOf(edge.map((e) => e * e))) || 1
	const tierOf = (e: number): FpAttr["tier"] => {
		const s = e / edgeSd
		return (s > 1.6 ? 3 : s > 0.8 ? 2 : s > 0.35 ? 1 : s < -1.6 ? -3 : s < -0.8 ? -2 : s < -0.35 ? -1 : 0) as FpAttr["tier"]
	}

	// Titles that carry each attribute. A title already used for another attribute ranks lower,
	// so one broad favorite doesn't illustrate everything.
	const shown = new Map<string, number>()
	const pick = (from: T[], rank: (t: T) => number, n: number) => {
		const out = [...from]
			.map((t) => ({ t, v: rank(t) - 1.2 * (shown.get(t.key) ?? 0) }))
			.sort((a, b) => b.v - a.v)
			.slice(0, n)
			.map((x) => x.t)
		for (const t of out) shown.set(t.key, (shown.get(t.key) ?? 0) + 1)
		return out
	}
	// Only well-known, non-adult titles illustrate an attribute; everything still counts toward the signature.
	const showable = (t: T) => !t.adult && t.votes >= 300
	const lovedCut = Math.max(mu, 7)
	const liked = scored
		.filter((s) => s.score >= lovedCut || sig.fav.has(s.t.key))
		.map((s) => s.t)
		.filter(showable)
	const disliked = [
		...scored.filter((s) => s.score <= mu - sigma).map((s) => s.t),
		...listOf(sig.skip),
	].filter(showable)
	const order = KEYS.map((_, k) => k).sort(
		(a, b) => Math.abs(edge[b]) - Math.abs(edge[a]),
	)
	const attrs: FpAttr[] = new Array(N)
	const exUsed = new Set<string>()
	for (const k of order) {
		const key = KEYS[k]
		const strong = scored.filter((s) => s.t.fp[k] >= crowd.thr[k])
		const lift = strong.length >= 3 ? r1(avgOf(strong.map((s) => s.score)) - mu) : null
		const carriers = pick(
			liked.filter((t) => t.fp[k] >= 6),
			(t) => t.z[k] + 0.15 * ((scoreOf(t) ?? mu) - mu) + (sig.fav.has(t.key) ? 0.3 : 0),
			6,
		)
		const against = pick(
			disliked.filter((t) => t.fp[k] >= 6),
			(t) => t.z[k] - 0.15 * ((scoreOf(t) ?? mu) - mu),
			4,
		)
		// Against your usual stance: loved despite avoiding it, or disliked despite seeking it.
		let exception: T | null = null
		if (edge[k] < 0) {
			exception =
				scored
					.filter((s) => showable(s.t) && s.t.fp[k] >= 7 && s.score >= Math.max(8, mu + sigma))
					.sort((a, b) => b.score - a.score || b.t.fp[k] - a.t.fp[k])
					.find((s) => !exUsed.has(s.t.key))?.t ?? null
		} else {
			exception =
				scored
					.filter((s) => showable(s.t) && s.t.fp[k] >= 7 && s.score <= Math.min(5, mu - sigma))
					.sort((a, b) => a.score - b.score || b.t.fp[k] - a.t.fp[k])
					.find((s) => !exUsed.has(s.t.key))?.t ?? null
		}
		if (exception) {
			used.add(exception.key)
			exUsed.add(exception.key)
		}
		attrs[k] = {
			key,
			label: FINGERPRINT_META[key]?.label ?? key,
			family: FAMILY_OF[k],
			meaning: FINGERPRINT_META[key]?.description ?? "",
			phrase: PHRASES[key] ?? key.replace(/_/g, " "),
			noun: noun(key),
			you: r2(you[k]),
			crowd: r2(crowd.sel[k]),
			edge: r2(edge[k]),
			tier: tierOf(edge[k]),
			share: r2(scored.length ? strong.length / scored.length : 0),
			crowdShare: r2(crowd.share[k]),
			lift,
			n: strong.length,
			carriers: use(carriers),
			against: use(against),
			exception: exception?.key ?? null,
		}
	}
	const byEdge = [...attrs].sort((a, b) => b.edge - a.edge)
	const headline = {
		seek: byEdge.slice(0, 5).map((a) => a.key),
		avoid: byEdge
			.slice(-4)
			.reverse()
			.map((a) => a.key),
	}

	// Periods of the rating history, each with its own signature against everyone.
	const periods: Period[] = []
	const fmt = (ms: number) =>
		new Date(ms).toLocaleDateString("en", { month: "short", year: "numeric" })
	const dated = sig.dated
		? scored.filter((s) => s.at).sort((a, b) => (a.at ?? 0) - (b.at ?? 0))
		: [...scored].sort((a, b) => a.order - b.order)
	const slices: { label: string; sub: string; items: typeof scored }[] = []
	if (dated.length >= 30) {
		let rest = dated
		if (sig.dated) {
			// A burst of ratings right after joining is what someone brought with them, not a phase.
			const start = dated[0].at ?? 0
			const burst = dated.filter((s) => (s.at ?? 0) - start < 60 * 86_400_000)
			if (burst.length >= dated.length * 0.4 && dated.length - burst.length >= 24) {
				slices.push({
					label: "What you brought with you",
					sub: `${burst.length.toLocaleString("en")} ratings when you joined, ${fmt(start)}`,
					items: burst,
				})
				rest = dated.slice(burst.length)
			}
		}
		const parts = Math.max(1, Math.min(slices.length ? 2 : 3, Math.floor(rest.length / 12)))
		const size = Math.ceil(rest.length / parts)
		for (let i = 0; i < parts; i++) {
			const items = rest.slice(i * size, (i + 1) * size)
			if (!items.length) continue
			const first = items[0].at
			const last = items[items.length - 1].at
			const names = sig.dated
				? slices.length
					? parts === 1
						? ["Since then"]
						: ["After joining", "Lately"]
					: ["Early on", "In between", "Lately"].slice(3 - parts)
				: ["Earlier ratings", "In between", "Latest ratings"].filter(
						(_, j) => parts === 3 || j !== 1,
					)
			slices.push({
				label: names[i] ?? `Part ${i + 1}`,
				sub:
					sig.dated && first && last
						? `${items.length} ratings, ${fmt(first)} to ${fmt(last)}`
						: `${items.length} ratings`,
				items,
			})
		}
	}
	slices.forEach((s, i) => {
		const pe = edgeOf(
			halves(s.items, s.items.map((x) => ({ t: x.t, w: 1 })), [], mu, sigma),
			crowd.sel,
			scales,
		).edge
		periods.push({
			id: `p${i}`,
			label: s.label,
			sub: s.sub,
			count: s.items.length,
			edge: pe.map(r2),
			top: use(
				[...s.items]
					.filter((x) => showable(x.t))
					.sort((a, b) => b.score - a.score || b.t.votes - a.t.votes)
					.slice(0, 6)
					.map((x) => x.t),
			),
		})
	})

	// Unseen titles: ranked by the signature, and a wider set the tuner can re-rank in the browser.
	const seen = new Set([
		...sig.scores.keys(),
		...sig.watched,
		...sig.fav,
		...sig.skip,
		...sig.wish,
	])
	const unseen = pool.items.filter(
		(t) => !seen.has(t.key) && t.score >= 60 && !t.adult,
	)
	const q = (t: T) => 0.4 * ((t.score - 72) / 100)
	const ranked = unseen
		.map((t) => ({ t, sim: cos(t.z, you), v: cos(t.z, you) + q(t) }))
		.sort((a, b) => b.v - a.v)
	const cand = new Map<string, T>()
	for (const x of ranked.slice(0, 180)) cand.set(x.t.key, x.t)
	for (const a of [...headline.seek, ...headline.avoid, ...byEdge.slice(5, 14).map((a) => a.key)]) {
		const k = KEYS.indexOf(a)
		for (const t of [...unseen]
			.sort((x, y) => y.z[k] + y.score / 40 - (x.z[k] + x.score / 40))
			.slice(0, 8))
			cand.set(t.key, t)
	}
	const zOut = (t: T) => t.z.map((x) => r1(Math.max(-3, Math.min(3, x))))
	const candidates = [...cand.values()].map((t) => ({
		key: (used.add(t.key), t.key),
		z: zOut(t),
		q: r2(q(t)),
	}))

	// Titles to lay over the signature: top picks, favorites, and popular titles that clash.
	const probes: Probe[] = []
	const probe = (t: T, kind: Probe["kind"]) => {
		if (probes.some((p) => p.key === t.key)) return
		used.add(t.key)
		probes.push({ key: t.key, kind, match: toMatch(cos(t.z, you)), z: zOut(t) })
	}
	for (const x of ranked.slice(0, 8)) probe(x.t, "pick")
	for (const s of [...scored]
		.filter((s) => showable(s.t) && s.score >= Math.max(8, mu + sigma))
		.sort((a, b) => cos(b.t.z, you) - cos(a.t.z, you))
		.slice(0, 3))
		probe(s.t, "loved")
	for (const x of [...ranked]
		.filter((x) => x.t.votes >= 20_000)
		.sort((a, b) => a.sim - b.sim)
		.slice(0, 3))
		probe(x.t, "clash")

	// Friends: round 2's demo friends, read the same way from their ratings.
	const friends = payload.report.friends.map((f) => {
		for (const b of f.both) used.add(b.key)
		for (const c of f.canon) used.add(c)
		const ratings = FRIENDS.find((x) => x.id === f.id)?.ratings ?? {}
		const fs = Object.entries(ratings)
			.map(([k, score]) => ({ t: titles.get(k) ?? pool.byKey.get(k), score }))
			.filter((x): x is { t: T; score: number } => !!x.t)
		const fmu = avgOf(fs.map((x) => x.score))
		const fsd = Math.sqrt(avgOf(fs.map((x) => (x.score - fmu) ** 2))) || 1
		const fe = edgeOf(
			halves(fs, fs.map((x) => ({ t: x.t, w: 1 })), [], fmu, fsd),
			crowd.sel,
		).edge
		return {
			id: f.id,
			name: f.name,
			blurb: f.blurb,
			archetype: f.archetype,
			overlap: Math.round(50 + 50 * cos(edge, fe)),
			edge: fe.map(r2),
			both: f.both,
			canon: f.canon,
		}
	})

	// Only ship the titles the page shows, without fingerprints.
	const mine = payload.services.filter((s) => s.mine).map((s) => s.id)
	const serviceIds = new Set([...SERVICE_IDS, ...mine])
	const country = payload.report.who.country
	const items: Record<string, Title> = {}
	for (const key of used) {
		const known = payload.items[key]
		if (known) {
			items[key] = { ...known, mine: scoreOf(known) ?? known.mine }
			continue
		}
		const t = titles.get(key) ?? pool.byKey.get(key)
		if (!t) continue
		const { sa, z, adult, ...rest } = t
		items[key] = {
			...rest,
			fp: [],
			mine: scoreOf(t),
			fav: sig.fav.has(key) || undefined,
			services: [...serviceIds].filter((id) => sa.includes(`${country}_${id}`)),
		}
	}

	return {
		who: payload.report.who,
		archetype: payload.report.archetype,
		headline,
		families: FAMILIES,
		attrs,
		you: you.map(r2),
		periods,
		datedPeriods: sig.dated,
		probes,
		candidates,
		friends,
		items,
		services: payload.services,
	}
}

// ---------- entry ----------

const cache = new Map<string, { at: number; data: FpPayload }>()

export async function getFingerprintPage(
	request: Request,
): Promise<{ payload: FpPayload; headers: Headers }> {
	const { payload, headers } = await getTasteReport(request)
	const url = new URL(request.url)
	const as = url.searchParams.get("as") ?? "me"
	let userId: string | null = null
	if (payload.report.who.mode === "me") {
		const devUser =
			/^[0-9a-f-]{36}$/.test(as) &&
			url.hostname === "localhost" &&
			process.env.NODE_ENV !== "production"
				? as
				: null
		userId = devUser ?? (await getAuthFromRequest({ request })).user?.id ?? null
	}
	const cacheKey = userId ?? "demo"
	const hit = cache.get(cacheKey)
	if (hit && Date.now() - hit.at < 5 * 60_000)
		return { payload: { ...hit.data, who: payload.report.who }, headers }
	const [pool, sig] = await Promise.all([getPool(), loadSignals(userId)])
	const keys = new Set([
		...sig.scores.keys(),
		...sig.wish,
		...sig.skip,
		...sig.watched,
		...sig.fav,
		...FRIENDS.flatMap((f) => Object.keys(f.ratings)),
	])
	const titles = await loadTitles([...keys], pool)
	const data = build(payload, sig, titles, pool)
	cache.set(cacheKey, { at: Date.now(), data })
	return { payload: data, headers }
}
