// The numbers of a profile's Taste tab: genres, people, eras, world, tags, facts, rating style and badges, from the
// member's own data and the catalog (taste-stats-model.ts does the counting).
//
// Reads, on a cold cache: the member's data (getUserData, cached 5 minutes); the titles' details in primary-key batches
// of BATCH per media type; their credits aggregated by person and role;
// the names of the people that make a list. Tropes are read only for titles scored 8 or more, the only ones the tags
// count. At most MAX_TITLES titles, the latest first. Fresh for 10 minutes, retained stale for 7 days.
//
// Cost guards: concurrent requests for one member share one computation, and the catalog reads of every computation in
// this process go through one queue of QUERY_CONCURRENCY, so crawlers walking many profiles can't flood Crate.
import { staleValues } from "./stale-value"
import type { ProfileTitle } from "~/domain/profile"
import type { TasteStats } from "~/domain/profile-taste"
import { getUserData } from "~/server/userData.server"
import type { MediaKey } from "~/types/user-data"
import { titlePath } from "~/utils/helpers"
import { timeRequestCache, timeRequestWork } from "~/utils/request-work"
import { readProfileCatalog as read } from "./catalog.server"
import {
	readCachedTasteStats,
	writeCachedTasteStats,
} from "./taste-stats-cache.server"
import {
	type Kind,
	type StatsCredit,
	type StatsPerson,
	type StatsTitle,
	tasteStats,
} from "./taste-stats-model"

const BATCH = 4_000
const MAX_TITLES = 4_000
/** Top-billed cast: billing order below this. */
const CAST_ORDER = 8
const WRITER_JOBS = ["Screenplay", "Writer"]
const COMPOSER_JOBS = ["Original Music Composer"]

const computing = staleValues<TasteStats>()

/** The owner's numbers, all of them: cut them with statsForViewer (taste-stats-view.ts) before they reach a page. */
export async function getTasteStats(
	ownerId: string,
	request?: Request,
): Promise<TasteStats> {
	const cached = await timeRequestCache(request, "stats", () =>
		readCachedTasteStats(ownerId),
	)
	return computing.read(ownerId, cached, () =>
		buildTasteStats(ownerId, cached ? undefined : request),
	)
}

async function buildTasteStats(ownerId: string, request?: Request) {
	const readFrom = Date.now()
	const stats = await computeTasteStats(ownerId, request)
	await writeCachedTasteStats(ownerId, stats, readFrom)
	return stats
}

/** Called after rating writes have settled, so the next visitor can use an already refreshed entry. */
export async function refreshTasteStats(ownerId: string) {
	if (!(await readCachedTasteStats(ownerId))) return
	return computing.refreshAfterPending(ownerId, () => buildTasteStats(ownerId))
}

interface Own {
	key: MediaKey
	mediaType: "movie" | "show"
	tmdbId: number
	score: number | null
	date: Date | null
	episodesWatched: number
}

