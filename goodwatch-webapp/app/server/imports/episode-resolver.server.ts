import type {
	AnimeEntry,
	AnimeScorePlacement,
} from "../../domain/anime-mapping.ts"
import {
	type AnimeMappings,
	resolveAnimeParent,
} from "./anime-mapping-data.server.ts"
import {
	TvdbLookupBudgetExceeded,
	TvdbLookupUnavailable,
	tvdbLookupProblem,
} from "./tvdb-lookup.server.ts"
export const EPISODE_CATALOG_LIMIT = 50_000
const DIGITAL_EPISODE_GROUP = 4
const normalize = (value: string | null | undefined) =>
	value?.trim().toLowerCase() ?? ""

/** Canonical import identities; never changes the presentation or stored catalog numbering. */
export interface CatalogEpisode {
	tmdb_id: number
	show_id: number
	season_number: number
	episode_number: number
	name: string | null
	tvdb_id: number | null
}
export interface EpisodeEvidence {
	showId: number
	animeEntry?: AnimeEntry
	numbering?: "tmdb" | "unknown"
	episodeGroup?: { id?: string; label: string; groupCount?: number }
	episodeTvdbId?: number | null
	episodeName?: string | null
	episodeTmdbId?: number | null
	season?: number | null
	episode?: number | null
}
export type EpisodeResolution =
	| {
			status: "matched"
			episodeTmdbId: number
			season: number
			episode: number
			special: boolean
			/** Entry date spans do not establish episode dates; a complete single-day entry does. */
			datePolicy?: "unknown" | "day"
			watchedAt?: string
	  }
	| { status: "unmatched"; reason: string; code?: string }
export interface EpisodeGroupSummary {
	id: string
	name: string
	type: number
	network: { name: string } | null
	group_count: number
}
export interface EpisodeGroup {
	id: string
	episode_count: number
	group_count: number
	groups: {
		name: string
		order: number
		episodes: { id: number; order: number }[]
	}[]
}
export interface EpisodeResolverData {
	animeMappings: AnimeMappings
	groups(showId: number): Promise<EpisodeGroupSummary[]>
	group(id: string): Promise<EpisodeGroup>
	episodes(showId: number): Promise<CatalogEpisode[]>
	findTvdb(
		id: number,
	): Promise<{ tv_episode_results: { id: number; show_id: number }[] }>
	cacheTvdb(
		showId: number,
		episodeId: number,
		tvdbId: number,
		expectedTvdbId: number | null,
	): Promise<boolean>
}
const unmatched = (
	reason: string,
): { status: "unmatched"; reason: string } => ({
	status: "unmatched",
	reason,
})
const matched = (episode: CatalogEpisode): EpisodeResolution => ({
	status: "matched",
	episodeTmdbId: Number(episode.tmdb_id),
	season: Number(episode.season_number),
	episode: Number(episode.episode_number),
	special: Number(episode.season_number) === 0,
})
function resolveTmdb(
	episodeTmdbId: number,
	episodes: CatalogEpisode[],
): EpisodeResolution {
	if (!Number.isSafeInteger(episodeTmdbId) || episodeTmdbId <= 0)
		return unmatched("Invalid TMDB episode ID.")
	const candidates = episodes.filter((e) => Number(e.tmdb_id) === episodeTmdbId)
	return candidates.length === 1
		? matched(candidates[0])
		: unmatched("TMDB episode ID did not match uniquely within this show.")
}

