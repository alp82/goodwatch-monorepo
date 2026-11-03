// The episode grid's IMDb rows with the TMDB episode each one is (episode-alignment.ts), and in which seasons the
// grid draws them. Pure.
//
// A show whose TMDB seasons are cut finer than IMDb's (Naruto: one IMDb season, four on TMDB) is drawn in TMDB's
// seasons, when every IMDb episode found its TMDB episode, so no rating is left out. A show IMDb cuts finer gets a
// generated presentation instead (episode-structure.ts), and the grid comes from that. Every other show keeps IMDb's
// numbering, with the identities attached, so the member list rates each TMDB episode by the IMDb episode it is.
import { alignEpisodes } from "./episode-alignment.ts"
import { type CanonicalGridEpisode, identifyGridEpisodes } from "./episode-grid-identity.ts"

export interface GridRow {
	imdb_episode_id: string
	season_number: number | null
	episode_number: number | null
	name: string | null
	score?: number | null
	votes?: number | null
}

export type IdentifiedRow<T> = T & {
	tmdbId?: number
	canonicalSeason?: number
	canonicalNumber?: number
	nameLanguage?: string
}

const isRegular = (r: GridRow) =>
	r.season_number !== null && r.season_number > 0 && r.episode_number !== null && r.episode_number > 0

/** Which TMDB episode each IMDb episode is: the aligner's pairs, and the id-only identity for specials. */
export function episodeIdentities(
	rows: readonly GridRow[],
	canonical: readonly CanonicalGridEpisode[],
): Map<string, number> {
	const found = new Map<string, number>()
	for (const row of gridRows(rows, canonical).rows)
		if (row.tmdbId !== undefined) found.set(row.imdb_episode_id, row.tmdbId)
	return found
}

export function gridRows<T extends GridRow>(
	rows: readonly T[],
	canonical: readonly CanonicalGridEpisode[],
): { rows: IdentifiedRow<T>[]; reshaped: boolean } {
	const alignment = alignEpisodes(rows, canonical)
	const byId = new Map(canonical.map((e) => [e.tmdb_id, e]))
	// Specials and numbered specials (episode 0) are outside the runs; they keep the id-only identity.
	const specials = identifyGridEpisodes(rows, canonical)
	const identified: IdentifiedRow<T>[] = rows.map((row, index) => {
		if (!isRegular(row)) return specials[index]
		const episode = byId.get(alignment.pairs.get(row.imdb_episode_id) ?? -1)
		if (!episode) return { ...row }
		const same = (row.name ?? "").trim().toLowerCase() === (episode.name ?? "").trim().toLowerCase()
		return {
			...row,
			tmdbId: episode.tmdb_id,
			canonicalSeason: episode.season_number,
			canonicalNumber: episode.episode_number,
			// IMDb's text keeps its own language unless TMDB's English name says the same.
			nameLanguage: same && row.name ? "en" : "und",
		}
	})
	const seasons = (list: readonly { season_number: number | null }[]) =>
		new Set(list.map((e) => e.season_number)).size
	const regular = identified.filter(isRegular)
	const finerOnTmdb = seasons(alignment.tmdb) > seasons(alignment.imdb)
	if (!finerOnTmdb || !regular.length || regular.some((r) => r.tmdbId === undefined))
		return { rows: identified, reshaped: false }
	// The episode's place in its TMDB season, 1 up: TMDB may number a season on from the one before.
	const place = new Map<number, number>()
	const filled = new Map<number, number>()
	for (const e of alignment.tmdb) {
		const at = (filled.get(e.season_number) ?? 0) + 1
		filled.set(e.season_number, at)
		place.set(e.tmdb_id, at)
	}
	return {
		rows: identified.map((r) =>
			isRegular(r) && r.tmdbId !== undefined
				? { ...r, season_number: r.canonicalSeason as number, episode_number: place.get(r.tmdbId) as number }
				: r,
		),
		reshaped: true,
	}
}

/** One IMDb season row per drawn season: the vote-weighted mean of its rated episodes, as the ingest does. */
export function drawnSeasonScores(
	rows: readonly { season_number: number | null; episode_number: number | null; score?: number | null; votes?: number | null }[],
): { season_number: number; score: number | null; votes: number | null; max_episode_number: number | null }[] {
	const seasons = new Map<number, { weighted: number; votes: number; max: number }>()
	for (const r of rows) {
		if (r.season_number === null || r.episode_number === null || r.season_number <= 0) continue
		const s = seasons.get(r.season_number) ?? { weighted: 0, votes: 0, max: 0 }
		s.max = Math.max(s.max, r.episode_number)
		if (r.score && r.score > 0 && r.votes) {
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
