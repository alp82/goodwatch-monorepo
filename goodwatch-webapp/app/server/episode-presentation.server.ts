import { applyCorrections } from "./feedback/apply-corrections.server"
import { episodeMapping } from "~/domain/tracking/episode-mappings.server"
import {
	buildEpisodePresentation,
	type EpisodePresentation,
	type ImdbEpisodeRating,
} from "~/domain/tracking/episode-presentation"
import { alignEpisodes } from "~/domain/tracking/episode-alignment"
import type { CanonicalGridEpisode } from "~/domain/tracking/episode-grid-identity"
import { borrowedLayout, generatedPresentation } from "~/domain/tracking/episode-structure"
import { getSourceEpisodeList } from "~/server/tracking.server"
import { cached } from "~/utils/cache"
import { query } from "~/utils/crate"

class RatingsUnavailable extends Error {
	readonly presentation: EpisodePresentation
	constructor(presentation: EpisodePresentation) {
		super("IMDb episode ratings are unavailable")
		this.presentation = presentation
	}
}

interface AlignmentRow {
	imdb_episode_id: string
	season_number: number | null
	episode_number: number | null
	name: string | null
	score: number | null
	votes: number | null
}

/** Both sites' episodes of a show, as the aligner reads them. */
async function alignmentInput(showId: number) {
	const [imdb, tmdb] = await Promise.all([
		query<AlignmentRow>(
			`SELECT imdb_episode_id, season_number, episode_number, name,
       imdb_user_score_original AS score, imdb_user_score_rating_count AS votes
       FROM imdb_episode WHERE show_id = ? LIMIT 50001`,
			[showId],
		),
		query<CanonicalGridEpisode>(
			"SELECT tmdb_id, imdb_id, season_number, episode_number, name FROM episode WHERE show_id = ? AND removed_at IS NULL LIMIT 50001",
			[showId],
		),
	])
	return { imdb, tmdb }
}

/**
 * The shows where IMDb lists more seasons than TMDB: the only ones that can be drawn in IMDb's breaks. One read over
 * both season tables (about 0.4 s, under 1,000 shows) kept for hours, so a list of shows (My shows, what's new) asks
 * nothing per show. Held in the process for minutes on top of the shared cache.
 */
let candidates: { at: number; ids: Set<number> } | null = null
async function finerOnImdb(): Promise<Set<number>> {
	if (candidates && Date.now() - candidates.at < 10 * 60_000) return candidates.ids
	try {
		const { ids } = await cached<Record<string, never>, { ids: number[] }>({
			name: "episode-structure-candidates-v1",
			params: {},
			ttlMinutes: 6 * 60,
			target: async () => ({
				ids: (
					await query<{ show_id: number }>(
						`SELECT i.show_id FROM
       (SELECT show_id, count(*) AS n FROM imdb_season WHERE season_number > 0 GROUP BY show_id) i
       JOIN (SELECT show_id, count(*) AS n FROM season WHERE season_number > 0 GROUP BY show_id) t
       ON t.show_id = i.show_id WHERE i.n > t.n LIMIT 100000`,
						[],
					)
				).map((r) => Number(r.show_id)),
			}),
		})
		candidates = { at: Date.now(), ids: new Set(ids) }
		return candidates.ids
	} catch (error) {
		// Without the list no show borrows IMDb's breaks: TMDB's seasons, as before. Asked again in a minute.
		console.warn("episode structure candidates failed", { error })
		candidates = { at: Date.now() - 9 * 60_000, ids: candidates?.ids ?? new Set() }
		return candidates.ids
	}
}

/**
 * Whether the show is drawn in IMDb's season breaks (episode-structure.ts), kept for hours: the IMDb ingest runs
 * daily. A failed read answers no and is not kept.
 */
