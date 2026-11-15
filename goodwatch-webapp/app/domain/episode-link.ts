// A link to one episode of a show: the show page with `?episode=s5e14&name=Ozymandias`, which opens season 5 in the
// episode grid with episode 14 picked. Numbers are IMDb's season and episode, which the grid shows where it aligned
// them. Where a grid presents the show otherwise (a borrowed or an inactive presentation, TMDB's numbering in the
// member list), the same numbers can be another episode, so the link names the episode too: a number match whose
// name is clearly another episode's opens nothing.
// The /stats page links its episodes this way; `#episodes` after it lands on the section.
import { nearTitle, titleKey } from "./tracking/episode-alignment.ts"

export const EPISODE_PARAM = "episode"
export const EPISODE_NAME_PARAM = "name"

export interface EpisodeLink {
	season: number
	episode: number
	/** The episode's name as the link gives it; null without one. */
	name: string | null
}

/** `episode=s5e14&name=Ozymandias`, for a URL's query. A name that is no title (IMDb's "Episode #1.12") is left out. */
export function episodeLinkSearch(
	season: number,
	episode: number,
	name?: string | null,
): string {
	const params = new URLSearchParams({
		[EPISODE_PARAM]: `s${season}e${episode}`,
	})
	if (name && titleKey(name)) params.set(EPISODE_NAME_PARAM, name.trim())
	return params.toString()
}

/** The episode a query names, or null: `s5e14` in any case; season 0 (the specials) and episode 0 aren't links. */
export function parseEpisodeLink(search: string): EpisodeLink | null {
	const params = new URLSearchParams(search)
	const value = params.get(EPISODE_PARAM) ?? ""
	const m = /^s(\d{1,4})e(\d{1,5})$/i.exec(value.trim())
	if (!m) return null
	const season = Number(m[1])
	const episode = Number(m[2])
	const name = params.get(EPISODE_NAME_PARAM)?.trim() || null
	return season > 0 && episode > 0 ? { season, episode, name } : null
}

export interface LinkableEpisode {
	id: number
	season: number
	number: number
	displaySeason?: number
	displayNumber?: number
	name?: string | null
	/** The read-only grid's name language: "en" and "und" are the catalog's own text, anything else a translation. */
	nameLanguage?: string
	textPresentation?: { name: { source: string } }
}

/** Whether the name the grid shows is the catalog's own text, which a link's name can be held against. */
const ownName = (e: LinkableEpisode) =>
	e.textPresentation?.name.source !== "localized" &&
	(e.nameLanguage === undefined ||
		e.nameLanguage === "en" ||
		e.nameLanguage === "und")

/**
 * Whether a link's name and a grid's name are the same episode: true or false where both are titles, null where
 * either is missing, a placeholder ("Episode #1.12", "Episode 12") or a translation, so only the numbers can tell.
 * Case, punctuation, accents, a leading article and a trailing note ("(No. 145)") don't count.
 */
export function sameEpisodeName(
	linked: string | null,
	episode: LinkableEpisode,
): boolean | null {
	const shown = episode.name ?? null
	if (!ownName(episode) || !titleKey(linked) || !titleKey(shown)) return null
	return nearTitle(linked, shown)
}

/**
 * The linked episode among a grid's seasons, by the numbers the grid shows; null when the grid doesn't have it, or
 * when the episode under those numbers has another name than the link gives.
 */
export function findLinkedEpisode<E extends LinkableEpisode>(
	seasons: readonly { number: number; episodes: readonly E[] }[],
	link: EpisodeLink,
): { season: number; episode: E } | null {
	const season = seasons.find((s) => s.number === link.season)
	const episode = season?.episodes.find(
		(e) =>
			(e.displaySeason ?? e.season) === link.season &&
			(e.displayNumber ?? e.number) === link.episode,
	)
	if (!season || !episode) return null
	if (sameEpisodeName(link.name, episode) === false) return null
	return { season: season.number, episode }
}
