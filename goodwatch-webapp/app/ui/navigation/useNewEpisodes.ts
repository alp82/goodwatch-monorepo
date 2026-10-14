import useLocale from "~/utils/locale"
import { mediaLanguageUrl } from "~/utils/media-presentation"
// The signal that something new aired for a member's shows (#442), for the Browse button, the dock's key, the My
// shows tile and home's Continue door. Behind REC_TRACKING, for a member with a Watching or Seen show; everyone
// else sends no request. It refetches when the member's watch state changes, since watching the new episode takes
// its show out, and My shows clears it when it is opened.
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useMemo } from "react"
import {
	NOTHING_NEW,
	type NewEpisodes,
	type SignalWords,
	signalWords,
} from "~/domain/new-episodes-signal"
import { useFeature } from "~/hooks/useFeature"
import { useUserData } from "~/routes/api.user-data"
import { watchStateSignature } from "~/types/user-data"
import { useUser } from "~/utils/auth"
import { clearLanded } from "./useTonightsPick"

const ENDPOINT = "/api/new-episodes"
const keyOf = (userId: string) => ["new-episodes", userId] as const

async function fetchNewEpisodes(language: string): Promise<NewEpisodes> {
	const response = await fetch(mediaLanguageUrl(ENDPOINT, language))
	if (!response.ok) throw new Error(`New episodes: ${response.status}`)
	return (await response.json()) as NewEpisodes
}

/** What the signal is told; null for a guest, a member without such a show, and while tracking is off. */
export function useNewEpisodesData(): NewEpisodes | null {
	const { locale } = useLocale()
	const tracking = useFeature("tracking")
	const { user } = useUser()
	const { data } = useUserData()
	const watchState = data?.watchState
	// Only a Watching or a Seen show can be new.
	const signature = useMemo(() => {
		if (!watchState) return null
		const follows = Object.entries(watchState).some(
			([key, entry]) =>
				key.startsWith("show-") &&
				(entry.state === "watching" || entry.state === "seen"),
		)
		return follows ? watchStateSignature(watchState) : null
	}, [watchState])
	const query = useQuery({
		queryKey: [...keyOf(user?.id ?? ""), signature, locale.language],
		queryFn: () => fetchNewEpisodes(locale.language),
		enabled: tracking && Boolean(user) && signature !== null,
		placeholderData: (previous) => previous,
	})
	return signature === null ? null : (query.data ?? null)
}

/** What the signal says; null when nothing is new, for a guest, and while tracking is off for the viewer. */
export function useNewEpisodes(): SignalWords | null {
	const fresh = useNewEpisodesData()
	return useMemo(() => (fresh ? signalWords(fresh) : null), [fresh])
}

/** My shows is open: the visit is recorded, and the signal is cleared wherever it shows. */
export function useMyShowsVisit(): void {
	const queryClient = useQueryClient()
	const { user } = useUser()
	const userId = user?.id
	useEffect(() => {
		if (!userId) return
		const queryKey = keyOf(userId)
		fetch(ENDPOINT, { method: "POST" })
			.then(async (response) => {
				// The answer says nothing new: let go of it, or the request stays open.
				void response.body?.cancel()
				if (!response.ok) return
				// A read that left before the visit was stored would bring the old answer back.
				await queryClient.cancelQueries({ queryKey })
				queryClient.setQueriesData({ queryKey }, NOTHING_NEW)
				await queryClient.invalidateQueries({ queryKey })
				// The visit clears the shows that landed on a service too (#456).
				await clearLanded(queryClient, userId, "shows")
			})
			// The signal then stays until the next visit.
			.catch(() => {})
	}, [userId, queryClient])
}
