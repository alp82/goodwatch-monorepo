// Opens the episode a show page's address links to (`?episode=s5e14&name=…`, domain/episode-link.ts): its season in
// the grid, the episode picked; an episode under those numbers with another name stays closed. Once, after hydration,
// so the server's page (every season closed) and the first paint agree. A season the grid doesn't have yet (the rest
// of a long grid is still loading) is opened when it arrives.
import { useEffect, useRef } from "react"
import {
	type LinkableEpisode,
	findLinkedEpisode,
	parseEpisodeLink,
} from "~/domain/episode-link"

export function useEpisodeLink<E extends LinkableEpisode>(
	seasons: readonly { number: number; episodes: readonly E[] }[],
	open: (season: number, episode: E) => void,
) {
	const done = useRef(false)
	useEffect(() => {
		if (done.current) return
		const link = parseEpisodeLink(window.location.search)
		if (!link) {
			done.current = true
			return
		}
		const found = findLinkedEpisode(seasons, link)
		if (!found) return
		done.current = true
		open(found.season, found.episode)
	}, [seasons])
}

/** Whether the address links to a season that a grid's part (its newest seasons) doesn't hold. */
export function linksOutsidePart(seasonNumbers: readonly number[]) {
	const link = parseEpisodeLink(window.location.search)
	return !!link && !seasonNumbers.includes(link.season)
}
