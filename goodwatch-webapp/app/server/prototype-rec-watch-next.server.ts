// PROTOTYPE - throwaway. Read-only catalog for /prototype/rec-watch-next (issue #176).
// Loads a pool of popular, well-rated titles with their subscription offers in one country
// and, for shows, the episode list so "Up next" can name the next episode.
import { getUserSettings } from "~/server/user-settings.server"
import type { Offer, Title } from "~/ui/prototype-rec-watch-next/model"
import { getUserIdFromRequest } from "~/utils/auth"
import { query } from "~/utils/crate"
import { duplicateProviderMapping, getShorterProviderLabel, ignoredProviders } from "~/utils/streaming-links"

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
}

// Demo services for guests and members who never saved any: Netflix, Prime Video, Disney+.
const DEMO_SERVICES = [8, 9, 337]
const SUBSCRIPTION = ["flatrate", "flatrate_and_buy", "free", "ads"]

const brand = (name: string) =>
	getShorterProviderLabel(name)
		.replace(/\s+(Amazon|Apple TV|Roku Premium)\s+Channel$/i, "")
		.replace(/\s+(Standard|Basic)\s+with\s+Ads$/i, "")
		.replace(/\s+with\s+Ads$/i, "")
		.replace(/\s+(Essential|Premium|Basic|Standard)$/i, "")

let poolPromise: Promise<Omit<Title, "offers">[]> | null = null
const loadPool = () => {
	poolPromise ??= Promise.all(
		(["movie", "show"] as const).map(async (type) => {
			const rows = await query<Row>(
				`SELECT tmdb_id, title, release_year, poster_path, backdrop_path, genres, synopsis, tagline,
					goodwatch_overall_score_normalized_percent AS score,
					${type === "movie" ? "runtime" : "episode_runtime[1]"} AS runtime
				 FROM ${type}
				 WHERE poster_path IS NOT NULL AND backdrop_path IS NOT NULL
					AND goodwatch_overall_score_voting_count >= 15000
					AND goodwatch_overall_score_normalized_percent >= 70
					${type === "show" ? "AND number_of_episodes BETWEEN 6 AND 80" : "AND release_year >= 1990"}
				 ORDER BY popularity DESC LIMIT ${type === "movie" ? 26 : 14}`,
			)
			return rows.map((r) => ({
				key: `${type}:${r.tmdb_id}`,
				type,
				id: r.tmdb_id,
				title: r.title,
				year: r.release_year,
				poster: r.poster_path,
				backdrop: r.backdrop_path,
				genres: (r.genres ?? []).slice(0, 3),
				synopsis: r.synopsis ?? "",
				tagline: r.tagline ?? "",
				score: r.score,
				runtime: r.runtime,
				episodes: [] as Title["episodes"],
			}))
		}),
	)
		.then(async ([movies, shows]) => {
			const ids = shows.map((s) => s.id)
			const eps = await query<{ show_id: number; season_number: number; episode_number: number; name: string }>(
				`SELECT show_id, season_number, episode_number, name FROM imdb_episode
				 WHERE show_id IN (${ids.map(() => "?").join(",")}) AND season_number >= 1
				 ORDER BY show_id, season_number, episode_number LIMIT 5000`,
				ids,
			)
			for (const s of shows) s.episodes = eps.filter((e) => e.show_id === s.id).map((e) => ({ s: e.season_number, e: e.episode_number, name: e.name }))
			// Interleave so the grid mixes movies and shows.
			return movies.flatMap((m, i) => [m, shows[i]]).filter(Boolean)
		})
		.catch((e) => {
			poolPromise = null
			throw e
		})
	return poolPromise
}

async function loadOffers(pool: Omit<Title, "offers">[], country: string, owned: number[]) {
	const out = new Map<string, Offer[]>()
	await Promise.all(
		(["movie", "show"] as const).map(async (type) => {
			const ids = pool.filter((t) => t.type === type).map((t) => t.id)
			const rows = await query<{ media_tmdb_id: number; sid: number; name: string; logo: string; ord: number | null }>(
				`SELECT sa.media_tmdb_id, sa.streaming_service_id AS sid, s.name, s.logo_path AS logo, s.order_default AS ord
				 FROM streaming_availability sa
				 JOIN streaming_service s ON s.tmdb_id = sa.streaming_service_id AND s.media_type = sa.media_type
				 WHERE sa.media_type = ? AND sa.country_code = ? AND sa.streaming_type IN ('${SUBSCRIPTION.join("','")}')
					AND sa.media_tmdb_id IN (${ids.map(() => "?").join(",")})
				 LIMIT 5000`,
				[type, country, ...ids],
			)
			for (const r of rows) {
				if (ignoredProviders.includes(r.sid)) continue
				const k = `${type}:${r.media_tmdb_id}`
				const list = out.get(k) ?? []
				const name = brand(r.name)
				if (list.some((o) => o.name === name)) continue
				list.push({ id: r.sid, name, logo: `https://www.themoviedb.org/t/p/original${r.logo}`, owned: owned.includes(r.sid), order: r.ord ?? 999 })
				out.set(k, list)
			}
		}),
	)
	for (const list of out.values()) list.sort((a, b) => Number(b.owned) - Number(a.owned) || a.order - b.order)
	return out
}

export async function getCatalog(request: Request) {
	const userId = await getUserIdFromRequest({ request }).catch(() => undefined)
	const settings = userId ? await getUserSettings({ userId }).catch(() => ({})) : {}
	const country = new URL(request.url).searchParams.get("country") ?? (settings as { country_default?: string }).country_default ?? "DE"
	const saved = String((settings as { streaming_providers_default?: string }).streaming_providers_default ?? "")
		.split(",")
		.map(Number)
		.filter(Boolean)
	const base = saved.length ? saved : DEMO_SERVICES
	const owned = base.flatMap((id) => (id in duplicateProviderMapping ? [id, ...duplicateProviderMapping[id]] : [id]))
	const pool = await loadPool()
	const offers = await loadOffers(pool, country, owned)
	const titles: Title[] = pool.map((t) => ({ ...t, offers: offers.get(t.key) ?? [] }))
	return { titles, country, demoServices: !saved.length }
}
