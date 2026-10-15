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
	  }
	| { status: "unmatched"; reason: string }
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
	groups?(showId: number): Promise<EpisodeGroupSummary[]>
	group?(id: string): Promise<EpisodeGroup>
	episodes(showId: number): Promise<CatalogEpisode[]>
	findTvdb?(
		id: number,
	): Promise<{ tv_episode_results: { id: number; show_id: number }[] }>
	cacheTvdb?(showId: number, episodeId: number, tvdbId: number): Promise<void>
}
const unmatched = (reason: string): EpisodeResolution => ({
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
export function createEpisodeResolver(data: EpisodeResolverData) {
	return async (row: EpisodeEvidence): Promise<EpisodeResolution> => {
		const catalog = await data.episodes(row.showId)
		if (catalog.length > 50000)
			return unmatched(
				"The episode catalog is too large to establish a unique match.",
			)
		const episodes = catalog.filter((e) => Number(e.show_id) === row.showId)
		if (row.episodeTmdbId != null) {
			if (!Number.isSafeInteger(row.episodeTmdbId) || row.episodeTmdbId <= 0)
				return unmatched("Invalid TMDB episode ID.")
			const candidates = episodes.filter(
				(e) => Number(e.tmdb_id) === row.episodeTmdbId,
			)
			return candidates.length === 1
				? matched(candidates[0])
				: unmatched("TMDB episode ID did not match uniquely within this show.")
		}
		if (row.episodeTvdbId != null) {
			if (!Number.isSafeInteger(row.episodeTvdbId) || row.episodeTvdbId <= 0)
				return unmatched("Invalid TVDB episode ID.")
			const cached = episodes.filter(
				(e) => e.tvdb_id != null && Number(e.tvdb_id) === row.episodeTvdbId,
			)
			if (cached.length)
				return cached.length === 1
					? matched(cached[0])
					: unmatched("TVDB episode ID is ambiguous within this show.")
			let result:
				| { tv_episode_results: { id: number; show_id: number }[] }
				| undefined
			try {
				result = await data.findTvdb?.(row.episodeTvdbId)
			} catch {
				return unmatched(
					"TMDB's TVDB lookup is unavailable; retry this import later.",
				)
			}
			const hits = result?.tv_episode_results ?? []
			if (hits.length !== 1 || hits[0].show_id !== row.showId)
				return unmatched(
					"TVDB episode ID did not match uniquely within this show.",
				)
			const candidates = episodes.filter(
				(e) => Number(e.tmdb_id) === hits[0].id,
			)
			if (candidates.length !== 1)
				return unmatched(
					"The TVDB episode is missing or ambiguous in this show's current catalog.",
				)
			const episode = candidates[0]
			if (
				episode.tvdb_id != null &&
				Number(episode.tvdb_id) !== row.episodeTvdbId
			)
				return unmatched(
					"The TVDB episode ID conflicts with the cached catalog identity.",
				)
			await data.cacheTvdb?.(
				row.showId,
				Number(episode.tmdb_id),
				row.episodeTvdbId,
			)
			episode.tvdb_id = row.episodeTvdbId
			return matched(episode)
		}
		if (row.episodeGroup) {
			const hint = row.episodeGroup
			let groups: EpisodeGroupSummary[]
			try {
				groups = (await data.groups?.(row.showId)) ?? []
			} catch {
				return unmatched(
					"TMDB episode groups are unavailable; retry this import later.",
				)
			}
			const eligible = groups.filter((g) =>
				hint.id
					? g.id === hint.id
					: (g.type === 4 && g.network?.name === "Netflix") ||
						(/part|volume/i.test(g.name) && hint.groupCount === g.group_count),
			)
			const candidates: CatalogEpisode[] = []
			try {
				for (const summary of eligible) {
					const group = await data.group?.(summary.id)
					if (
						!group ||
						group.id !== summary.id ||
						group.group_count !== summary.group_count ||
						!completeGroup(group, episodes)
					)
						continue
					const label = hint.label.trim().toLowerCase()
					const part = group.groups.filter(
						(g) => g.name.trim().toLowerCase() === label,
					)
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
										e.name?.trim().toLowerCase() ===
											row.episodeName.trim().toLowerCase())),
						),
					)
				}
			} catch {
				return unmatched(
					"TMDB episode groups are unavailable; retry this import later.",
				)
			}
			return candidates.length === 1
				? matched(candidates[0])
				: unmatched("Episode group did not match uniquely within this show.")
		}
		if (row.episode == null && row.episodeName?.trim()) {
			const candidates = episodes.filter(
				(e) =>
					e.name?.trim().toLowerCase() ===
						row.episodeName?.trim().toLowerCase() &&
					(row.season == null ||
						(row.numbering === "tmdb" &&
							Number(e.season_number) === row.season)),
			)
			return candidates.length === 1
				? matched(candidates[0])
				: unmatched("Episode name did not match uniquely within this show.")
		}
		if (row.numbering !== "tmdb")
			return unmatched(
				"This source does not use TMDB episode numbering; an episode ID or group is needed.",
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
