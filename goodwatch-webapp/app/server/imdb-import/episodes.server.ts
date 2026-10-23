// The episodes of an IMDb ratings file (#759): each "TV Episode" row is a member's episode score, kept in
// user_episode_score and never in user_score. This finds the GoodWatch episode an IMDb episode ID names, and reads
// the member's episode scores the preview compares against.
//
// The rule is the episode grid's identity rule (domain/tracking/episode-grid-identity.ts), so an import never places
// a score where the grid wouldn't place IMDb's rating:
// 1. An episode whose stored imdb_id is the row's ID, when exactly one does.
// 2. Otherwise the show IMDb's episode list (imdb_episode) puts the ID in, when exactly one, and in that show the
//    TMDB episode with the same unique real title in the same season. Equal numbers alone prove nothing: IMDb and
//    TMDB number some seasons differently.
// Anything else stays unmatched, with the reason.
import {
	type CanonicalGridEpisode,
	identifyGridEpisodes,
} from "~/domain/tracking/episode-grid-identity"
import { isMissingEpisodeScoreTable } from "../episode-scores.server.ts"
import { chunks, marks, run, select } from "./store.server"

export interface EpisodeMatch {
	showId: number
	episodeTmdbId: number
	season: number
	number: number
}
export type EpisodeResolution = EpisodeMatch | { reason: string }

const LOOKUP_BATCH = 1000

const isMissing = (error: unknown, table: string) => {
	const message = String(
		(error as { message?: unknown } | null)?.message ?? error,
	)
	return (
		/RelationUnknown|SchemaUnknown/.test(message) && message.includes(table)
	)
}

/** IMDb's episode list, or none before the IMDb dataset ingest created it. */
async function imdbEpisodes<T extends {}>(
	sql: string,
	params: (string | number)[],
) {
	try {
		return await select<T>(sql, params)
	} catch (error) {
		if (isMissing(error, "imdb_episode")) return []
		throw error
	}
}

const NOT_LISTED =
	"This episode isn't in GoodWatch's episode lists, so its score wasn't matched."
const AMBIGUOUS =
	"This IMDb episode ID belongs to more than one GoodWatch episode, so it can't be matched safely."
const UNPLACED =
	"GoodWatch couldn't tell which episode this is: IMDb numbers or names it differently from the episode list."

