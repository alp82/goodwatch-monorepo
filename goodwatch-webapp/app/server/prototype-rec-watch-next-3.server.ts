// PROTOTYPE - throwaway. Read-only data for /prototype/rec-watch-next-3 (issue #176, round 3).
// A copy of round 2's loader (prototype-rec-watch-next-2.server.ts), with one addition: on localhost in
// development, ?as=<user uuid> reads that person's Wishlist, ratings, and services instead of the
// signed-in session, so the real ~350-title Wishlist can be checked in a headless browser.
// Nothing is written anywhere; the page keeps every change in local state.
import { getUserData } from "~/server/userData.server"
import { getUserSettings } from "~/server/user-settings.server"
import { VALID_FINGERPRINT_KEYS } from "~/server/utils/fingerprint"
import type { Offer } from "~/ui/prototype-rec-watch-next/model"
import type { LoaderData, Mood, WishlistMode, WTitle } from "~/ui/prototype-rec-watch-next-2/model"
import { getUserIdFromRequest } from "~/utils/auth"
import { query } from "~/utils/crate"
import { duplicateProviderMapping, getShorterProviderLabel, ignoredProviders } from "~/utils/streaming-links"

type Type = "movie" | "show"
type Row = {
	tmdb_id: number
	title: string
	release_year: number | null
	poster_path: string | null
	backdrop_path: string | null
	genres: string[] | null
	synopsis: string | null
	tagline: string | null
	score: number | null
	runtime: number | null
	popularity: number | null
	fp: Record<string, number> | null
	recs: number[] | null
	comfort: boolean | null
	thought: boolean | null
	escapism: boolean | null
	binge: boolean | null
	dropin: boolean | null
}
type Raw = Row & { type: Type; key: string }

const DEMO_SERVICES = [8, 9, 337]
const SUBSCRIPTION = ["flatrate", "flatrate_and_buy", "free", "ads"]
const DAY = 86400000

const cols = (type: Type) => `tmdb_id, title, release_year, poster_path, backdrop_path, genres, synopsis, tagline,
	goodwatch_overall_score_normalized_percent AS score, popularity,
	${type === "movie" ? "runtime" : "episode_runtime[1]"} AS runtime,
	fingerprint_scores AS fp, tmdb_recommendation_ids AS recs,
	context_is_comfort_watch AS comfort, context_is_thought_provoking AS thought, context_is_pure_escapism AS escapism,
	context_is_binge_friendly AS binge, context_is_drop_in_friendly AS dropin`

const tag = (type: Type) => (r: Row): Raw => ({ ...r, type, key: `${type}:${r.tmdb_id}` })

const brand = (name: string) =>
	getShorterProviderLabel(name)
		.replace(/\s+(Amazon|Apple TV|Roku Premium)\s+Channel$/i, "")
		.replace(/\s+(Standard|Basic)\s+with\s+Ads$/i, "")
		.replace(/\s+with\s+Ads$/i, "")
		.replace(/\s+(Essential|Premium|Basic|Standard)$/i, "")

// Popular, well-rated titles with posters, backdrops, and a fingerprint. Cached for the process.
let poolPromise: Promise<Raw[]> | null = null
const loadPool = () => {
	poolPromise ??= Promise.all(
		(["movie", "show"] as const).map((type) =>
			query<Row>(
				`SELECT ${cols(type)} FROM ${type}
				 WHERE poster_path IS NOT NULL AND backdrop_path IS NOT NULL AND fingerprint_scores IS NOT NULL
					AND goodwatch_overall_score_voting_count >= ${type === "movie" ? 5000 : 2000}
					AND goodwatch_overall_score_normalized_percent >= 62
				 ORDER BY popularity DESC LIMIT ${type === "movie" ? 520 : 240}`,
			).then((rows) => rows.map(tag(type))),
		),
	)
		.then(([m, s]) => m.flatMap((x, i) => [x, s[i]]).filter(Boolean))
		.catch((e) => {
			poolPromise = null
			throw e
		})
	return poolPromise
}

