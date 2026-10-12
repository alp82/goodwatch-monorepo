// Everything that is new for a member, for the navigation and home's doors: the shows with a new episode (#442) and
// the titles that landed on one of their services (#456). The first comes from /api/new-episodes, the second rides
// along with Tonight's pick, so neither is a request this adds. A visit of My shows clears the shows, a visit of
// My movies the movies (clearLanded in useTonightsPick.ts).
import { useMemo } from "react"
import type { NewEpisodes, SignalWords } from "~/domain/new-episodes-signal"
import {
	type NewOnServices,
	openerWords,
} from "~/domain/newly-available-signal"
import { useNewEpisodesData } from "./useNewEpisodes"
import { useTonightsPick } from "./useTonightsPick"

export interface WhatsNew {
	episodes: NewEpisodes | null
	landed: NewOnServices | null
}

export function useWhatsNew(): WhatsNew {
	const episodes = useNewEpisodesData()
	const { landed } = useTonightsPick()
	return useMemo(() => ({ episodes, landed }), [episodes, landed])
}

/** What the Browse button and the dock's key say: the sum of everything new. Null when nothing is. */
export function useOpenerSignal(): SignalWords | null {
	const { episodes, landed } = useWhatsNew()
	return useMemo(() => openerWords(episodes, landed), [episodes, landed])
}