/** The GoodWatch episode of each IMDb episode ID, or why there is none. */
export async function resolveImdbEpisodes(
	imdbIds: string[],
): Promise<Map<string, EpisodeResolution>> {
	const ids = [...new Set(imdbIds)]
	const direct = new Map<
		string,
		(CanonicalGridEpisode & { show_id: number })[]
	>()
	const listedIn = new Map<string, Set<number>>()
	for (const batch of chunks(ids, LOOKUP_BATCH)) {
		const [episodes, listed] = await Promise.all([
			select<CanonicalGridEpisode & { show_id: number }>(
				`SELECT show_id, tmdb_id, imdb_id, season_number, episode_number, name FROM episode WHERE imdb_id IN (${marks(batch.length)}) AND removed_at IS NULL`,
				batch,
			),
			imdbEpisodes<{ show_id: number; imdb_episode_id: string }>(
				`SELECT show_id, imdb_episode_id FROM imdb_episode WHERE imdb_episode_id IN (${marks(batch.length)})`,
				batch,
			),
		])
		for (const episode of episodes) {
			const id = String(episode.imdb_id)
			direct.set(id, [...(direct.get(id) ?? []), episode])
		}
		for (const row of listed) {
			const shows = listedIn.get(row.imdb_episode_id) ?? new Set<number>()
			shows.add(Number(row.show_id))
			listedIn.set(row.imdb_episode_id, shows)
		}
	}
	const result = new Map<string, EpisodeResolution>()
	const byShow = new Map<number, string[]>()
	for (const id of ids) {
		const found = direct.get(id) ?? []
		if (found.length === 1) {
			const [episode] = found
			result.set(id, {
				showId: Number(episode.show_id),
				episodeTmdbId: Number(episode.tmdb_id),
				season: Number(episode.season_number),
				number: Number(episode.episode_number),
			})
			continue
		}
		if (found.length > 1) {
			result.set(id, { reason: AMBIGUOUS })
			continue
		}
		const shows = [...(listedIn.get(id) ?? [])]
		if (shows.length !== 1) {
			result.set(id, { reason: shows.length ? AMBIGUOUS : NOT_LISTED })
			continue
		}
		byShow.set(shows[0], [...(byShow.get(shows[0]) ?? []), id])
	}
	for (const [showId, wanted] of byShow) {
		const [listed, canonical] = await Promise.all([
			imdbEpisodes<{
				imdb_episode_id: string
				season_number: number | null
				episode_number: number | null
				name: string | null
			}>(
				"SELECT imdb_episode_id, season_number, episode_number, name FROM imdb_episode WHERE show_id = ? LIMIT 50001",
				[showId],
			),
			select<CanonicalGridEpisode>(
				"SELECT tmdb_id, imdb_id, season_number, episode_number, name FROM episode WHERE show_id = ? AND removed_at IS NULL LIMIT 50001",
				[showId],
			),
		])
		const numbers = canonical.map((episode) => ({
			...episode,
			tmdb_id: Number(episode.tmdb_id),
			season_number: Number(episode.season_number),
			episode_number: Number(episode.episode_number),
		}))
		const placed = new Map(
			identifyGridEpisodes(
				listed.map((row) => ({
					...row,
					season_number:
						row.season_number === null ? null : Number(row.season_number),
					episode_number:
						row.episode_number === null ? null : Number(row.episode_number),
				})),
				numbers,
			).map((row) => [row.imdb_episode_id, row.tmdbId]),
		)
		for (const id of wanted) {
			const tmdbId = placed.get(id)
			const episode =
				tmdbId === undefined
					? undefined
					: numbers.find((each) => each.tmdb_id === tmdbId)
			result.set(
				id,
				episode
					? {
							showId,
							episodeTmdbId: episode.tmdb_id,
							season: episode.season_number,
							number: episode.episode_number,
						}
					: { reason: UNPLACED },
			)
		}
	}
	return result
}

/** A stored episode score as the preview saw it: what the apply checks before it writes. */
export interface EpisodeScoreSnapshot {
	score: number
	updatedAt: string
	seq: number
	term: number
}

/** `<show id>:e<episode id>`: the member's episode score's show and score_key. */
export const episodeRef = (showId: number, episodeTmdbId: number) =>
	`${showId}:e${episodeTmdbId}`

/** The member's episode scores by episodeRef; null before the user_episode_score table exists. */
export async function readEpisodeScores(
	userId: string,
): Promise<Map<string, EpisodeScoreSnapshot> | null> {
	try {
		await run("REFRESH TABLE user_episode_score")
		const rows = await select<{
			tmdb_id: number
			score_key: string
			score: number
			updated_at: Date | string | number
			_seq_no: number
			_primary_term: number
		}>(
			"SELECT tmdb_id, score_key, score, updated_at, _seq_no, _primary_term FROM user_episode_score WHERE user_id = ? LIMIT 100000",
			[userId],
		)
		return new Map(
			rows.map((row) => [
				`${Number(row.tmdb_id)}:${row.score_key}`,
				{
					score: Number(row.score),
					updatedAt: new Date(row.updated_at).toISOString(),
					seq: Number(row._seq_no),
					term: Number(row._primary_term),
				},
			]),
		)
	} catch (error) {
		if (isMissingEpisodeScoreTable(error)) return null
		throw error
	}
}

/** The episode score the member's latest IMDb import wrote, by episodeRef. Undone imports don't count. */
export async function readLastAppliedEpisodes(
	userId: string,
): Promise<Map<string, number>> {
	const rows = await select<{
		tmdb_id: number
		episode_tmdb_id: number
		applied_score: number
	}>(
		`SELECT tmdb_id, episode_tmdb_id, applied_score FROM doc.user_import_item
		 WHERE user_id = ? AND kind = 'episode_rating' AND apply_state IN ('added', 'updated') AND applied_score IS NOT NULL
		 ORDER BY applied_at ASC LIMIT 200000`,
		[userId],
	)
	const applied = new Map<string, number>()
	for (const row of rows)
		applied.set(
			episodeRef(Number(row.tmdb_id), Number(row.episode_tmdb_id)),
			Number(row.applied_score),
		)
	return applied
}