async function loadByIds(type: Type, ids: number[]) {
	if (!ids.length) return []
	const out: Raw[] = []
	for (let i = 0; i < ids.length; i += 500) {
		const chunk = ids.slice(i, i + 500)
		const rows = await query<Row>(
			`SELECT ${cols(type)} FROM ${type} WHERE tmdb_id IN (${chunk.map(() => "?").join(",")}) AND poster_path IS NOT NULL LIMIT ${chunk.length}`,
			chunk,
		)
		out.push(...rows.map(tag(type)))
	}
	return out
}

// Subscription offers for every loaded title, plus when each offer first appeared.
async function loadOffers(titles: Raw[], country: string, owned: number[]) {
	const out = new Map<string, (Offer & { since: number })[]>()
	await Promise.all(
		(["movie", "show"] as const).map(async (type) => {
			const ids = titles.filter((t) => t.type === type).map((t) => t.tmdb_id)
			for (let i = 0; i < ids.length; i += 800) {
				const chunk = ids.slice(i, i + 800)
				if (!chunk.length) continue
				const rows = await query<{ media_tmdb_id: number; sid: number; name: string; logo: string; ord: number | null; created: number }>(
					`SELECT sa.media_tmdb_id, sa.streaming_service_id AS sid, s.name, s.logo_path AS logo, s.order_default AS ord, sa.created_at AS created
					 FROM streaming_availability sa
					 JOIN streaming_service s ON s.tmdb_id = sa.streaming_service_id AND s.media_type = sa.media_type
					 WHERE sa.media_type = ? AND sa.country_code = ? AND sa.streaming_type IN ('${SUBSCRIPTION.join("','")}')
						AND sa.media_tmdb_id IN (${chunk.map(() => "?").join(",")})
					 LIMIT 20000`,
					[type, country, ...chunk],
				)
				for (const r of rows) {
					if (ignoredProviders.includes(r.sid)) continue
					const k = `${type}:${r.media_tmdb_id}`
					const list = out.get(k) ?? []
					const name = brand(r.name)
					const prev = list.find((o) => o.name === name)
					if (prev) {
						prev.since = Math.min(prev.since, r.created)
						continue
					}
					list.push({ id: r.sid, name, logo: `https://www.themoviedb.org/t/p/original${r.logo}`, owned: owned.includes(r.sid), order: r.ord ?? 999, since: r.created })
					out.set(k, list)
				}
			}
		}),
	)
	for (const list of out.values()) list.sort((a, b) => Number(b.owned) - Number(a.owned) || a.order - b.order)
	return out
}

// Titles that arrived on one of the person's services in the last 30 days.
async function loadNewOnServices(country: string, owned: number[]) {
	const rows = await query<{ media_tmdb_id: number; media_type: Type }>(
		`SELECT media_tmdb_id, media_type FROM streaming_availability
		 WHERE country_code = ? AND streaming_type IN ('${SUBSCRIPTION.join("','")}')
			AND streaming_service_id IN (${owned.map(() => "?").join(",")}) AND created_at > now() - INTERVAL '30 days'
		 LIMIT 4000`,
		[country, ...owned],
	)
	const by = { movie: new Set<number>(), show: new Set<number>() }
	for (const r of rows) by[r.media_type]?.add(r.media_tmdb_id)
	const [m, s] = await Promise.all(
		(["movie", "show"] as const).map((type) =>
			[...by[type]].length
				? query<Row>(
						`SELECT ${cols(type)} FROM ${type}
						 WHERE tmdb_id IN (${[...by[type]].slice(0, 1500).join(",")}) AND poster_path IS NOT NULL AND backdrop_path IS NOT NULL
							AND fingerprint_scores IS NOT NULL AND goodwatch_overall_score_voting_count >= 800 AND goodwatch_overall_score_normalized_percent >= 60
						 ORDER BY popularity DESC LIMIT 40`,
					).then((r) => r.map(tag(type)))
				: Promise.resolve([] as Raw[]),
		),
	)
	return [...m, ...s]
}