async function resolveTvdb(
	showId: number,
	episodeTvdbId: number,
	episodes: CatalogEpisode[],
	data: EpisodeResolverData,
): Promise<EpisodeResolution> {
	if (!Number.isSafeInteger(episodeTvdbId) || episodeTvdbId <= 0)
		return unmatched("Invalid TVDB episode ID.")
	const cached = episodes.filter(
		(e) => e.tvdb_id != null && Number(e.tvdb_id) === episodeTvdbId,
	)

	let result: Awaited<ReturnType<EpisodeResolverData["findTvdb"]>>
	try {
		result = await data.findTvdb(episodeTvdbId)
	} catch (error) {
		if (cached.length === 1) return matched(cached[0])
		if (cached.length > 1)
			return unmatched("TVDB episode ID is ambiguous within this show.")
		if (
			error instanceof TvdbLookupBudgetExceeded ||
			error instanceof TvdbLookupUnavailable
		) {
			const problem = tvdbLookupProblem(error)
			return {
				status: "unmatched",
				reason: problem.reason,
				code: problem.code,
			}
		}
		return unmatched(
			"TMDB's TVDB lookup is unavailable; retry this import later.",
		)
	}
	const hits = result.tv_episode_results
	if (hits.length !== 1 || hits[0].show_id !== showId)
		return {
			...unmatched("TVDB episode ID did not match uniquely within this show."),
			code:
				hits.length === 0
					? "episode_tvdb_not_found"
					: hits.length > 1
						? "episode_tvdb_ambiguous"
						: "episode_tvdb_parent_mismatch",
		}
	const candidates = episodes.filter((e) => Number(e.tmdb_id) === hits[0].id)
	if (candidates.length !== 1)
		return {
			...unmatched(
				"The TVDB episode is missing or ambiguous in this show's current catalog.",
			),
			code: "episode_tvdb_catalog_missing",
		}
	const episode = candidates[0]

	try {
		const written = await data.cacheTvdb(
			showId,
			Number(episode.tmdb_id),
			episodeTvdbId,
			episode.tvdb_id,
		)
		if (written) {
			for (const old of cached) old.tvdb_id = null
			episode.tvdb_id = episodeTvdbId
		}
	} catch (error) {
		console.error("Could not cache import episode TVDB identity")
	}
	return matched(episode)
}

async function resolveGroup(
	row: EpisodeEvidence,
	hint: NonNullable<EpisodeEvidence["episodeGroup"]>,
	episodes: CatalogEpisode[],
	data: EpisodeResolverData,
): Promise<EpisodeResolution> {
	let groups: EpisodeGroupSummary[]
	try {
		groups = await data.groups(row.showId)
	} catch {
		return unmatched(
			"TMDB episode groups are unavailable; retry this import later.",
		)
	}
	const eligible = groups.filter((g) =>
		hint.id
			? g.id === hint.id
			: (g.type === DIGITAL_EPISODE_GROUP && g.network?.name === "Netflix") ||
				(/part|volume/i.test(g.name) && hint.groupCount === g.group_count),
	)
	const candidates: CatalogEpisode[] = []
	try {
		for (const summary of eligible) {
			const group = await data.group(summary.id)
			if (
				!group ||
				group.id !== summary.id ||
				group.group_count !== summary.group_count ||
				!completeGroup(group, episodes)
			)
				continue
			const label = normalize(hint.label)
			const part = group.groups.filter((g) => normalize(g.name) === label)
			if (part.length !== 1) continue
			const ids = part[0].episodes
				.filter((e) => row.episode == null || e.order === row.episode - 1)
				.map((e) => e.id)
			candidates.push(
				...episodes.filter(
					(e) =>
						ids.includes(Number(e.tmdb_id)) &&
						(row.episode != null ||
							(row.episodeName?.trim() &&
								normalize(e.name) === normalize(row.episodeName))),
				),
			)
		}
	} catch {
		return unmatched(
			"TMDB episode groups are unavailable; retry this import later.",
		)
	}
	const unique = [
		...new Map(
			candidates.map((episode) => [Number(episode.tmdb_id), episode]),
		).values(),
	]
	return unique.length === 1
		? matched(unique[0])
		: unmatched("Episode group did not match uniquely within this show.")
}

// Episode placement courtesy of Anime-Lists (https://github.com/Anime-Lists/anime-lists).
type AnimePlacement = { status: "unmatched"; reason: string } | CatalogEpisode[]
async function resolveAnime(
	row: EpisodeEvidence,
	entry: AnimeEntry,
	episodes: CatalogEpisode[],
	data: EpisodeResolverData,
	cache: Map<string, Promise<AnimePlacement>>,
): Promise<EpisodeResolution> {
	if (entry.completed && entry.episodeCount == null)
		return unmatched(
			"A completed anime entry needs its episode total to validate the whole cour.",
		)
	const positive = (n: number | null | undefined): n is number =>
		Number.isSafeInteger(n) && Number(n) > 0
	if (
		!positive(entry.id) ||
		!positive(row.episode) ||
		(entry.progress != null &&
			(!positive(entry.progress) || row.episode > entry.progress)) ||
		(entry.episodeCount != null &&
			(!positive(entry.episodeCount) ||
				row.episode > entry.episodeCount ||
				(entry.progress ?? 0) > entry.episodeCount))
	)
		return unmatched("Invalid anime entry episode or progress.")
	const extent = Math.max(
		row.episode,
		entry.progress ?? 0,
		entry.episodeCount ?? 0,
	)
	if (extent > EPISODE_CATALOG_LIMIT)
		return unmatched("Anime progress exceeds the supported episode limit.")
	const key = JSON.stringify([row.showId, entry.source, entry.id, extent])
	let pending = cache.get(key)
	if (!pending) {
		pending = mapAnimeProgress(row.showId, entry, extent, episodes, data)
		cache.set(key, pending)
	}
	const result = await pending
	return Array.isArray(result) ? matched(result[row.episode - 1]) : result
}

