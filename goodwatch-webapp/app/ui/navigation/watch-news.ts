// The same news follows Watch into its pages, whether reached from a tab, the phone sheet or the account menu.
import type { NewEpisodes } from "../../domain/new-episodes-signal.ts"
import type { NewOnServices } from "../../domain/newly-available-signal.ts"
import { landedWords, showsWords } from "../../domain/newly-available-words.ts"
import type { AreaTab } from "./areas.ts"

export interface WatchNews {
	shows?: AreaTab["news"]
	movies?: AreaTab["news"]
}

export function watchNews(
	episodes: NewEpisodes | null,
	landed: NewOnServices | null,
): WatchNews {
	const shows = showsWords(episodes, landed?.shows ?? null)
	const movies = landedWords("movie", landed?.movies ?? null)
	return {
		shows: shows ? { badge: shows.badge, label: shows.door } : undefined,
		movies: movies ? { badge: movies.badge, label: movies.door } : undefined,
	}
}

export function withWatchNews(tabs: AreaTab[], news: WatchNews): AreaTab[] {
	return tabs.map((tab) => {
		if (tab.key === "up-next") return { ...tab, news: news.shows }
		if (tab.key === "ready") return { ...tab, news: news.movies }
		return tab
	})
}