async function computeTasteStats(
	ownerId: string,
	request?: Request,
): Promise<TasteStats> {
	const startedAt = Date.now()
	const data = await getUserData({ user_id: ownerId })
	const own = new Map<MediaKey, Own>()
	const add = (key: MediaKey, patch: Partial<Own>) => {
		const [mediaType, id] = key.split("-")
		const entry = own.get(key) ?? {
			key,
			mediaType: mediaType as Own["mediaType"],
			tmdbId: Number(id),
			score: null,
			date: null,
			episodesWatched: 0,
		}
		own.set(key, { ...entry, ...patch })
	}
	for (const [key, entry] of Object.entries(data.scores) as [
		MediaKey,
		(typeof data.scores)[MediaKey],
	][])
		if (entry.score)
			add(key, {
				score: Number(entry.score),
				date: entry.updatedAt ? new Date(entry.updatedAt) : null,
			})
	let watching = 0
	for (const [key, entry] of Object.entries(data.watchState) as [
		MediaKey,
		(typeof data.watchState)[MediaKey],
	][]) {
		if (entry.state === "watching" && key.startsWith("show-")) watching++
		const known = own.get(key)
		add(key, {
			date: entry.watchedAt ? new Date(entry.watchedAt) : (known?.date ?? null),
			episodesWatched: entry.episodesWatched ?? 0,
		})
	}
	const titles = [...own.values()]
		.sort((a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0))
		.slice(0, MAX_TITLES)
	const ids = {
		movie: titles.filter((t) => t.mediaType === "movie").map((t) => t.tmdbId),
		show: titles.filter((t) => t.mediaType === "show").map((t) => t.tmdbId),
	}
	const loved = new Set(
		titles.filter((t) => (t.score ?? 0) >= 8).map((t) => t.key),
	)
	const [movieRows, showRows, credits, tropeCounts] = await Promise.all([
		readDetails("movie", ids.movie, request),
		readDetails("show", ids.show, request),
		timeRequestWork(request, "stats_credits", () =>
			readCredits({
				movie: titles
					.filter((t) => t.mediaType === "movie" && t.score !== null)
					.map((t) => t.tmdbId),
				show: titles
					.filter((t) => t.mediaType === "show" && t.score !== null)
					.map((t) => t.tmdbId),
			}),
		),
		timeRequestWork(request, "stats_tropes", () => readTropes(ids, loved)),
	])
	const details = new Map([...movieRows, ...showRows])
	const stats: StatsTitle[] = []
	for (const t of titles) {
		const row = details.get(t.key)
		if (!row) continue
		const title: ProfileTitle = {
			key: t.key,
			mediaType: t.mediaType,
			tmdbId: t.tmdbId,
			title: row.title ?? "",
			year: row.release_year ?? null,
			poster: row.poster_path ?? null,
			backdrop: row.backdrop_path ?? null,
			href: titlePath(t.mediaType, t.tmdbId, row.title ?? ""),
			score: t.score,
			gw: row.gw == null ? null : Math.round(Number(row.gw)),
			date: t.date ? t.date.toISOString() : null,
		}
		const kind: Kind = row.is_anime ? "anime" : t.mediaType
		stats.push({
			title,
			kind,
			score: t.score,
			genres: row.genres ?? [],
			runtime: row.runtime ?? null,
			budget: row.budget ?? null,
			revenue: row.revenue ?? null,
			countries: row.production_country_codes ?? [],
			language: row.original_language_code ?? null,
			essence: row.essence_tags ?? [],
			tropes: row.tropes ?? [],
			episodesWatched: t.episodesWatched,
		})
	}
	const people = await timeRequestWork(request, "stats_people", () =>
		readPeople(credits, stats),
	)
	const result = tasteStats({
		titles: stats,
		credits,
		people,
		watching,
		year: new Date().getFullYear(),
		tropeCounts,
	})
	console.info(
		`Taste stats for ${ownerId.slice(0, 8)}: ${stats.length} titles, ${credits.length} credits, in ${Date.now() - startedAt} ms`,
	)
	return result
}

interface DetailRow {
	tmdb_id: number
	title: string | null
	release_year: number | null
	poster_path: string | null
	backdrop_path: string | null
	genres: string[] | null
	is_anime: boolean | null
	runtime: number | null
	budget: number | null
	revenue: number | null
	production_country_codes: string[] | null
	original_language_code: string | null
	essence_tags: string[] | null
	tropes?: string[] | null
	gw: number | null
}

const batches = (ids: number[]) => {
	const out: number[][] = []
	for (let i = 0; i < ids.length; i += BATCH) out.push(ids.slice(i, i + BATCH))
	return out
}
const placeholders = (n: number) =>
	Array.from({ length: n }, () => "?").join(",")

async function readDetails(
	mediaType: "movie" | "show",
	ids: number[],
	request?: Request,
) {
	const found = new Map<MediaKey, DetailRow>()
	// A show's runtime is its usual episode runtime: the first of episode_runtime.
	const runtime =
		mediaType === "movie" ? "runtime" : "episode_runtime[1] AS runtime"
	const money =
		mediaType === "movie"
			? "budget, revenue"
			: "NULL AS budget, NULL AS revenue"
	await timeRequestWork(request, "stats_details", () =>
		Promise.all(
			batches(ids).map(async (batch) => {
				const rows = await read<DetailRow>(
					`SELECT tmdb_id, title, release_year, poster_path, backdrop_path, genres, is_anime, ${runtime}, ${money},
					  production_country_codes, original_language_code, essence_tags,
					  goodwatch_overall_score_normalized_percent AS gw
					 FROM ${mediaType} WHERE tmdb_id IN (${placeholders(batch.length)}) LIMIT ${batch.length}`,
					batch,
				)
				for (const row of rows)
					found.set(`${mediaType}-${Number(row.tmdb_id)}` as MediaKey, row)
			}),
		),
	)

	return found
}