// ------------------------------------------------------------------ taste

const vec = (t: Raw) => VALID_FINGERPRINT_KEYS.map((k) => t.fp?.[k] ?? 0)
const hasFp = (t: Raw) => !!t.fp && Object.keys(t.fp).length > 10

function tasteVector(rated: { t: Raw; score: number }[], wished: Raw[], mean: number[]) {
	const v = new Array(mean.length).fill(0)
	const addTo = (t: Raw, w: number) => vec(t).forEach((x, i) => (v[i] += w * (x - mean[i])))
	for (const { t, score } of rated) if (hasFp(t)) addTo(t, (score - 5.5) / 4.5)
	for (const t of wished) if (hasFp(t)) addTo(t, 0.5 / Math.max(1, wished.length / 20))
	return v
}
const cosine = (a: number[], b: number[]) => {
	let d = 0
	let na = 0
	let nb = 0
	for (let i = 0; i < a.length; i++) {
		d += a[i] * b[i]
		na += a[i] * a[i]
		nb += b[i] * b[i]
	}
	return na && nb ? d / Math.sqrt(na * nb) : 0
}

// ------------------------------------------------------------------ demo lists

// Deterministic pseudo-random so SSR and hydration agree and every reload shows the same demo.
const rand = (seed: number) => () => {
	seed = (seed * 1664525 + 1013904223) % 4294967296
	return seed / 4294967296
}

function demoLists(pool: Raw[], mode: WishlistMode) {
	const r = rand(172176)
	// A demo member who loves tense, clever, dark stories and shrugs at broad comedy.
	const likes = (t: Raw) => (t.fp?.tension ?? 0) + (t.fp?.complexity ?? 0) + (t.fp?.psychological ?? 0) + (t.fp?.dark_humor ?? 0) - (t.fp?.physical_comedy ?? 0) - (t.fp?.wholesome ?? 0)
	const sorted = [...pool].filter(hasFp).sort((a, b) => likes(b) - likes(a))
	const ratings: Record<string, number> = {}
	for (const t of sorted.slice(0, 36)) ratings[t.key] = 8 + Math.floor(r() * 3)
	for (const t of sorted.slice(-10)) ratings[t.key] = 3 + Math.floor(r() * 2)
	const free = pool.filter((t) => !(t.key in ratings))
	const now = Date.now()
	if (mode === "empty") return { ratings, wishlist: [] as { key: string; added: number }[] }
	if (mode === "few") {
		const known = free.filter((t) => (t.release_year ?? 9999) <= 2024 && (t.score ?? 0) >= 75)
		const picks = [known[1], known[6], known[13]].filter(Boolean)
		return { ratings, wishlist: picks.map((t, i) => ({ key: t.key, added: now - (i * 3 + 1) * DAY })) }
	}
	// many: about 300 titles added over four years, newest first.
	const shuffled = [...free].sort(() => r() - 0.5).slice(0, 300)
	const wishlist = shuffled.map((t, i) => ({ key: t.key, added: now - Math.round((i / 300) ** 1.6 * 1460 * DAY + r() * 3 * DAY) }))
	return { ratings, wishlist }
}

// ------------------------------------------------------------------ loader

