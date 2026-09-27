// PROTOTYPE - throwaway. Read-only catalog for /prototype/rec-filter-bar (issue #175).
// Loads popular movies and shows with their subscription offers in one country.
// Filtering happens in the browser on this fixed set; the look of the bar is what's being judged.
import { getUserSettings } from "~/server/user-settings.server"
import { getUserIdFromRequest } from "~/utils/auth"
import { query } from "~/utils/crate"
import { duplicateProviderMapping, getShorterProviderLabel, ignoredProviders } from "~/utils/streaming-links"

// Demo services for guests and members who never saved any: Netflix, Prime Video, Disney+.
const DEMO_SERVICES = [8, 9, 337]
const SUBSCRIPTION = ["flatrate", "flatrate_and_buy", "free", "ads"]
const PER_TYPE = 42

export type ProtoOffer = { id: number; name: string; logo: string }
export type ProtoTitle = {
	key: string
	tmdb_id: number
	media_type: "movie" | "show"
	title: string
	release_year: string
	release_date: string
	poster_path: string
	backdrop_path: string
	popularity: number
	genres: string[]
	offers: ProtoOffer[]
	goodwatch_overall_score_normalized_percent: number | null
	goodwatch_overall_score_voting_count: number | null
}

type Row = Omit<ProtoTitle, "key" | "media_type" | "offers" | "genres"> & { genres: string[] | null }

const brand = (name: string) =>
	getShorterProviderLabel(name)
		.replace(/\s+(Amazon|Apple TV|Roku Premium)\s+Channel$/i, "")
		.replace(/\s+(Standard|Basic)\s+with\s+Ads$/i, "")
		.replace(/\s+with\s+Ads$/i, "")
		.replace(/\s+(Essential|Premium|Basic|Standard)$/i, "")

async function loadType(type: "movie" | "show", country: string): Promise<ProtoTitle[]> {
	const releaseField = type === "movie" ? "release_date" : "first_air_date"
	const rows = await query<Row>(
		`SELECT tmdb_id, title, release_year, ${releaseField} AS release_date, poster_path, backdrop_path,
			popularity, genres, goodwatch_overall_score_normalized_percent, goodwatch_overall_score_voting_count
		 FROM ${type}
		 WHERE poster_path IS NOT NULL AND backdrop_path IS NOT NULL
			AND goodwatch_overall_score_voting_count >= 5000
		 ORDER BY popularity DESC LIMIT ${PER_TYPE}`,
	)
	const ids = rows.map((r) => r.tmdb_id)
	const offers = await query<{ media_tmdb_id: number; sid: number; name: string; logo: string; ord: number | null }>(
		`SELECT sa.media_tmdb_id, sa.streaming_service_id AS sid, s.name, s.logo_path AS logo, s.order_default AS ord
		 FROM streaming_availability sa
		 JOIN streaming_service s ON s.tmdb_id = sa.streaming_service_id AND s.media_type = sa.media_type
		 WHERE sa.media_type = ? AND sa.country_code = ? AND sa.streaming_type IN ('${SUBSCRIPTION.join("','")}')
			AND sa.media_tmdb_id IN (${ids.map(() => "?").join(",")})
		 ORDER BY s.order_default
		 LIMIT 5000`,
		[type, country, ...ids],
	)
	const byId = new Map<number, ProtoOffer[]>()
	for (const o of offers) {
		if (ignoredProviders.includes(o.sid)) continue
		const list = byId.get(o.media_tmdb_id) ?? []
		const name = brand(o.name)
		if (list.some((x) => x.name === name)) continue
		list.push({ id: o.sid, name, logo: o.logo })
		byId.set(o.media_tmdb_id, list)
	}
	return rows.map((r) => ({
		...r,
		key: `${type}:${r.tmdb_id}`,
		media_type: type,
		genres: r.genres ?? [],
		offers: byId.get(r.tmdb_id) ?? [],
	}))
}

const cache = new Map<string, Promise<ProtoTitle[]>>()
const loadCatalog = (country: string) => {
	let p = cache.get(country)
	if (!p) {
		p = Promise.all([loadType("movie", country), loadType("show", country)])
			// Interleave so "all" mixes both.
			.then(([movies, shows]) => movies.flatMap((m, i) => [m, shows[i]]).filter(Boolean))
			.catch((e) => {
				cache.delete(country)
				throw e
			})
		cache.set(country, p)
	}
	return p
}

export async function getCatalog(request: Request) {
	const userId = await getUserIdFromRequest({ request }).catch(() => undefined)
	const settings = userId ? await getUserSettings({ userId }).catch(() => ({})) : {}
	const country =
		new URL(request.url).searchParams.get("country") ?? (settings as { country_default?: string }).country_default ?? "DE"
	const saved = String((settings as { streaming_providers_default?: string }).streaming_providers_default ?? "")
		.split(",")
		.map(Number)
		.filter(Boolean)
	const base = saved.length ? saved : DEMO_SERVICES
	const mine = base.flatMap((id) => (id in duplicateProviderMapping ? [id, ...duplicateProviderMapping[id]] : [id]))
	const titles = await loadCatalog(country)
	return { titles, country, mine, demoServices: !saved.length }
}
