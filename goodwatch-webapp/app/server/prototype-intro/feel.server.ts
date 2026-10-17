// PROTOTYPE - throwaway. Extra data for the "feel" intro clips (fingerprint and recommendations); lands in
// IntroData.extra["feel"]. All real: the start titles' title analysis scores, a same-genre pair that feels most
// different, real guest recommendations for a liked trio, and the start titles grouped into "sides" by how they feel.
import {
	type GuestRecommendation,
	getGuestMovieRecommendations,
	getGuestShowRecommendations,
} from "~/server/guest-recommendations.server"
import type { LandingCard } from "~/server/prototype-landing.server"
import { adjective, isWorded, noun } from "~/server/taste-portrait/words.server"
import { type CoreScores, type PillarTiers, computePillarScores } from "~/server/utils/fingerprint"
import { FINGERPRINT_META } from "~/ui/fingerprint/fingerprintMeta"
import { query } from "~/utils/crate"

export type FeelKey = { key: string; label: string; adjective: string; emoji: string; color: string; value: number }
export type FeelTitle = {
	media_type: "movie" | "show"
	tmdb_id: number
	title: string
	poster_path: string | null
	backdrop_path: string | null
	year: number | null
	genres: string[]
	score: number | null
	tagline: string | null
	pillars: PillarTiers
	/** The strongest worded attributes (no craft), strongest first. */
	top: FeelKey[]
}
export type FeelRec = {
	media_type: "movie" | "show"
	tmdb_id: number
	title: string
	poster_path: string | null
	backdrop_path: string | null
	score: number | null
	match: number | null
	/** The attributes it shares most with the liked titles. */
	shared: FeelKey[]
}
export type FeelSide = { name: string; words: string[]; titles: FeelTitle[]; pick: FeelRec | null }
export type FeelData = {
	titles: FeelTitle[]
	pair: { genre: string; a: FeelTitle; b: FeelTitle } | null
	loved: FeelTitle[]
	recs: FeelRec[]
	sides: FeelSide[]
}

type Row = { tmdb_id: number; genres: string[] | null; fingerprint_scores: Record<string, number> | null; tagline: string | null }

const keyOf = (key: string, value: number): FeelKey => {
	const meta = FINGERPRINT_META[key]
	return {
		key,
		label: meta?.label ?? key,
		adjective: adjective(key),
		emoji: meta?.emoji ?? "",
		color: meta?.color ?? "rgba(251,191,36,.6)",
		value,
	}
}

const topKeys = (fp: Record<string, number>, n = 8) =>
	Object.entries(fp)
		.filter(([k, v]) => isWorded(k) && typeof v === "number")
		.sort((a, b) => b[1] - a[1])
		.slice(0, n)
		.map(([k, v]) => keyOf(k, v))

async function readRows(type: "movie" | "show", ids: number[]) {
	if (!ids.length) return new Map<number, Row>()
	const rows = await query<Row>(
		`SELECT tmdb_id, genres, fingerprint_scores, tagline FROM ${type} WHERE tmdb_id IN (${ids.map(() => "?").join(", ")})`,
		ids,
	)
	return new Map(rows.map((r) => [r.tmdb_id, r]))
}

async function fingerprints(items: { media_type: "movie" | "show"; tmdb_id: number }[]) {
	const [movies, shows] = await Promise.all([
		readRows("movie", items.filter((i) => i.media_type === "movie").map((i) => i.tmdb_id)),
		readRows("show", items.filter((i) => i.media_type === "show").map((i) => i.tmdb_id)),
	])
	return (i: { media_type: "movie" | "show"; tmdb_id: number }) => (i.media_type === "movie" ? movies : shows).get(i.tmdb_id)
}

/** Cosine distance between two titles' worded attributes. */
function distance(a: Record<string, number>, b: Record<string, number>) {
	let dot = 0
	let na = 0
	let nb = 0
	for (const k of Object.keys(a)) {
		if (!isWorded(k)) continue
		const x = a[k] ?? 0
		const y = b[k] ?? 0
		dot += x * y
		na += x * x
		nb += y * y
	}
	return na && nb ? 1 - dot / Math.sqrt(na * nb) : 1
}

function sharedKeys(fps: Record<string, number>[], with_: Record<string, number> | null, n = 3) {
	const sum: Record<string, number> = {}
	for (const fp of fps) for (const [k, v] of Object.entries(fp)) if (isWorded(k)) sum[k] = (sum[k] ?? 0) + v
	const ranked = Object.entries(sum)
		.map(([k, v]) => [k, with_ ? Math.min(v / fps.length, with_[k] ?? 0) : v / fps.length] as const)
		.sort((a, b) => b[1] - a[1])
	return ranked.slice(0, n).map(([k, v]) => keyOf(k, v))
}