export async function getWatchNext3(request: Request): Promise<LoaderData> {
	const url = new URL(request.url)
	const as = url.searchParams.get("as") ?? ""
	const devUser = /^[0-9a-f-]{36}$/.test(as) && url.hostname === "localhost" && process.env.NODE_ENV !== "production" ? as : null
	const userId = devUser ?? (await getUserIdFromRequest({ request }).catch(() => undefined))
	const asked = url.searchParams.get("wishlist") as WishlistMode | null
	const mode: WishlistMode = asked && ["empty", "few", "many", "me"].includes(asked) ? (asked === "me" && !userId ? "many" : asked) : userId ? "me" : "many"

	const settings = (userId ? await getUserSettings({ userId }).catch(() => ({})) : {}) as { country_default?: string; streaming_providers_default?: string }
	const country = url.searchParams.get("country") ?? settings.country_default ?? "DE"
	const saved = String(settings.streaming_providers_default ?? "")
		.split(",")
		.map(Number)
		.filter(Boolean)
	const base = saved.length ? saved : DEMO_SERVICES
	const owned = base.flatMap((id) => (id in duplicateProviderMapping ? [id, ...duplicateProviderMapping[id]] : [id]))

	const [pool, fresh] = await Promise.all([loadPool(), loadNewOnServices(country, owned).catch(() => [] as Raw[])])
	const byKey = new Map<string, Raw>()
	for (const t of [...pool, ...fresh]) byKey.set(t.key, t)

	// Wishlist, ratings, and seen for the chosen state.
	let wishlist: { key: string; added: number }[] = []
	let ratings: Record<string, number> = {}
	let seen: string[] = []
	if (mode === "me" && userId) {
		const data = await getUserData({ user_id: userId })
		const k = (mk: string) => mk.replace("-", ":")
		wishlist = Object.entries(data.wishlist)
			.map(([mk, v]) => ({ key: k(mk), added: new Date(v.updatedAt).getTime() }))
			.sort((a, b) => b.added - a.added)
		// The most recent 400 scores are plenty for a taste vector.
		const scored = Object.entries(data.scores).sort((a, b) => new Date(b[1].updatedAt).getTime() - new Date(a[1].updatedAt).getTime())
		for (const [mk, v] of scored) ratings[k(mk)] = Number(v.score)
		seen = [...new Set([...Object.keys(data.watched).map(k), ...Object.keys(data.skipped).map(k), ...Object.keys(ratings)])]
		const missing = (keys: string[], type: Type) => keys.filter((x) => x.startsWith(`${type}:`) && !byKey.has(x)).map((x) => Number(x.split(":")[1]))
		const need = [...wishlist.map((w) => w.key), ...scored.slice(0, 400).map(([mk]) => k(mk))]
		const [m, s] = await Promise.all((["movie", "show"] as const).map((type) => loadByIds(type, missing(need, type))))
		for (const t of [...m, ...s]) byKey.set(t.key, t)
		wishlist = wishlist.filter((w) => byKey.has(w.key))
	} else {
		const d = demoLists(pool, mode)
		wishlist = d.wishlist
		ratings = d.ratings
		seen = Object.keys(ratings)
	}

	// "Because you added X": TMDB recommendations of the newest Wishlist titles, loaded when missing.
	const recentSeeds = wishlist.slice(0, 8).map((w) => byKey.get(w.key)).filter((t): t is Raw => !!t)
	const recKeys = recentSeeds.flatMap((t) => (t.recs ?? []).slice(0, 10).map((id) => `${t.type}:${id}`))
	const [rm, rs] = await Promise.all((["movie", "show"] as const).map((type) => loadByIds(type, [...new Set(recKeys.filter((x) => x.startsWith(`${type}:`) && !byKey.has(x)).map((x) => Number(x.split(":")[1])))])))
	for (const t of [...rm, ...rs]) if (t.backdrop_path && (t.score ?? 0) >= 55) byKey.set(t.key, t)

	const all = [...byKey.values()]
	const offers = await loadOffers(all, country, owned)

	// Taste match: cosine to the person's taste vector, shown as 50 + 0.49 x percentile (see #174).
	const withFp = all.filter(hasFp)
	const mean = VALID_FINGERPRINT_KEYS.map((_, i) => withFp.reduce((s, t) => s + vec(t)[i], 0) / Math.max(1, withFp.length))
	const rated = Object.entries(ratings)
		.map(([key, score]) => ({ t: byKey.get(key)!, score }))
		.filter((x) => x.t)
	const tv = tasteVector(rated, wishlist.slice(0, 60).map((w) => byKey.get(w.key)!).filter(Boolean), mean)
	const centred = new Map(withFp.map((t) => [t.key, vec(t).map((x, i) => x - mean[i])]))
	const raw = withFp.map((t) => ({ key: t.key, c: cosine(centred.get(t.key)!, tv) })).sort((a, b) => a.c - b.c)
	const match = new Map(raw.map((x, i) => [x.key, Math.round(50 + (49 * i) / Math.max(1, raw.length - 1))]))

	// Near neighbours: TMDB recommendations first, then fingerprint neighbours among pool titles.
	const poolKeys = new Set([...pool, ...fresh, ...rm, ...rs].map((t) => t.key))
	const poolFp = withFp.filter((t) => poolKeys.has(t.key))
	const near = (t: Raw) => {
		const fromRecs = (t.recs ?? []).map((id) => `${t.type}:${id}`).filter((k) => byKey.has(k) && k !== t.key)
		if (fromRecs.length >= 8 || !centred.has(t.key)) return fromRecs.slice(0, 10)
		const me = centred.get(t.key)!
		const nn = poolFp
			.filter((o) => o.key !== t.key && !fromRecs.includes(o.key))
			.map((o) => ({ k: o.key, c: cosine(me, centred.get(o.key)!) }))
			.sort((a, b) => b.c - a.c)
			.slice(0, 10 - fromRecs.length)
			.map((x) => x.k)
		return [...fromRecs, ...nn]
	}

	const now = Date.now()
	const titles: WTitle[] = all.map((t) => {
		const o = offers.get(t.key) ?? []
		const mine = o.filter((x) => x.owned)
		const newest = mine.length ? Math.max(...mine.map((x) => x.since)) : 0
		// Leaving dates are not in the data yet; a stable hash marks about one in twelve titles on your services.
		const h = [...t.key].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7)
		const moods: Mood[] = []
		if (t.comfort) moods.push("comfort")
		if (t.thought) moods.push("thoughtful")
		if (t.escapism) moods.push("escape")
		if (t.binge) moods.push("binge")
		if (t.dropin) moods.push("light")
		return {
			key: t.key,
			type: t.type,
			id: t.tmdb_id,
			title: t.title,
			year: t.release_year,
			poster: t.poster_path,
			backdrop: t.backdrop_path,
			genres: (t.genres ?? []).slice(0, 3),
			synopsis: "",
			tagline: (t.tagline ?? "").slice(0, 120),
			score: t.score == null ? null : Math.round(t.score),
			runtime: t.runtime,
			episodes: [],
			offers: o.slice(0, 5).map(({ since, ...rest }) => rest),
			match: match.get(t.key) ?? null,
			near: [],
			moods,
			popularity: t.popularity ?? 0,
			newOnMine: newest > now - 30 * DAY ? newest : null,
			leavingInDays: mine.length && h % 12 === 0 ? 3 + (h % 11) : null,
		}
	})
	// Near lists only for titles someone can add or has added, to keep the payload small.
	const wanted = new Set([...wishlist.map((w) => w.key), ...pool.slice(0, 400).map((t) => t.key), ...fresh.map((t) => t.key), ...rm.map((t) => t.key), ...rs.map((t) => t.key)])
	for (const t of titles) if (wanted.has(t.key)) t.near = near(byKey.get(t.key)!)

	return {
		mode,
		signedIn: !!userId,
		country,
		demoServices: !saved.length,
		services: [...new Map(titles.flatMap((t) => t.offers.filter((o) => o.owned)).map((o) => [o.name, { id: o.id, name: o.name, logo: o.logo }])).values()],
		titles,
		pool: pool.map((t) => t.key),
		fresh: fresh.map((t) => t.key),
		wishlist,
		ratings,
		seen,
	}
}
