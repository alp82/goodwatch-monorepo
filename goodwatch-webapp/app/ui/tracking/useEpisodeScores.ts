// The episode list's handle on the member's season, episode and part scores of the show (#759): one store per show
// store (so per member and show), seeded from the show's tracking read. Loaded with the episode list.
import { useEffect, useSyncExternalStore } from "react"
import type { MemberEpisodeScore } from "~/domain/episode-scores"
import { productAnalyticsFetch } from "~/telemetry/product-analytics"
import {
	EpisodeScoreGoneError,
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
				if (!response.ok) {
					const answer = (await response.json().catch(() => null)) as {
						gone?: boolean
					} | null
					if (response.status === 404 && answer?.gone)
						throw new EpisodeScoreGoneError()
					throw new Error(`The score was not saved: ${response.status}`)
				}
				const answer = (await response.json()) as EpisodeScoreSendAnswer
				// Scoring an episode marks it watched, and clearing the score can take that watch back: the episode
				// list and the show's status read the show's tracking again.
				if (answer.watchAdded || answer.watchRemoved) show.refetch()
				return answer
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