async function recommend(liked: FeelTitle[], exclude: { media_type: "movie" | "show"; tmdb_id: number }[], limit: number) {
	const shows = liked.filter((t) => t.media_type === "show").length
	const type = shows * 2 >= liked.length ? "show" : "movie"
	const params = {
		scored_items: liked.map((t) => ({ tmdb_id: t.tmdb_id, media_type: t.media_type, score: 10 })),
		exclude_ids: exclude,
		limit,
	}
	const recs: GuestRecommendation[] =
		type === "show" ? await getGuestShowRecommendations(params) : await getGuestMovieRecommendations(params)
	return recs
}

export async function load(_request: Request, landing: LandingCard[]): Promise<FeelData> {
	const fpOf = await fingerprints(landing)
	const titles: FeelTitle[] = landing.flatMap((c) => {
		const row = fpOf(c)
		const fp = row?.fingerprint_scores
		if (!fp || !Object.keys(fp).length) return []
		return [
			{
				media_type: c.media_type,
				tmdb_id: c.tmdb_id,
				title: c.title,
				poster_path: c.poster_path,
				backdrop_path: c.backdrop_path,
				year: c.release_year,
				genres: row?.genres ?? [],
				score: c.goodwatch_overall_score_normalized_percent,
				tagline: row?.tagline ?? c.tagline,
				pillars: computePillarScores(fp as CoreScores),
				top: topKeys(fp),
			},
		]
	})
	const fpByKey = new Map(titles.map((t) => [`${t.media_type}-${t.tmdb_id}`, fpOf(t)?.fingerprint_scores ?? {}]))
	const fp = (t: { media_type: string; tmdb_id: number }) => fpByKey.get(`${t.media_type}-${t.tmdb_id}`) ?? {}

	// Same genre, most different feel.
	let pair: FeelData["pair"] = null
	let best = -1
	for (let i = 0; i < titles.length; i++)
		for (let j = i + 1; j < titles.length; j++) {
			const genre = titles[i].genres.find((g) => titles[j].genres.includes(g))
			if (!genre || !titles[i].backdrop_path || !titles[j].backdrop_path) continue
			const d = distance(fp(titles[i]), fp(titles[j]))
			if (d > best) {
				best = d
				pair = { genre, a: titles[i], b: titles[j] }
			}
		}

	// A liked trio of well-known shows, when they are there; else the first three shows.
	const prefer = ["Ted Lasso", "The Office", "The Simpsons"]
	const shows = titles.filter((t) => t.media_type === "show")
	const loved = [...prefer.flatMap((n) => shows.filter((t) => t.title === n)), ...shows].filter(
		(t, i, all) => all.indexOf(t) === i,
	).slice(0, 3)
	const exclude = landing.map((c) => ({ media_type: c.media_type, tmdb_id: c.tmdb_id }))
	const raw = loved.length === 3 ? await recommend(loved, exclude, 8).catch(() => []) : []
	const recFp = await fingerprints(raw)
	const lovedFps = loved.map(fp)
	const toRec = (r: GuestRecommendation, liked: Record<string, number>[]): FeelRec => ({
		media_type: r.media_type,
		tmdb_id: r.tmdb_id,
		title: Array.isArray(r.title) ? r.title[0] : r.title,
		poster_path: r.poster_path ?? null,
		backdrop_path: r.backdrop_path ?? null,
		score: r.goodwatch_overall_score_normalized_percent ?? null,
		match: r.match_percentage ?? null,
		shared: sharedKeys(liked, recFp(r)?.fingerprint_scores ?? null),
	})
	const recs = raw.filter((r) => r.backdrop_path && r.poster_path).map((r) => toRec(r, lovedFps))

	// Sides: the start titles in three groups by how they feel (farthest seeds, then nearest seed).
	const pool = titles.slice()
	const seeds: FeelTitle[] = []
	if (pool.length >= 6) {
		seeds.push(pool[0])
		while (seeds.length < 3) {
			const next = pool
				.filter((t) => !seeds.includes(t))
				.map((t) => [t, Math.min(...seeds.map((s) => distance(fp(s), fp(t))))] as const)
				.sort((a, b) => b[1] - a[1])[0]
			seeds.push(next[0])
		}
	}
	const groups = seeds.map(() => [] as FeelTitle[])
	for (const t of pool) {
		if (!seeds.length) break
		const i = seeds
			.map((s, n) => [n, distance(fp(s), fp(t))] as const)
			.sort((a, b) => a[1] - b[1])[0][0]
		groups[i].push(t)
	}
	const sides: FeelSide[] = await Promise.all(
		groups
			.filter((g) => g.length >= 2)
			.map(async (g) => {
				const words = sharedKeys(g.map(fp), null, 2)
				const name = words.length === 2 ? `${words[0].adjective} ${noun(words[1].key)}` : (words[0]?.adjective ?? "")
				const picks = await recommend(g.slice(0, 4), exclude, 3).catch(() => [])
				const pick = picks.find((p) => p.backdrop_path && p.poster_path)
				return {
					name: name.charAt(0).toUpperCase() + name.slice(1),
					words: words.map((w) => w.adjective),
					titles: g,
					pick: pick ? toRec(pick, g.map(fp)) : null,
				}
			}),
	)
	return { titles, pair, loved, recs, sides }
}
