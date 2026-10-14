// Seen it on a show the member is midway through: the key marks the show's Next episode watched ("Seen S2 E4")
// and stays, so the next press marks the episode after it.
//
// The mutation is the show page's own, and the only one in the app that marks one episode: the show's tracking
// store (ui/tracking/store.ts), which applies `{ type: "watch", season, number }` at once and sends it to
// `POST /api/tracking/show` in turn, with an id made here so a request sent twice records once. The store belongs
// to the member and the show, not to a page: the title's page behind the Expand key reads the same one, so it
// shows the tick the TV made without asking again. Nothing else on the TV writes an episode.
//
// Which episode is next comes from the same read the show's page makes (`GET /api/tracking/show`), by the date
// on the member's device, never from the loader's list, which is as old as the page's arrival. After the server
// has stored the watch the scene has the page's loader run again (`refresh`), so My shows and Tonight name the
// episode after it.
//
// There is no Undo on the TV: its toast is one line. The episode list of the show's page, one Expand away,
// unticks an episode.
//
// None of this is in the page's first view: the hook runs in `EpisodeData` (screens/ShowEpisode.tsx), a chunk of
// its own that only a member on a show's title screen asks for, and reports up to the scene. The scene imports
// this file's types only.
import { useCallback, useEffect, useMemo, useRef } from "react"
import { episodeLabel } from "~/domain/tracking/machine"
import { newActionId, useShowTracking } from "~/ui/tracking/store"
import type { TvEffect } from "./tv-machine"
import { episodeSeenToast, episodeToMark } from "./tv-shows"

/** What the episode's data component reports up to the scene. */
export type TvEpisodeReport = {
	/** The show it is about, by its key on the TV: `show-95396`. */
	title: string
	/** The episode Seen it marks, as its code ("S2 E4"); null while nobody knows, and when there is none to mark. */
	next: string | null
	/** Carries out an effect of the machine that is the episode's; answers whether it was. */
	onEffect: (effect: TvEffect) => boolean
}

export function useTvEpisode({
	title,
	showId,
	say,
	refresh,
}: {
	/** The show on the title screen, by its key on the TV. */
	title: string
	showId: number
	/** The TV's toast. */
	say: (text: string) => void
	/** Has the page's loader read the member's shows again. */
	refresh: () => void
}): TvEpisodeReport {
	const { store, ready, view, toast } = useShowTracking(showId)
	const next = ready && view ? episodeToMark(view.derived) : null
	const code = next ? episodeLabel(next) : null
	const latest = useRef({ title, next, code })
	latest.current = { title, next, code }

	// What the store refuses, and what the server did not take, it says in the show page's toast. The TV is not
	// that page: it says it itself, and the page behind the Expand key does not say it a second time.
	useEffect(() => {
		if (toast?.tone !== "error") return
		say(toast.text)
		store.dismissToast()
	}, [toast, store, say])

	const onEffect = useCallback(
		(effect: TvEffect): boolean => {
			if (effect.type !== "seen-episode") return false
			const now = latest.current
			if (effect.title !== now.title || !now.next || !now.code) return true
			const acted = store.act(
				{ type: "watch", season: now.next.season, number: now.next.number },
				{ actionId: newActionId() },
			)
			if (!acted.ok) return true
			// Shown at once, as the key is: the store has applied the watch to its copy.
			say(
				episodeSeenToast(
					now.code,
					store.snapshot.copy?.state?.state === "seen",
				),
			)
			// Once the watch is stored, the loader's My shows and Tonight are read again.
			acted.done.then((answer) => {
				if (answer) refresh()
			})
			return true
		},
		[store, say, refresh],
	)

	// The same object while nothing changed: every new one is another render of the scene (`useReport`).
	return useMemo(
		() => ({ title, next: code, onEffect }),
		[title, code, onEffect],
	)
}
