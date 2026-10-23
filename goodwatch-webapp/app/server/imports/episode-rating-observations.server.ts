// One way for every source to describe a season or episode score as an import row (#759). The preview then checks a
// season against the show's episode list and resolves an episode exactly like a watch of it, so a source passes the
// same episode evidence its watch rows carry. Each source still turns its own value into a whole score from 1 to 10.
//
// Sources: Trakt and Kodi (files.server.ts), Watcharr (wishlist.server.ts) and TMDB (tmdb-client.server.ts).
// MyAnimeList and Kitsu entries are parts with an episode range instead (files.server.ts, `scoreScope: "part"`).
// MDBList (#755, branch feat/mdblist-import): its /sync/ratings answers in Trakt's shape (`type` season or episode,
// `show.ids.tmdb`, `season.number`, `episode.ids.tmdb` with season and number), so its importer calls
// seasonScoreObservation and episodeScoreObservation the way the Trakt reader does, with numbering "tmdb".
import type { ImportObservation } from "../../domain/imports.ts"

/** The show a score belongs to, as the source names it. */
export type ScoreShow = Pick<
	ImportObservation,
	"title" | "year" | "tmdbId" | "imdbId"
> &
	Partial<ImportObservation>

/** The same evidence a watch of the episode carries. */
export interface ScoreEpisodeEvidence {
	episodeTmdbId?: number | null
	episodeTvdbId?: number | null
	episodeName?: string | null
	/** "tmdb" only when the source numbers seasons and episodes exactly like TMDB. */
	episodeNumbering: "tmdb" | "unknown"
	season?: number | null
	episode?: number | null
}

interface ScoreFields {
	key: string
	/** A whole score from 1 to 10, or null when the source's value isn't one. */
	score: number | null
	/** Why a null score isn't valid, in the source's terms. */
	invalidReason: string
	addedAt?: string | null
	/** A problem the source already found, such as invalid coordinates; it wins over the score's. */
	problem?: ImportObservation["problem"]
}

const problemOf = (
	fields: ScoreFields,
	missing: string | null,
): Pick<ImportObservation, "problem"> =>
	fields.problem
		? { problem: fields.problem }
		: missing
			? { problem: { outcome: "invalid", reason: missing } }
			: fields.score === null
				? { problem: { outcome: "invalid", reason: fields.invalidReason } }
				: {}

/** A season's score. The season must be a regular season of the show's episode list. */
export function seasonScoreObservation(
	show: ScoreShow,
	season: number | null,
	fields: ScoreFields,
): ImportObservation {
	return {
		...show,
		mediaType: "show",
		key: fields.key,
		kind: "episode_rating",
		scoreScope: "season",
		season,
		score: fields.score,
		...(fields.addedAt !== undefined ? { addedAt: fields.addedAt } : {}),
		...problemOf(
			fields,
			season === null ? "This season score has no season number." : null,
		),
	}
}

/** An episode's score, resolved in the preview like a watch of that episode. */
export function episodeScoreObservation(
	show: ScoreShow,
	evidence: ScoreEpisodeEvidence,
	fields: ScoreFields,
): ImportObservation {
	return {
		...show,
		mediaType: "show",
		key: fields.key,
		kind: "episode_rating",
		scoreScope: "episode",
		...evidence,
		score: fields.score,
		...(fields.addedAt !== undefined ? { addedAt: fields.addedAt } : {}),
		...problemOf(fields, null),
	}
}