async function borrowsSeasons(showId: number): Promise<boolean> {
	if (!(await finerOnImdb()).has(showId)) return false
	try {
		const answer = await cached<{ showId: number }, { borrows: boolean }>({
			name: "episode-structure-v1",
			params: { showId },
			ttlMinutes: 6 * 60,
			target: async () => {
				const { imdb, tmdb } = await alignmentInput(showId)
				return { borrows: borrowedLayout(alignEpisodes(imdb, tmdb)) !== null }
			},
		})
		return answer.borrows
	} catch (error) {
		console.error("episode structure read failed", { showId, error })
		return false
	}
}

/** A show drawn in IMDb's season breaks: its presentation, built from the catalog and the alignment. */
async function generated(showId: number): Promise<EpisodePresentation | null> {
	const kept = await cached<{ showId: number }, { presentation: EpisodePresentation | null }>({
		name: "episode-presentation-auto-v1",
		params: { showId },
		ttlMinutes: 10,
		target: async () => {
			const [list, { imdb, tmdb }] = await Promise.all([getSourceEpisodeList(showId), alignmentInput(showId)])
			if (!list.length) return { presentation: null }
			const alignment = alignEpisodes(imdb, tmdb)
			const layout = borrowedLayout(alignment)
			if (!layout) return { presentation: null }
			const catalog = list.map((e) => ({
				id: e.tmdb_id,
				season: e.season_number,
				number: e.episode_number,
				name: e.name,
				airDate: e.air_date,
				runtime: e.runtime,
				still: e.still_path,
				overview: e.overview || null,
			}))
			return { presentation: generatedPresentation(catalog, imdb, alignment, layout) }
		},
	})
	return kept.presentation
}

export async function getEpisodePresentation(
	showId: number,
): Promise<EpisodePresentation | null> {
	const mapping = episodeMapping(showId)
	if (!mapping) {
		// Reviewed mappings win; otherwise IMDb's season breaks when it cuts the run finer (episode-structure.ts).
		if (!(await borrowsSeasons(showId))) return null
		const presentation = await generated(showId).catch((error) => {
			console.error("generated episode presentation failed", { showId, error })
			return null
		})
		return presentation && applyCorrections({ kind: "show", id: showId }, presentation)
	}
	try {
		const presentation = await cached<
			{ showId: number; version: string },
			EpisodePresentation
		>({
			name: "episode-presentation-v2",
			params: { showId, version: mapping.version },
			ttlMinutes: 10,
			target: async () => {
				const list = await getSourceEpisodeList(showId)
				if (!list.length)
					throw new Error("The selected show's episode catalog is unavailable")
				const catalog = list.map((e) => ({
					id: e.tmdb_id,
					season: e.season_number,
					number: e.episode_number,
					name: e.name,
					airDate: e.air_date,
					runtime: e.runtime,
					still: e.still_path,
					overview: e.overview || null,
				}))
				let ratings
				try {
					ratings = await query<
						Omit<ImdbEpisodeRating, "parentId"> & { parent_id: string }
					>(
						`SELECT imdb_episode_id AS id, imdb_show_id AS parent_id, season_number AS season,
       episode_number AS number, name, imdb_user_score_original AS score, imdb_user_score_rating_count AS votes
       FROM imdb_episode WHERE show_id = ?`,
						[showId],
					)
				} catch {
					// Preserve labels and tracking, but retry ratings on the next read instead of caching the failed result.
					throw new RatingsUnavailable({
						...buildEpisodePresentation(catalog, [], mapping),
						note: "IMDb ratings are temporarily unavailable.",
					})
				}
				return buildEpisodePresentation(
					catalog,
					ratings.map(({ parent_id, ...e }) => ({ ...e, parentId: parent_id })),
					mapping,
				)
			},
		})
		// Live episode corrections (names, air dates) apply after the cache, so no cache reset is needed.
		return applyCorrections({ kind: "show", id: showId }, presentation)
	} catch (error) {
		if (error instanceof RatingsUnavailable)
			return applyCorrections({ kind: "show", id: showId }, error.presentation)
		throw error
	}
}
