export interface CanonicalGridEpisode {
	tmdb_id: number
	imdb_id: string | null
	season_number: number
	episode_number: number
	name: string | null
}
export interface ImdbGridEpisode {
	imdb_episode_id: string
	season_number: number | null
	episode_number: number | null
	name: string | null
}
const norm = (name: string | null) =>
	(name ?? "").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "")
const realName = (name: string | null) => {
	const value = norm(name)
	return value && !/^(episode\d*|\d+)$/.test(value) ? value : null
}
/** Attach identity only; keep IMDb grid membership, numbering, votes and scores.
 * Unique external IDs win. Otherwise require a unique real title on both sides in
 * the same season, as in the rating matcher. Equal numbers alone prove nothing.
 */
export function identifyGridEpisodes<T extends ImdbGridEpisode>(
	rows: readonly T[],
	canonical: readonly CanonicalGridEpisode[],
): (T & { tmdbId?: number; nameLanguage?: string; canonicalSeason?: number; canonicalNumber?: number })[] {
	const byImdb = new Map<string, CanonicalGridEpisode[]>()
	const byName = new Map<string, CanonicalGridEpisode[]>()
	const imdbNames = new Map<string, number>()
	const imdbIds = new Map<string, number>()
	for (const episode of canonical) {
		if (!Number.isSafeInteger(episode.tmdb_id) || episode.tmdb_id <= 0) continue
		if (episode.imdb_id)
			byImdb.set(episode.imdb_id, [
				...(byImdb.get(episode.imdb_id) ?? []),
				episode,
			])
		const name = realName(episode.name)
		if (name && episode.season_number > 0) {
			const key = `${episode.season_number}:${name}`
			byName.set(key, [...(byName.get(key) ?? []), episode])
		}
	}
	for (const row of rows) {
		imdbIds.set(
			row.imdb_episode_id,
			(imdbIds.get(row.imdb_episode_id) ?? 0) + 1,
		)
		const name = realName(row.name)
		if (name) {
			const key = `${row.season_number}:${name}`
			imdbNames.set(key, (imdbNames.get(key) ?? 0) + 1)
		}
	}
	const matches = rows.map((row) => {
		if (imdbIds.get(row.imdb_episode_id) !== 1) return undefined
		const direct = byImdb.get(row.imdb_episode_id)
		if (direct) return direct.length === 1 ? direct[0] : undefined
		const name = realName(row.name)
		const key = `${row.season_number}:${name}`
		const candidates = name ? byName.get(key) : undefined
		return imdbNames.get(key) === 1 &&
			candidates?.length === 1 &&
			!candidates[0].imdb_id
			? candidates[0]
			: undefined
	})
	const uses = new Map<number, number>()
	for (const match of matches)
		if (match) uses.set(match.tmdb_id, (uses.get(match.tmdb_id) ?? 0) + 1)
	return rows.map((row, i) => {
		const match = matches[i]
		return match && uses.get(match.tmdb_id) === 1
			? {
					...row,
					tmdbId: match.tmdb_id,
                    canonicalSeason: match.season_number, canonicalNumber: match.episode_number,
					// Preserve the IMDb name used by rating alignment. A same-name
					// canonical English source can establish its language; an external
					// ID alone establishes identity, not the language of IMDb's text.
					nameLanguage:
						realName(row.name) && norm(row.name) === norm(match.name)
							? "en"
							: "und",
				}
			: { ...row }
	})
}

/**
 * Rule 3: IMDb episodes that rules 1 and 2 left unplaced, matched by number in the regular seasons where IMDb and
 * TMDB list the same episodes. A season qualifies when both lists have as many episodes, every one numbered, each
 * number once and the same numbers on both sides, and no episode placed by rules 1 and 2 sits under another number.
 * A TMDB episode already placed, or one that stores another IMDb ID, isn't matched again.
 */
export function matchSameSizeSeasons(
	imdb: readonly {
		imdb_episode_id: string
		season_number: number | null
		episode_number: number | null
	}[],
	canonical: readonly CanonicalGridEpisode[],
	placed: ReadonlyMap<string, number>,
): Map<string, number> {
	const found = new Map<string, number>()
	const claimed = new Set(placed.values())
	const listings = new Map<string, number>()
	for (const row of imdb)
		listings.set(row.imdb_episode_id, (listings.get(row.imdb_episode_id) ?? 0) + 1)
	const seasons = new Set(
		imdb.flatMap((row) =>
			row.season_number !== null && row.season_number > 0
				? [row.season_number]
				: [],
		),
	)
	const numbersOf = (list: readonly (number | null)[]) =>
		list.every((n) => n !== null) && new Set(list).size === list.length
			? [...list].sort((a, b) => Number(a) - Number(b)).join(",")
			: null
	for (const season of seasons) {
		const imdbSeason = imdb.filter((row) => row.season_number === season)
		const tmdbSeason = canonical.filter((row) => row.season_number === season)
		const imdbNumbers = numbersOf(imdbSeason.map((row) => row.episode_number))
		if (
			imdbSeason.length !== tmdbSeason.length ||
			imdbNumbers === null ||
			imdbNumbers !== numbersOf(tmdbSeason.map((row) => row.episode_number))
		)
			continue
		const byNumber = new Map(tmdbSeason.map((row) => [row.episode_number, row]))
		const disagrees = imdbSeason.some((row) => {
			const tmdbId = placed.get(row.imdb_episode_id)
			return (
				tmdbId !== undefined &&
				byNumber.get(row.episode_number ?? -1)?.tmdb_id !== tmdbId
			)
		})
		if (disagrees) continue
		for (const row of imdbSeason) {
			if (placed.has(row.imdb_episode_id)) continue
			if (listings.get(row.imdb_episode_id) !== 1) continue
			const episode = byNumber.get(row.episode_number ?? -1)
			if (!episode || claimed.has(episode.tmdb_id)) continue
			if (episode.imdb_id && episode.imdb_id !== row.imdb_episode_id) continue
			found.set(row.imdb_episode_id, episode.tmdb_id)
			claimed.add(episode.tmdb_id)
		}
	}
	return found
}
