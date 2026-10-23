// A member's score for part of a show (#759): a season, an episode, or a part that keeps its episode range, such as
// an anime cour (S1 E1–12). These live in their own table, apart from the whole-title scores in user_score, and
// change nothing in taste, fingerprints or recommendations. Numbers are TMDB's at the time of scoring. Pure and
// shared by the server and the browser.

/** A run of episodes in one season, both ends included. */
export interface EpisodeScoreRange {
	season: number
	firstEpisode: number
	lastEpisode: number
}

export type EpisodeScoreTarget =
	| { scope: "season"; season: number }
	| {
			scope: "episode"
			season: number
			episode: number
			/** The key: a renumbered episode keeps its score. */
			episodeTmdbId: number
	  }
	| {
			scope: "part"
			/** The first range's season. */
			season: number
			ranges: EpisodeScoreRange[]
	  }

export type EpisodeScoreScope = EpisodeScoreTarget["scope"]

/** One stored score, as the show page and the API send it. */
export type MemberEpisodeScore = EpisodeScoreTarget & {
	key: string
	score: number
	/** A part's own name at its source, such as a MyAnimeList entry's title. */
	label: string | null
	updatedAt: string
}

const sortRanges = (ranges: EpisodeScoreRange[]) =>
	[...ranges].sort(
		(a, b) => a.season - b.season || a.firstEpisode - b.firstEpisode,
	)

/** The row key in `user_episode_score`, unique per show. */
export function episodeScoreKey(target: EpisodeScoreTarget): string {
	if (target.scope === "season") return `s${target.season}`
	if (target.scope === "episode") return `e${target.episodeTmdbId}`
	return `p:${sortRanges(target.ranges)
		.map((r) => `s${r.season}e${r.firstEpisode}-${r.lastEpisode}`)
		.join(",")}`
}

/** "Season 3", "S1 E4", or a part's whole range: "S1 E1–12", "S1 E20–26, S2 E1–5". */
export function episodeScoreLabel(target: EpisodeScoreTarget): string {
	if (target.scope === "season") return `Season ${target.season}`
	if (target.scope === "episode") return `S${target.season} E${target.episode}`
	return sortRanges(target.ranges)
		.map((r) =>
			r.firstEpisode === r.lastEpisode
				? `S${r.season} E${r.firstEpisode}`
				: `S${r.season} E${r.firstEpisode}–${r.lastEpisode}`,
		)
		.join(", ")
}

/** Whether a part's range has episodes in this season. */
export const partCoversSeason = (
	target: Extract<EpisodeScoreTarget, { scope: "part" }>,
	season: number,
) => target.ranges.some((range) => range.season === season)

const count = (value: unknown, min: number): value is number =>
	typeof value === "number" && Number.isSafeInteger(value) && value >= min

/** What a member's request may name: a regular season, or an episode by its TMDB id. */
export type RequestedEpisodeScoreTarget =
	| { scope: "season"; season: number }
	| { scope: "episode"; episodeTmdbId: number }

/** Reads `{ scope: "season", season }` or `{ scope: "episode", episodeId }`; anything else is null. */
export function parseEpisodeScoreTarget(
	value: unknown,
): RequestedEpisodeScoreTarget | null {
	if (!value || typeof value !== "object") return null
	const body = value as Record<string, unknown>
	if (body.scope === "season" && count(body.season, 1))
		return { scope: "season", season: body.season }
	if (body.scope === "episode" && count(body.episodeId, 1))
		return { scope: "episode", episodeTmdbId: body.episodeId }
	return null
}

/** A whole score from 1 to 10. */
export const isEpisodeScore = (value: unknown): value is number =>
	count(value, 1) && value <= 10

/** What an import row's score is for, once the preview has matched it; null while it can't be placed. */
export function importedScoreTarget(row: {
	scoreScope?: EpisodeScoreScope
	season?: number | null
	episode?: number | null
	episodeTmdbId?: number | null
	scoreRanges?: EpisodeScoreRange[]
}): EpisodeScoreTarget | null {
	if (row.scoreScope === "season" && row.season != null)
		return { scope: "season", season: row.season }
	if (
		row.scoreScope === "episode" &&
		row.episodeTmdbId != null &&
		row.season != null &&
		row.episode != null
	)
		return {
			scope: "episode",
			season: row.season,
			episode: row.episode,
			episodeTmdbId: row.episodeTmdbId,
		}
	if (row.scoreScope === "part" && row.scoreRanges?.length)
		return {
			scope: "part",
			season: sortRanges(row.scoreRanges)[0].season,
			ranges: row.scoreRanges,
		}
	return null
}
