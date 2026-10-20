import useLocale from "~/utils/locale"
import { mediaLanguageUrl } from "~/utils/media-presentation"
// The signal that something new aired for a member's shows (#442), for the Browse button, the dock's key, the My
// shows tile and home's Continue door. For a member with a Watching or Seen show; everyone else sends no
// request. It refetches when the member's watch state changes, since watching the new episode takes
// its show out, and opening My shows leaves episode announcements pending.
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useMemo } from "react"
import {
	type NewEpisodes,
	type SignalWords,
	signalWords,
} from "~/domain/new-episodes-signal"
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

/** What the signal is told; null for a guest and a member without such a show. */
export function useNewEpisodesData(): NewEpisodes | null {
	const { locale } = useLocale()
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
		enabled: Boolean(user) && signature !== null,
		placeholderData: (previous, query) => query?.queryKey.at(-1) === locale.language ? previous : undefined,
	})
	return signature === null ? null : (query.data ?? null)
}

/** What the signal says; null when nothing is new, for a guest, and while tracking is off for the viewer. */
export function useNewEpisodes(): SignalWords | null {
	const fresh = useNewEpisodesData()
	return useMemo(() => (fresh ? signalWords(fresh) : null), [fresh])
}

/** Record the My shows visit for streaming-service news; episode announcements stay pending. */
export function useMyShowsVisit(): void {
	const queryClient = useQueryClient()
	const { user } = useUser()
	const userId = user?.id
	useEffect(() => {
		if (!userId) return
		const queryKey = keyOf(userId)
		fetch(ENDPOINT, {
			method: "POST",
			body: new URLSearchParams({ intent: "visit" }),
		})
			.then(async (response) => {
				// Let go of the visit response body.
				void response.body?.cancel()
				if (!response.ok) return
				// A read that left before the visit was stored would bring the old answer back.
				await queryClient.cancelQueries({ queryKey })
				await queryClient.invalidateQueries({ queryKey })
				// The visit clears the shows that landed on a service too (#456).
				await clearLanded(queryClient, userId, "shows")
			})
			// A failed visit must not clear pending news.
			.catch(() => {})
	}, [userId, queryClient])
}
