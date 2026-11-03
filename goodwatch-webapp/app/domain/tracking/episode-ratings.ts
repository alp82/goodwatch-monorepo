// IMDb's episode ratings beside the episodes of the episode list (#369).
//
// The episode list is in TMDB's numbering and the ratings are in IMDb's, and the two differ for some seasons: a
// two-part opener that one site lists once, a broadcast order against a release order. A rating is therefore taken
// only where the two sites mean the same episode, and an episode never shows its neighbour's rating. Pure.

/** A listed episode, as much as the match reads of it. Season 0 holds the specials. */
export interface ListedName {
	id: number
	season: number
	number: number
	name: string | null
}

/** A season as IMDb numbers it, with its rated episodes. */
export interface RatedSeason {
	number: number
	episodes: readonly {
		number: number
		name: string
		score: number
		votes?: number
		unrated?: boolean
		/** The TMDB episode the grid proved this to be, by id or by the run alignment (episode-run-alignment.ts). */
		tmdbId?: number
	}[]
}

export interface EpisodeRating {
	/** IMDb's rating, 0 to 10. */
	score: number
	votes?: number
	/** Found by the grid's proven TMDB episode, at the same season and number, or elsewhere in the season under the same title. */
	how: "id" | "number" | "title"
}

export interface EpisodeRatings {
	/** By the listed episode's id. An episode that is not in it has no rating. */
	byEpisode: Map<number, EpisodeRating>
	/**
	 * Per season that IMDb numbers differently: how many ratings were found by title, and how many episodes were left
	 * without one although IMDb rates an episode at their number.
	 */
	notes: Map<number, { byTitle: number; missing: number }>
}

const norm = (name: string | null) =>
	(name ?? "").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "")

/** No name, or a placeholder such as "Episode 3" and IMDb's "Episode #1.3". */
const generic = (name: string | null) => /^(episode\d*|\d+)$/.test(norm(name))

/**
 * IMDb's rating for each listed episode, or none.
 *
 * 0. The episode the grid already proved to be this one (its `tmdbId`), in any season.
 * 1. The episode IMDb has at the same season and number, when the titles agree.
 * 2. Otherwise the one episode of that season with the same title.
 * 3. Otherwise the episode at the same number when one of the two has no real title and both sites list the same
 *    number of episodes for the season.
 *
 * An IMDb episode is given to one listed episode only. Specials take no rating: IMDb lists them without a season.
 */
export function matchEpisodeRatings(
	episodes: readonly ListedName[],
	seasons: readonly RatedSeason[],
): EpisodeRatings {
	const byEpisode = new Map<number, EpisodeRating>()
	const notes = new Map<number, { byTitle: number; missing: number }>()
	const listed = new Map<number, ListedName[]>()
	for (const episode of episodes) {
		if (episode.season <= 0) continue
		const list = listed.get(episode.season)
		if (list) list.push(episode)
		else listed.set(episode.season, [episode])
	}
	// Proven identities first; an IMDb episode proven for one listed episode is taken by no other.
	const proven = new Map<number, { season: number; episode: RatedSeason["episodes"][number] }>()
	for (const s of seasons)
		for (const e of s.episodes)
			if (e.tmdbId !== undefined && !e.unrated) proven.set(e.tmdbId, { season: s.number, episode: e })
	const provenTaken = new Set(
		[...proven.values()].map((p) => `${p.season}:${p.episode.number}`),
	)
	for (const [season, all] of listed) {
		const own: ListedName[] = []
		for (const episode of all) {
			const p = proven.get(episode.id)
			if (p)
				byEpisode.set(episode.id, {
					score: p.episode.score,
					how: "id",
					...(p.episode.votes === undefined ? {} : { votes: p.episode.votes }),
				})
			else own.push(episode)
		}
		if (!own.length) continue
		const source = seasons.find((s) => s.number === season)
		const imdb = source
			? { ...source, episodes: source.episodes.filter((e) => !e.unrated) }
			: undefined
		if (!imdb?.episodes.length) continue
		const atNumber = new Map(imdb.episodes.map((e) => [e.number, e]))
		const titled = new Map<string, RatedSeason["episodes"][number] | null>()
		for (const e of imdb.episodes) {
			const key = norm(e.name)
			if (!key || generic(e.name)) continue
			// A title IMDb lists twice in the season names no single episode.
			titled.set(key, titled.has(key) ? null : e)
		}
		const sameLength =
			Math.max(...imdb.episodes.map((e) => e.number)) ===
			Math.max(...all.map((e) => e.number))
		const taken = new Set<number>(
			imdb.episodes
				.filter((e) => provenTaken.has(`${season}:${e.number}`))
				.map((e) => e.number),
		)
		const left: ListedName[] = []
		for (const episode of own) {
			const at = atNumber.get(episode.number)
			if (at && norm(at.name) === norm(episode.name) && !generic(at.name)) {
				byEpisode.set(episode.id, {
					score: at.score,
					how: "number",
					...(at.votes === undefined ? {} : { votes: at.votes }),
				})
				taken.add(at.number)
			} else left.push(episode)
		}
		let byTitle = 0
		const unnamed: ListedName[] = []
		for (const episode of left) {
			const named = generic(episode.name)
				? null
				: titled.get(norm(episode.name))
			if (named && !taken.has(named.number)) {
				byEpisode.set(episode.id, {
					score: named.score,
					how: "title",
					...(named.votes === undefined ? {} : { votes: named.votes }),
				})
				taken.add(named.number)
				byTitle += 1
			} else unnamed.push(episode)
		}
		let missing = 0
		for (const episode of unnamed) {
			const at = atNumber.get(episode.number)
			if (!at) continue
			if (
				sameLength &&
				!taken.has(at.number) &&
				(generic(episode.name) || generic(at.name))
			) {
				byEpisode.set(episode.id, {
					score: at.score,
					how: "number",
					...(at.votes === undefined ? {} : { votes: at.votes }),
				})
				taken.add(at.number)
			} else missing += 1
		}
		if (byTitle || missing) notes.set(season, { byTitle, missing })
	}
	return { byEpisode, notes }
}
