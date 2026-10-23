// The episode list's handle on the member's season, episode and part scores of the show (#759): one store per show
// store (so per member and show), seeded from the show's tracking read. Loaded with the episode list.
import { useEffect, useSyncExternalStore } from "react"
import type { MemberEpisodeScore } from "~/domain/episode-scores"
import { productAnalyticsFetch } from "~/telemetry/product-analytics"
import {
	EpisodeScoreStore,
	type EpisodeScoreSendAnswer,
} from "./episode-score-store"
import type { ShowStore } from "./store"

const ENDPOINT = "/api/episode-scores"
const stores = new WeakMap<ShowStore, EpisodeScoreStore>()

function storeOf(show: ShowStore): EpisodeScoreStore {
	let store = stores.get(show)
	if (!store) {
		store = new EpisodeScoreStore(
			async (body): Promise<EpisodeScoreSendAnswer> => {
				const response = await productAnalyticsFetch(ENDPOINT, {
					method: "POST",
					body: JSON.stringify({ id: show.showId, ...body }),
				})
				if (!response.ok)
					throw new Error(`The score was not saved: ${response.status}`)
				return response.json()
			},
			(message) => show.say(message, [], "error"),
		)
		stores.set(show, store)
	}
	return store
}

/** The show's score store, and a number that changes with every change of it. */
export function useEpisodeScores(
	show: ShowStore,
	scores: MemberEpisodeScore[] | undefined,
): { store: EpisodeScoreStore; version: number } {
	const store = storeOf(show)
	useEffect(() => {
		store.seed(scores)
	}, [store, scores])
	const version = useSyncExternalStore(
		store.subscribe,
		store.getVersion,
		store.getVersion,
	)
	return { store, version }
}