async function mapAnimeProgress(
	showId: number,
	entry: AnimeEntry,
	extent: number,
	episodes: CatalogEpisode[],
	data: EpisodeResolverData,
): Promise<AnimePlacement> {
	const parent = await resolveAnimeParent(entry, data.animeMappings, showId)
	if (parent.status === "unmatched") return parent
	const mapping = parent.mapping
	if (mapping.unsupportedReason) return unmatched(mapping.unsupportedReason)
	// Only a catalog with globally unique regular numbers can establish absolute order.
	const regular = episodes.filter((e) => Number(e.season_number) > 0)
	const absolute =
		mapping.season === "a" &&
		new Set(regular.map((e) => Number(e.episode_number))).size ===
			regular.length
	const byCoordinate = new Map<string, CatalogEpisode[]>()
	const byAbsolute = new Map<number, CatalogEpisode[]>()
	for (const e of episodes) {
		const key = `${e.season_number}:${e.episode_number}`
		byCoordinate.set(key, [...(byCoordinate.get(key) ?? []), e])
		if (Number(e.season_number) > 0)
			byAbsolute.set(Number(e.episode_number), [
				...(byAbsolute.get(Number(e.episode_number)) ?? []),
				e,
			])
	}
	const selected: CatalogEpisode[] = []
	for (let n = 1; n <= extent; n++) {
		const ranges = mapping.ranges.filter((r) => n >= r.start && n <= r.end)
		if (ranges.length > 1)
			return unmatched("This anime mapping has overlapping TMDB ranges.")
		const range = ranges[0]
		const targetSeason = range?.season ?? mapping.season
		const targetNumber =
			n + (absolute ? mapping.offset : (range?.offset ?? mapping.offset))
		const candidates = absolute
			? (byAbsolute.get(targetNumber) ?? []).filter(
					(e) => !range || Number(e.season_number) === range.season,
				)
			: (byCoordinate.get(`${targetSeason}:${targetNumber}`) ?? [])
		if (candidates.length !== 1)
			return unmatched(
				"This anime mapping does not fit the current TMDB episode catalog.",
			)
		selected.push(candidates[0])
	}
	if (new Set(selected.map((e) => Number(e.tmdb_id))).size !== selected.length)
		return unmatched(
			"This anime mapping assigns several source episodes to the same TMDB episode.",
		)
	return selected
}

