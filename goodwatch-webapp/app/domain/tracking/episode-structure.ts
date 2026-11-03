// A show's seasons as the page draws them, when IMDb cuts the run finer than TMDB (Detective Conan: 54 IMDb seasons
// against one on TMDB). Season breaks always help, whichever site has them: the site with more seasons gives them,
// a tie keeps TMDB's. Tracking still names every episode by its TMDB id; only the display season and number come from
// here, through the same presentation the reviewed mappings use (episode-presentation.ts). Pure.
import type { EpisodeAlignment } from "./episode-alignment.ts"
import type { CatalogEpisode, EpisodePresentation, PresentedEpisode } from "./episode-presentation.ts"

/** TMDB episode id → [display season, display number], for every regular TMDB episode. */
export type EpisodeLayout = Map<number, readonly [number, number]>

/**
 * The display layout from IMDb's season breaks, or null when TMDB's seasons stay (as many or more of them, or a break
 * that can't be placed for sure).
 *
 * Each paired TMDB episode goes to its IMDb episode's season. An unpaired one goes to the season of the paired episodes
 * around it; between two seasons its season is unknown, and the show keeps TMDB's seasons. Episodes after IMDb's last
 * one continue its season while they are in the same TMDB season, and a later TMDB season IMDb doesn't list yet
 * becomes the next season. Display numbers count each season's episodes from 1, in TMDB's order.
 */
export function borrowedLayout(alignment: EpisodeAlignment): EpisodeLayout | null {
	const { imdb, tmdb, pairs } = alignment
	const seasonsOf = (list: readonly { season_number: number | null }[]) => new Set(list.map((e) => e.season_number)).size
	if (seasonsOf(imdb) <= seasonsOf(tmdb)) return null
	const imdbSeason = new Map(imdb.map((e) => [e.imdb_episode_id, e.season_number as number]))
	const seasonOfTmdb = new Map<number, number>()
	for (const [imdbId, tmdbId] of pairs) seasonOfTmdb.set(tmdbId, imdbSeason.get(imdbId) as number)
	const at = tmdb.map((e) => seasonOfTmdb.get(e.tmdb_id))
	const paired = at.flatMap((season, j) => (season === undefined ? [] : [j]))
	if (!paired.length) return null
	// Paired episodes must keep IMDb's season order along TMDB's run.
	for (let k = 1; k < paired.length; k++) if ((at[paired[k]] as number) < (at[paired[k - 1]] as number)) return null
	const lowest = Math.min(...(imdb.map((e) => e.season_number) as number[]))
	const first = paired[0]
	const last = paired[paired.length - 1]
	if (first > 0 && at[first] !== lowest) return null
	const display: number[] = []
	let next = 0
	let extra = Math.max(...(imdb.map((e) => e.season_number) as number[]))
	let lastTmdbSeason = tmdb[last].season_number
	for (let j = 0; j < tmdb.length; j++) {
		if (at[j] !== undefined) {
			display[j] = at[j] as number
			continue
		}
		if (j < first) {
			display[j] = at[first] as number
			continue
		}
		if (j > last) {
			if (tmdb[j].season_number === lastTmdbSeason) display[j] = display[j - 1]
			else {
				lastTmdbSeason = tmdb[j].season_number
				display[j] = ++extra
			}
			continue
		}
		while (paired[next] < j) next++
		const before = at[paired[next - 1]] as number
		const after = at[paired[next]] as number
		if (before !== after) return null
		display[j] = before
	}
	// Borrowing must add seasons; otherwise it would only renumber TMDB's.
	if (new Set(display).size <= seasonsOf(tmdb)) return null
	const layout: EpisodeLayout = new Map()
	const counted = new Map<number, number>()
	tmdb.forEach((e, j) => {
		const number = (counted.get(display[j]) ?? 0) + 1
		counted.set(display[j], number)
		layout.set(e.tmdb_id, [display[j], number])
	})
	return layout
}

export interface RatedImdbEpisode {
	imdb_episode_id: string
	score: number | null
	votes: number | null
}

/** The presentation of a show drawn in borrowed seasons, in the shape the reviewed mappings produce; null when the
 * catalog has an episode the layout can't place. */
export function generatedPresentation(
	catalog: readonly CatalogEpisode[],
	ratings: readonly RatedImdbEpisode[],
	alignment: EpisodeAlignment,
	layout: EpisodeLayout,
): EpisodePresentation | null {
	const byTmdb = new Map([...alignment.pairs].map(([imdbId, tmdbId]) => [tmdbId, imdbId]))
	// A regular episode the layout doesn't know, before its last one (two TMDB rows under one number, left out of the
	// run), has no known season: the show keeps TMDB's seasons. Only newer ones continue the last season.
	const laid = catalog.filter((e) => e.season > 0 && layout.has(e.id))
	const lastLaid = laid.reduce<CatalogEpisode | null>(
		(last, e) => (!last || e.season > last.season || (e.season === last.season && e.number > last.number) ? e : last),
		null,
	)
	const unknownBefore = catalog.some(
		(e) =>
			e.season > 0 &&
			!layout.has(e.id) &&
			lastLaid !== null &&
			(e.season < lastLaid.season || (e.season === lastLaid.season && e.number < lastLaid.number)),
	)
	if (unknownBefore) return null
	const rated = new Map(ratings.map((r) => [r.imdb_episode_id, r]))
	const sorted = [...catalog].sort((a, b) => a.season - b.season || a.number - b.number)
	// A catalog episode the layout hasn't seen (TMDB added it since) continues the last season.
	const lastSeason = Math.max(0, ...[...layout.values()].map(([season]) => season))
	let lastNumber = Math.max(0, ...[...layout.values()].filter(([s]) => s === lastSeason).map(([, n]) => n))
	const episodes: PresentedEpisode[] = sorted.map((e) => {
		const place = e.season === 0 ? ([0, e.number] as const) : (layout.get(e.id) ?? ([lastSeason, ++lastNumber] as const))
		const source = rated.get(byTmdb.get(e.id) ?? "")
		const score = source?.score && source.score > 0 ? source.score : null
		return {
			...e,
			displaySeason: place[0],
			displayNumber: place[1],
			rating: score,
			votes: score !== null ? Math.max(0, source?.votes ?? 0) : 0,
			resolved: true,
		}
	})
	const numbers = [...new Set(episodes.filter((e) => e.season > 0).map((e) => e.displaySeason))].sort((a, b) => a - b)
	const seasons = numbers.map((number) => {
		const members = episodes.filter((e) => e.season > 0 && e.displaySeason === number)
		const scored = members.filter((e) => e.rating !== null)
		const votes = scored.reduce((sum, e) => sum + e.votes, 0)
		return {
			number,
			ids: members.map((e) => e.id),
			rated: scored.length,
			total: members.length,
			unresolved: 0,
			score:
				votes > 0
					? Math.round((scored.reduce((sum, e) => sum + (e.rating as number) * e.votes, 0) / votes) * 100) / 100
					: null,
		}
	})
	// The version changes when the layout or the catalog does, so a stale action is told apart (episode-presentation.ts).
	let hash = 2166136261
	for (const e of episodes)
		for (const char of `${e.id}:${e.season}:${e.number}:${e.displaySeason}:${e.displayNumber}:${e.airDate ?? ""};`)
			hash = Math.imul(hash ^ char.charCodeAt(0), 16777619)
	return { version: `auto1-${(hash >>> 0).toString(36)}`, active: true, note: null, episodes, seasons }
}
