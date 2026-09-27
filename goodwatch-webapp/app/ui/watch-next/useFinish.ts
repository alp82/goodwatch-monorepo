// "I watched it" on the hero: records the watch, removes the title from Want to See, and opens the score prompt. When
// the prompt closes, a toast names the title that rose into the hero, with Undo. Undo removes the watch, restores
// Want to See with its original added-at time, and takes back a score given in the prompt.
// Members go through /api/watch-next/watched; a guest's Wishlist lives in the browser, so it changes there.
import { useQueryClient } from "@tanstack/react-query"
import { useCallback, useRef, useState } from "react"
import { useScoreMutation } from "~/hooks/useUserDataMutations"
import { getQueryKeyUserData, useUserData } from "~/routes/api.user-data"
import type { FinishUndo } from "~/server/finish-title.server"
import type { Score } from "~/server/scores.server"
import type { WatchNextTitle } from "~/server/watch-next.server"
import type { TasteInteraction } from "~/ui/taste/types"
import { useUser } from "~/utils/auth"
import {
	guestInteractionsOf,
	restoreGuestInteractions,
	updateGuestInteraction,
} from "~/utils/guest-progress"
import { useRefreshWatchNext } from "./useWatchNext"

export interface Finished {
	id: number
	title: WatchNextTitle
	/** A member's Undo, once the server recorded the watch. */
	undo: Promise<FinishUndo | null> | null
	/** A guest's interactions with the title before, to put back on Undo. */
	guestBefore: TasteInteraction[] | null
	scoreBefore: Score | null
	/** A score was given in the prompt. */
	scored: boolean
}

async function post(body: unknown): Promise<Response> {
	const response = await fetch("/api/watch-next/watched", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	})
	if (!response.ok) throw new Error(`Watched answered ${response.status}`)
	return response
}

export function useFinish() {
	const { user } = useUser()
	const client = useQueryClient()
	const refresh = useRefreshWatchNext()
	const { data: userData } = useUserData()
	const { mutate: updateScore } = useScoreMutation()
	const [prompt, setPrompt] = useState<Finished | null>(null)
	const [toast, setToast] = useState<Finished | null>(null)
	const latest = useRef<Finished | null>(null)

	const refreshAll = useCallback(async () => {
		if (user)
			await client.invalidateQueries({ queryKey: getQueryKeyUserData(user.id) })
		await refresh()
	}, [client, refresh, user])

	const finish = useCallback(
		(title: WatchNextTitle) => {
			const { media_type: mediaType, tmdb_id: tmdbId } = title
			const scoreBefore =
				(userData?.scores[`${mediaType}-${tmdbId}`]?.score as
					| Score
					| undefined) ?? null
			const finished: Finished = {
				id: Date.now(),
				title,
				undo: null,
				guestBefore: null,
				scoreBefore,
				scored: false,
			}
			if (user) {
				finished.undo = post({ key: title.key })
					.then(
						async (response) =>
							((await response.json()) as { undo: FinishUndo }).undo,
					)
					.catch(() => null)
					.finally(() => refreshAll())
			} else {
				finished.guestBefore = guestInteractionsOf(mediaType, tmdbId)
				// Removing Want to See changes the guest progress, which refetches Watch next.
				updateGuestInteraction(mediaType, tmdbId, "plan", undefined, true)
			}
			latest.current = finished
			setToast(null)
			setPrompt(finished)
		},
		[user, userData, refreshAll],
	)

	/** The prompt closed: after a score, or with Rate later. */
	const closePrompt = useCallback((scored: boolean) => {
		const finished = latest.current
		setPrompt(null)
		if (finished) setToast({ ...finished, scored, id: Date.now() })
	}, [])

	const undo = useCallback(async () => {
		const finished = toast
		setToast(null)
		if (!finished) return
		const { media_type: mediaType, tmdb_id: tmdbId } = finished.title
		if (!user) {
			restoreGuestInteractions(mediaType, tmdbId, finished.guestBefore ?? [])
			return
		}
		const token = await finished.undo
		if (token) await post({ undo: token }).catch(() => null)
		if (finished.scored)
			updateScore({ mediaType, tmdbId, score: finished.scoreBefore })
		await refreshAll()
	}, [toast, user, updateScore, refreshAll])

	return {
		finish,
		prompt,
		closePrompt,
		toast,
		dismissToast: useCallback(() => setToast(null), []),
		undo,
	}
}
