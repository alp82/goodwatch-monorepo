// IMDb lists some long-running shows, mostly anime such as Naruto, as one season of every episode in a row, where TMDB
// splits the same run into several seasons. Matched by season and title, almost nothing lines up: the seasons differ and
// IMDb's titles are often romanized Japanese. This puts IMDb's run into TMDB's seasons when the two runs provably have
// the same episodes in the same order. Pure.
import type { CanonicalGridEpisode } from "./episode-grid-identity"

interface RunRow {
	season_number: number | null
	episode_number: number | null
	tmdbId?: number
}

export type RunAligned<T> = T & {
	season_number: number | null
	/** The episode's place in its TMDB season, 1 up: TMDB may number a season on from the one before. */
	episode_number: number | null
	tmdbId?: number
	canonicalSeason?: number
	canonicalNumber?: number
	nameLanguage?: string
}

/**
 * IMDb's rows in TMDB's seasons, or null when the runs don't provably match.
 *
 * It applies only when IMDb has one numbered season, numbered 1 to N with each number once, and TMDB has two or more.
 * IMDb's episode k is then TMDB's k-th episode in season order when TMDB lists exactly N episodes, or TMDB's episode
 * numbered k when TMDB numbers its seasons on from one another (season 2 starts after season 1's last number).
 * An identity found another way (IMDb id, unique title) that points elsewhere cancels the whole alignment.
 * Specials (no season) pass through unchanged.
 */
export function alignEpisodeRun<T extends RunRow>(
	rows: readonly T[],
	canonical: readonly CanonicalGridEpisode[],
): RunAligned<T>[] | null {
	const numbered = rows.filter((r) => r.season_number !== null)
	if (!numbered.length) return null
	const imdbSeasons = new Set(numbered.map((r) => r.season_number))
	if (imdbSeasons.size !== 1 || numbered.some((r) => r.season_number === 0)) return null
	const n = numbered.length
	const numbers = new Set(numbered.map((r) => r.episode_number))
	if (numbers.size !== n) return null
	for (let k = 1; k <= n; k++) if (!numbers.has(k)) return null

	const regular = canonical
		.filter((e) => e.season_number > 0 && e.episode_number > 0)
		.sort((a, b) => a.season_number - b.season_number || a.episode_number - b.episode_number)
	if (new Set(regular.map((e) => e.season_number)).size < 2) return null
	if (new Set(regular.map((e) => `${e.season_number}:${e.episode_number}`)).size !== regular.length) return null

	// TMDB numbers on across seasons when its episodes, in season order, are numbered 1, 2, 3 … with no restart.
	const runNumbered = regular.every((e, i) => e.episode_number === i + 1)
	if (!runNumbered && regular.length !== n) return null
	if (regular.length < n) return null
	// Either way the k-th episode in season order is IMDb's k.
	const target = (k: number) => regular[k - 1]

	const position = new Map<number, number>()
	const seen = new Map<number, number>()
	for (const e of regular) {
		const at = (seen.get(e.season_number) ?? 0) + 1
		seen.set(e.season_number, at)
		position.set(e.tmdb_id, at)
	}

	const aligned: RunAligned<T>[] = []
	for (const row of rows) {
		if (row.season_number === null) {
			aligned.push({ ...row })
			continue
		}
		const to = target(row.episode_number as number)
		if (row.tmdbId !== undefined && row.tmdbId !== to.tmdb_id) return null
		aligned.push({
			...row,
			season_number: to.season_number,
			episode_number: position.get(to.tmdb_id) as number,
			tmdbId: to.tmdb_id,
			canonicalSeason: to.season_number,
			canonicalNumber: to.episode_number,
			nameLanguage: (row as { nameLanguage?: string }).nameLanguage ?? "und",
		})
	}
	return aligned
}

/** One IMDb season row per aligned TMDB season: the vote-weighted mean of its rated episodes, as the ingest does. */
export function runSeasonScores(
	rows: readonly { season_number: number | null; episode_number: number | null; score: number | null; votes: number | null }[],
): { season_number: number; score: number | null; votes: number | null; max_episode_number: number | null }[] {
	const seasons = new Map<number, { weighted: number; votes: number; max: number }>()
	for (const r of rows) {
		if (r.season_number === null || r.episode_number === null) continue
		const s = seasons.get(r.season_number) ?? { weighted: 0, votes: 0, max: 0 }
		s.max = Math.max(s.max, r.episode_number)
		if (r.score !== null && r.score > 0 && r.votes) {
			s.weighted += r.score * r.votes
			s.votes += r.votes
		}
		seasons.set(r.season_number, s)
	}
	return [...seasons].map(([season_number, s]) => ({
		season_number,
		score: s.votes ? Math.round((s.weighted / s.votes) * 10) / 10 : null,
		votes: s.votes || null,
		max_episode_number: s.max,
	}))
}
