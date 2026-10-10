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
	episodes: readonly { number: number; name: string; score: number }[]
}

export interface EpisodeRating {
	/** IMDb's rating, 0 to 10. */
	score: number
	/** Found at the same season and number, or elsewhere in the season under the same title. */
	how: "number" | "title"
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
	for (const [season, own] of listed) {
		const imdb = seasons.find((s) => s.number === season)
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
			Math.max(...own.map((e) => e.number))
		const taken = new Set<number>()
		const left: ListedName[] = []
		for (const episode of own) {
			const at = atNumber.get(episode.number)
			if (at && norm(at.name) === norm(episode.name) && !generic(at.name)) {
				byEpisode.set(episode.id, { score: at.score, how: "number" })
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
				byEpisode.set(episode.id, { score: named.score, how: "title" })
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
				byEpisode.set(episode.id, { score: at.score, how: "number" })
				taken.add(at.number)
			} else missing += 1
		}
		if (byTitle || missing) notes.set(season, { byTitle, missing })
	}
	return { byEpisode, notes }
}
