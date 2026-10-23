// Decides what an import does with each row of the file. Pure: the caller supplies what the catalog and the
// member's ratings hold. Every row gets exactly one outcome, so the counts add up to the number of rows.
import {
	IMDB_IMPORT_OUTCOMES,
	type ImdbImportCounts,
	type ImdbImportOutcome,
} from "~/domain/imdb-import"
import {
	type EpisodeMatch,
	type EpisodeResolution,
	type EpisodeScoreSnapshot,
	episodeRef,
} from "./episodes.server"
import type { FileRow, ImportMediaType } from "./file.server"

/** `movie:603`. Identifies a GoodWatch title in the lookups below. */
export const titleRef = (mediaType: ImportMediaType, tmdbId: number) => `${mediaType}:${tmdbId}`
/** `movie:tt0133093`. An IMDb ID is looked up in the table its title type belongs to. */
export const catalogRef = (mediaType: ImportMediaType, imdbId: string) => `${mediaType}:${imdbId}`

export interface ClassifyContext {
	/** The canonical TMDB IDs the catalog holds for an IMDb ID, by catalogRef. More than one is ambiguous. */
	catalog: Map<string, number[]>
	/** The member's GoodWatch ratings, by titleRef. */
	scores: Map<string, number>
	/** The score the member's latest IMDb import wrote for a title, by titleRef. Undone imports don't count. */
	lastApplied: Map<string, number>
	/** Episode rows (#759): the GoodWatch episode of each IMDb episode ID, or why there is none. */
	episodes?: Map<string, EpisodeResolution>
	/** The member's episode scores by episodeRef; null before the user_episode_score table exists. */
	episodeScores?: Map<string, EpisodeScoreSnapshot> | null
	/** The episode score the member's latest IMDb import wrote, by episodeRef. */
	lastAppliedEpisodes?: Map<string, number>
}

/** The preview's answer for an episode row before the user_episode_score table exists. */
export const EPISODE_SCORES_UNAVAILABLE =
	"GoodWatch can't save season and episode scores yet. Import this file again later to bring them in."

export interface ClassifiedRow extends FileRow {
	outcome: ImdbImportOutcome
	reason: string | null
	tmdbId: number | null
	/** The member's GoodWatch rating now. */
	currentScore: number | null
	/** An episode row's GoodWatch episode; tmdbId is then the show's. */
	matchedEpisode?: EpisodeMatch
	/** An episode row: the member's stored score as the preview saw it, or null for none. */
	preview?: EpisodeScoreSnapshot | null
}

/** The key that groups rows naming the same thing: a title, or one episode. */
const rowRef = (row: ClassifiedRow) =>
	row.matchedEpisode
		? `episode:${episodeRef(row.matchedEpisode.showId, row.matchedEpisode.episodeTmdbId)}`
		: row.mediaType && row.tmdbId !== null
			? titleRef(row.mediaType, row.tmdbId)
			: null

export function classifyRows(rows: FileRow[], context: ClassifyContext): ClassifiedRow[] {
	const classified = rows.map((row): ClassifiedRow => {
		const base = { ...row, tmdbId: null, currentScore: null }
		if (row.episode && !row.problem) {
			if (context.episodeScores === null || !context.episodeScores)
				return { ...base, outcome: "unsupported", reason: EPISODE_SCORES_UNAVAILABLE }
			const found = context.episodes?.get(row.imdbId)
			if (!found || "reason" in found)
				return {
					...base,
					outcome: "unmatched",
					reason: found?.reason ?? "This episode isn't in GoodWatch's episode lists, so its score wasn't matched.",
				}
			// Decided below, with the title rows.
			return { ...base, mediaType: "show", tmdbId: found.showId, matchedEpisode: found, outcome: "new", reason: null }
		}
		if (row.problem || !row.mediaType) return { ...base, outcome: row.problem?.outcome ?? "invalid", reason: row.problem?.reason ?? null }
		const found = context.catalog.get(catalogRef(row.mediaType, row.imdbId)) ?? []
		if (found.length === 0) return { ...base, outcome: "unmatched", reason: "This title isn't in the GoodWatch catalog." }
		if (found.length > 1)
			return { ...base, outcome: "unmatched", reason: "This IMDb ID belongs to more than one GoodWatch title, so it can't be matched safely." }
		// Decided below, once rows that share a title are known.
		return { ...base, tmdbId: found[0], outcome: "new", reason: null }
	})

	const byTitle = new Map<string, ClassifiedRow[]>()
	for (const row of classified) {
		const ref = rowRef(row)
		if (ref === null) continue
		byTitle.set(ref, [...(byTitle.get(ref) ?? []), row])
	}

	for (const [ref, group] of byTitle) {
		if (new Set(group.map((row) => row.score)).size > 1) {
			for (const row of group) {
				row.outcome = "invalid"
				row.reason = row.matchedEpisode
					? "This episode is in the file more than once with different ratings."
					: "This title is in the file more than once with different ratings."
			}
			continue
		}
		// The same title with the same rating counts once.
		for (const extra of group.slice(1)) {
			extra.outcome = "invalid"
			extra.reason = extra.matchedEpisode
				? "This episode is in the file more than once. The first row is used."
				: "This title is in the file more than once. The first row is used."
		}

		const row = group[0]
		const episode = row.matchedEpisode
		const stored = episode ? (context.episodeScores?.get(episodeRef(episode.showId, episode.episodeTmdbId)) ?? null) : null
		if (episode) row.preview = stored
		const current = episode ? (stored?.score ?? null) : (context.scores.get(ref) ?? null)
		const applied = episode
			? (context.lastAppliedEpisodes?.get(episodeRef(episode.showId, episode.episodeTmdbId)) ?? null)
			: (context.lastApplied.get(ref) ?? null)
		row.currentScore = current
		if (current === null) {
			if (applied !== null) {
				row.outcome = "conflict"
				row.reason = episode
					? "You removed this episode's score in GoodWatch after an earlier import."
					: "You removed this rating in GoodWatch after an earlier import."
			}
		} else if (current === row.score) {
			row.outcome = "unchanged"
		} else if (current === applied) {
			row.outcome = "update"
		} else {
			row.outcome = "conflict"
			row.reason = episode ? `You scored this episode ${current} in GoodWatch.` : `You rated this ${current} in GoodWatch.`
		}
	}
	return classified
}

export function countOutcomes(rows: { outcome: ImdbImportOutcome; matchedEpisode?: EpisodeMatch }[]): ImdbImportCounts {
	const counts = { rows: rows.length } as ImdbImportCounts
	for (const outcome of IMDB_IMPORT_OUTCOMES) counts[outcome] = 0
	for (const row of rows) counts[row.outcome]++
	const episodes = rows.filter((row) => row.matchedEpisode && row.outcome !== "invalid").length
	if (episodes) counts.episodes = episodes
	return counts
}
