// PROTOTYPE - throwaway. Read-only catalog pool for /prototype/rec-taste.
// Loads popular films and shows with their fingerprint, genres, directors, and German streaming
// services from Crate, plus a demo member's ratings. Nothing is written anywhere.
import { VALID_FINGERPRINT_KEYS } from "~/server/utils/fingerprint"
import type { PoolItem, TastePool } from "~/ui/prototype-rec-taste/model"
import { DEMO_RATINGS, DEMO_SERVICES, SERVICE_IDS } from "~/ui/prototype-rec-taste/model"
import { query } from "~/utils/crate"

const TMDB = "https://image.tmdb.org/t/p"
const COUNTRY = "DE"

type Row = {
	tmdb_id: number
	title: string
	release_year: number | null
	poster_path: string | null
	backdrop_path: string | null
	genres: string[] | null
	score: number | null
	fp: Record<string, number> | null
	sa: string[] | null
	synopsis: string | null
	tags: string[] | null
}

const COLS = `tmdb_id, title, release_year, poster_path, backdrop_path, genres, synopsis,
	goodwatch_overall_score_normalized_percent AS score, fingerprint_scores AS fp,
	streaming_availabilities AS sa, essence_tags AS tags`

const toItem = (type: "movie" | "show", r: Row): PoolItem => ({
	key: `${type}-${r.tmdb_id}`,
	type,
	id: r.tmdb_id,
	title: r.title,
	year: r.release_year ?? 0,
	poster: r.poster_path ? `${TMDB}/w342${r.poster_path}` : "",
	backdrop: r.backdrop_path ? `${TMDB}/w1280${r.backdrop_path}` : "",
	genres: r.genres ?? [],
	score: r.score == null ? 0 : Math.floor(r.score),
	fp: VALID_FINGERPRINT_KEYS.map((k) => r.fp?.[k] ?? 0),
	services: SERVICE_IDS.filter((id) => r.sa?.includes(`${COUNTRY}_${id}`)),
	directors: [],
	synopsis: r.synopsis ?? "",
	tags: (r.tags ?? []).slice(0, 4),
})

async function loadPool(): Promise<TastePool> {
	const demoIds = (type: "movie" | "show") => Object.keys(DEMO_RATINGS).filter((k) => k.startsWith(type)).map((k) => Number(k.split("-")[1]))
	const [movies, shows, demoMovies, demoShows, services] = await Promise.all([
		query<Row>(
			`SELECT ${COLS} FROM movie WHERE poster_path IS NOT NULL AND backdrop_path IS NOT NULL AND fingerprint_scores IS NOT NULL
			 AND goodwatch_overall_score_voting_count >= 20000 ORDER BY goodwatch_overall_score_voting_count DESC LIMIT 300`,
		),
		query<Row>(
			`SELECT ${COLS} FROM show WHERE poster_path IS NOT NULL AND backdrop_path IS NOT NULL AND fingerprint_scores IS NOT NULL
			 AND goodwatch_overall_score_voting_count >= 5000 ORDER BY goodwatch_overall_score_voting_count DESC LIMIT 140`,
		),
		query<Row>(`SELECT ${COLS} FROM movie WHERE tmdb_id IN (${demoIds("movie").join(",")})`),
		query<Row>(`SELECT ${COLS} FROM show WHERE tmdb_id IN (${demoIds("show").join(",")})`),
		query<{ tmdb_id: number; name: string; logo_path: string }>(
			`SELECT tmdb_id, name, logo_path FROM streaming_service WHERE tmdb_id IN (${SERVICE_IDS.join(",")})`,
		),
	])
	const byKey = new Map<string, PoolItem>()
	for (const r of [...movies, ...demoMovies]) byKey.set(`movie-${r.tmdb_id}`, toItem("movie", r))
	for (const r of [...shows, ...demoShows]) byKey.set(`show-${r.tmdb_id}`, toItem("show", r))

	const movieIds = [...byKey.values()].filter((i) => i.type === "movie").map((i) => i.id)
	const directors = await query<{ media_tmdb_id: number; name: string }>(
		`SELECT pw.media_tmdb_id, p.name FROM person_worked_on pw JOIN person p ON p.tmdb_id = pw.person_tmdb_id
		 WHERE pw.media_type = 'movie' AND pw.job = 'Director' AND pw.media_tmdb_id IN (${movieIds.join(",")})`,
	)
	for (const d of directors) {
		const item = byKey.get(`movie-${d.media_tmdb_id}`)
		if (item && !item.directors.includes(d.name)) item.directors.push(d.name)
	}

	const seenService = new Set<number>()
	return {
		items: [...byKey.values()],
		services: services
			.filter((s) => !seenService.has(s.tmdb_id) && seenService.add(s.tmdb_id))
			.map((s) => ({ id: s.tmdb_id, name: s.name, logo: `https://www.themoviedb.org/t/p/original${s.logo_path}`, mine: DEMO_SERVICES.includes(s.tmdb_id) }))
			.sort((a, b) => Number(b.mine) - Number(a.mine)),
		keys: [...VALID_FINGERPRINT_KEYS],
	}
}

let poolPromise: Promise<TastePool> | null = null
export const getTastePool = () => {
	poolPromise ??= loadPool().catch((e) => {
		poolPromise = null
		throw e
	})
	return poolPromise
}