export function createEpisodeResolver(data: EpisodeResolverData) {
	const animeCache = new Map<string, Promise<AnimePlacement>>()
	const resolve = async (row: EpisodeEvidence): Promise<EpisodeResolution> => {
		const catalog = await data.episodes(row.showId)
		if (catalog.length > EPISODE_CATALOG_LIMIT)
			return unmatched(
				"The episode catalog is too large to establish a unique match.",
			)
		const episodes = catalog.filter((e) => Number(e.show_id) === row.showId)
		let failure: Extract<EpisodeResolution, { status: "unmatched" }> | undefined
		if (row.episodeTmdbId != null) {
			const result = resolveTmdb(row.episodeTmdbId, episodes)
			if (result.status === "matched") return result
			failure = result
		}
		if (row.episodeTvdbId != null) {
			const result = await resolveTvdb(
				row.showId,
				row.episodeTvdbId,
				episodes,
				data,
			)
			if (result.status === "matched") return result
			failure = result
		}
		if (row.animeEntry)
			return resolveAnime(row, row.animeEntry, episodes, data, animeCache)
		if (row.episodeGroup) {
			const result = await resolveGroup(row, row.episodeGroup, episodes, data)
			if (result.status === "matched") return result
			failure = result
		}
		if (row.episode == null && row.episodeName?.trim()) {
			const candidates = episodes.filter(
				(e) =>
					normalize(e.name) === normalize(row.episodeName) &&
					(row.season == null ||
						row.numbering !== "tmdb" ||
						Number(e.season_number) === row.season),
			)
			return candidates.length === 1
				? matched(candidates[0])
				: unmatched("Episode name did not match uniquely within this show.")
		}
		if (row.numbering !== "tmdb" || row.season == null || row.episode == null)
			return (
				failure ??
				unmatched(
					"This source does not use TMDB episode numbering; an episode ID or group is needed.",
				)
			)
		const candidates = episodes.filter(
			(e) =>
				Number(e.season_number) === row.season &&
				Number(e.episode_number) === row.episode,
		)
		return candidates.length === 1
			? matched(candidates[0])
			: unmatched("Season and episode did not match uniquely within this show.")
	}
	const withDates = async (
		row: EpisodeEvidence,
	): Promise<EpisodeResolution> => {
		const result = await resolve(row)
		if (!row.animeEntry || result.status !== "matched") return result
		const entry = row.animeEntry
		const day = entry.startedAt
		if (
			entry.completed &&
			entry.progress &&
			entry.progress === entry.episodeCount &&
			day &&
			day === entry.finishedAt &&
			/^\d{4}-\d{2}-\d{2}$/.test(day) &&
			Number.isFinite(Date.parse(day)) &&
			new Date(day).toISOString().slice(0, 10) === day
		) {
			return { ...result, datePolicy: "day", watchedAt: day }
		}
		return { ...result, datePolicy: "unknown" }
	}
	return Object.assign(withDates, {
		animeEntryPlacement: async (
			entry: AnimeEntry,
		): Promise<AnimeScorePlacement> => {
			const parent = await resolveAnimeParent(entry, data.animeMappings)
			if (parent.status === "unmatched")
				return { ranges: null, reason: parent.reason }
			const mapping = parent.mapping
			const total = entry.episodeCount
			if (
				!total ||
				!Number.isSafeInteger(total) ||
				total < 1 ||
				total > EPISODE_CATALOG_LIMIT
			)
				return {
					mapping,
					ranges: null,
					reason:
						"The entry needs a supported episode total to retain its full season score range.",
				}
			const catalog = await data.episodes(mapping.showId)
			if (catalog.length > EPISODE_CATALOG_LIMIT)
				return {
					mapping,
					ranges: null,
					reason:
						"The episode catalog is too large to establish a unique score range.",
				}
			const key = JSON.stringify([
				mapping.showId,
				entry.source,
				entry.id,
				total,
			])
			let pending = animeCache.get(key)
			if (!pending) {
				pending = mapAnimeProgress(
					mapping.showId,
					entry,
					total,
					catalog.filter((e) => Number(e.show_id) === mapping.showId),
					data,
				)
				animeCache.set(key, pending)
			}
			const result = await pending
			if (!Array.isArray(result))
				return { mapping, ranges: null, reason: result.reason }
			const ranges: NonNullable<AnimeScorePlacement["ranges"]> = []
			for (const episode of result) {
				const last = ranges.at(-1)
				const season = Number(episode.season_number)
				const number = Number(episode.episode_number)
				if (last && last.season === season && last.lastEpisode + 1 === number)
					last.lastEpisode = number
				else ranges.push({ season, firstEpisode: number, lastEpisode: number })
			}
			return { mapping, ranges }
		},
	})
}

// Validate the entire alternative cut, not just the requested part. It may replace
// regular episodes with specials (Money Heist); it must contain complete represented
// regular seasons, unique live identities and dense source positions.
function completeGroup(
	group: EpisodeGroup,
	catalog: CatalogEpisode[],
): boolean {
	const parts = group.groups
	if (!parts.length || parts.length !== group.group_count) return false
	const orders = parts.map((p) => p.order).sort((a, b) => a - b)
	if (![0, 1].includes(orders[0]) || orders.some((n, i) => n !== i + orders[0]))
		return false
	const entries = parts.flatMap((p) => p.episodes)
	if (entries.length !== group.episode_count || !entries.length) return false
	const ids = new Set(entries.map((e) => e.id))
	if (ids.size !== entries.length) return false
	for (const part of parts) {
		const positions = part.episodes.map((e) => e.order).sort((a, b) => a - b)
		if (!positions.length || positions.some((n, i) => n !== i)) return false
	}
	for (const id of ids)
		if (catalog.filter((e) => Number(e.tmdb_id) === id).length !== 1)
			return false
	const seasons = new Set(
		catalog
			.filter((e) => ids.has(Number(e.tmdb_id)))
			.map((e) => Number(e.season_number)),
	)
	const regular = [...seasons].filter((season) => season > 0)
	const firstRequired = seasons.has(0) ? Math.min(...regular) : 1
	if (!regular.length && catalog.some((e) => Number(e.season_number) > 0))
		return false
	return catalog.every(
		(e) =>
			Number(e.season_number) < firstRequired || ids.has(Number(e.tmdb_id)),
	)
}
