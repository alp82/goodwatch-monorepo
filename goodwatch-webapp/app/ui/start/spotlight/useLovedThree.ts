// The guest's three loved titles on the start page and the picks they bring (loved-three.ts has the rules).
//
// Loved titles are saved in the guest's stored progress (utils/guest-progress.ts, `onboarding_ratings`) as a 9, so
// sign-up carries them and Discover's For you counts them. Once three are loved, a short beat lets the third heart
// land, then the card turns to For you; meanwhile the picks are asked for (ui/taste/guest-pick.ts), leaving out every
// title the guest already answered.
import { useCallback, useEffect, useMemo, useState } from "react"
import type { TitleCard } from "~/server/title-cards.server"
import { type GuestPick, answerKey, findPick } from "~/ui/taste/guest-pick"
import type { TasteInteraction } from "~/ui/taste/types"
import {
	guestInteractionsOf,
	readGuestInteractions,
	restoreGuestInteractions,
	updateGuestInteraction,
} from "~/utils/guest-progress"
import { LOVED_NEEDED } from "../stage/start-query"
import { LOVED_SCORE, type LovedStore, createLovedThree } from "./loved-three"

/** The beat between the third heart and For you (ms). */
const FOR_YOU_BEAT_MS = 450
/** How many picks follow the featured one ("Also for you"): every card one request brings. */
const ALSO_FOR_YOU = 9

/** The guest's stored progress as the loved titles' store. */
export const guestLovedStore: LovedStore<TasteInteraction[]> = {
	snapshot: (t) => guestInteractionsOf(t.media_type, t.tmdb_id),
	love: (t) =>
		updateGuestInteraction(t.media_type, t.tmdb_id, "score", LOVED_SCORE),
	restore: (t, before) =>
		restoreGuestInteractions(t.media_type, t.tmdb_id, before ?? []),
}

/** The For you picks: asked for, or here (`top` null when nothing was left to pick). */
export type ForYouPicks =
	| { status: "loading" }
	| { status: "ready"; pick: GuestPick }

export function useLovedThree() {
	// `round` counts the times a loved title left (an undo or a reset), so the same three loved again are a new choice:
	// the beat and the picks of the three before never show for it.
	const [{ loved, round }, setLoved] = useState<{
		loved: readonly TitleCard[]
		round: number
	}>({ loved: [], round: 0 })
	const three = useMemo(
		() =>
			createLovedThree<TitleCard, TasteInteraction[]>({
				store: guestLovedStore,
				onChange: (next) =>
					setLoved((p) => ({
						loved: next,
						round: next.length < p.loved.length ? p.round + 1 : p.round,
					})),
			}),
		[],
	)
	const lovedKey = `${round}:${loved.map((t) => t.key).join(",")}`
	const full = loved.length >= LOVED_NEEDED
	// Both keyed by the three they answer (and the round), so a reset forgets them without an effect.
	const [beat, setBeat] = useState<string | null>(null)
	const [found, setFound] = useState<{ key: string; pick: GuestPick } | null>(
		null,
	)

	// lovedKey names the loved titles and their round.
	useEffect(() => {
		if (!full) return
		const abort = new AbortController()
		const timer = setTimeout(() => setBeat(lovedKey), FOR_YOU_BEAT_MS)
		const answered = new Set(readGuestInteractions().map(answerKey))
		void findPick(loved, [], answered, {
			more: ALSO_FOR_YOU,
			signal: abort.signal,
		}).then((pick) => {
			if (!abort.signal.aborted) setFound({ key: lovedKey, pick })
		})
		return () => {
			clearTimeout(timer)
			abort.abort()
		}
	}, [full, lovedKey])

	const done = full && beat === lovedKey
	const picks: ForYouPicks | null = !done
		? null
		: found?.key === lovedKey
			? { status: "ready", pick: found.pick }
			: { status: "loading" }

	const toggle = useCallback((card: TitleCard) => three.toggle(card), [three])
	return {
		loved,
		/** Three are loved and the beat is over: the card shows For you. */
		done,
		picks,
		isLoved: three.isLoved,
		toggle,
		/** Back and Start over: the slots empty, the scores stay. */
		reset: three.reset,
		/** For useStartQuery's `onChoice`: a new choice starts over once three are loved. */
		onChoice: three.choice,
	}
}

export type LovedThreeState = ReturnType<typeof useLovedThree>