/** Aggregate on the catalog node instead of transferring every title's full trope array. */
async function readTropes(
	ids: { movie: number[]; show: number[] },
	loved: ReadonlySet<MediaKey>,
) {
	const counts = new Map<string, number>()
	await Promise.all(
		(["movie", "show"] as const).map(async (mediaType) => {
			const selected = ids[mediaType].filter((id) =>
				loved.has(`${mediaType}-${id}` as MediaKey),
			)
			if (!selected.length) return
			const rows = await read<{ name: string; count: number }>(
				`SELECT name, count(*) AS count FROM
			 (SELECT unnest(array_unique(tropes)) AS name FROM ${mediaType}
			 WHERE tmdb_id IN (${placeholders(selected.length)})) tags
			 GROUP BY name LIMIT 100000`,
				selected,
			)
			// Do not publish silently truncated counts if the catalog ever outgrows this guard.
			if (rows.length === 100000)
				throw new Error("Stats trope vocabulary exceeds its read limit")
			for (const row of rows)
				if (row.name !== null)
					counts.set(row.name, (counts.get(row.name) ?? 0) + Number(row.count))
		}),
	)
	return counts
}

async function readCredits(ids: { movie: number[]; show: number[] }): Promise<
	StatsCredit[]
> {
	const groups = await Promise.all(
		(["movie", "show"] as const).flatMap((mediaType) => {
			const selected = ids[mediaType]
			if (!selected.length) return []
			const cast = read<{ pid: number; mids: number[] }>(
				`SELECT person_tmdb_id AS pid, collect_set(media_tmdb_id) AS mids
			 FROM person_appeared_in WHERE media_type = ?
			 AND media_tmdb_id IN (${placeholders(selected.length)})
			 AND order_default >= 0 AND order_default < ${CAST_ORDER}
			 GROUP BY person_tmdb_id LIMIT ${selected.length * CAST_ORDER}`,
				[mediaType, ...selected],
			).then((rows) =>
				rows.flatMap((row) =>
					row.mids.map((mid) => ({
						personId: Number(row.pid),
						key: `${mediaType}-${Number(mid)}`,
						role: "actor" as const,
					})),
				),
			)
			if (mediaType === "show") return [cast]
			const crew = read<{
				pid: number
				role: StatsCredit["role"]
				mids: number[]
			}>(
				`SELECT person_tmdb_id AS pid,
			 CASE WHEN job = 'Director' THEN 'director' WHEN job IN ('Screenplay', 'Writer') THEN 'writer' ELSE 'composer' END AS role,
			 collect_set(media_tmdb_id) AS mids FROM person_worked_on
			 WHERE media_type = 'movie' AND media_tmdb_id IN (${placeholders(selected.length)})
			 AND job IN ('Director', ${[...WRITER_JOBS, ...COMPOSER_JOBS].map(() => "?").join(",")})
			 GROUP BY 1,2 LIMIT 100000`,
				[...selected, ...WRITER_JOBS, ...COMPOSER_JOBS],
			).then((rows) => {
				if (rows.length === 100000)
					throw new Error("Stats crew exceeds its read limit")
				return rows.flatMap((row) =>
					row.mids.map((mid) => ({
						personId: Number(row.pid),
						key: `movie-${Number(mid)}`,
						role: row.role,
					})),
				)
			})
			return [cast, crew]
		}),
	)
	return groups.flat()
}

/** Names and photos of the people with at least two rated titles in a role: the only ones a list can show. */
async function readPeople(
	credits: StatsCredit[],
	titles: StatsTitle[],
): Promise<Map<number, StatsPerson>> {
	const rated = new Set(
		titles.filter((t) => t.score !== null).map((t) => t.title.key),
	)
	const counts = new Map<string, number>()
	for (const c of credits)
		if (rated.has(c.key))
			counts.set(
				`${c.role}:${c.personId}`,
				(counts.get(`${c.role}:${c.personId}`) ?? 0) + 1,
			)
	const ids = [
		...new Set(
			[...counts.entries()]
				.filter(([, n]) => n >= 2)
				.map(([id]) => Number(id.split(":")[1])),
		),
	]
	const people = new Map<number, StatsPerson>()
	for (const batch of batches(ids)) {
		const rows = await read<{
			tmdb_id: number
			name: string
			profile_path: string | null
		}>(
			`SELECT tmdb_id, name, profile_path FROM person WHERE tmdb_id IN (${placeholders(batch.length)}) LIMIT ${batch.length}`,
			batch,
		)
		for (const row of rows)
			people.set(Number(row.tmdb_id), {
				id: Number(row.tmdb_id),
				name: row.name,
				profile: row.profile_path ?? null,
			})
	}
	return people
}
