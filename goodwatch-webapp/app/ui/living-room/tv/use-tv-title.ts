// The title on the TV's title screen and on the rating after Seen it: what the screens show of it, and the effects
// the machine names for it.
//
// What a screen shows comes in two steps: at once what a list on the page knew of the title (`known`), then its
// card from `/api/title-cards` (members GET, guests POST their browser's progress; the answer is never stored by a
// cache). The person's marks (Want to See, Seen, their score) are the page's own user data, a guest's from their
// browser, so a key says what is the moment it is pressed.
//
// The effects: Want to See and the rating are the mutations every title surface uses, and work for a guest. Seen
// is a member's: the server refuses a guest's watch, and a guest's score counts as Seen. Watch and the Expand key
// leave through the TV (ui/living-room/tv-transition.ts); Watch asks the title's page to highlight its streaming
// block, in the history entry's state.
import { useQuery } from "@tanstack/react-query"
import { useCallback, useMemo, useRef } from "react"
import {
	useScoreMutation,
	useWatchedMutation,
	useWishlistMutation,
} from "~/hooks/useUserDataMutations"
import { useUserData } from "~/routes/api.user-data"
import type { TitleCardsAnswer } from "~/server/title-cards-request.server"
import { isSeen } from "~/types/user-data"
import type { StreamingArrival } from "~/ui/details/hero/useStreamingGlow"
import { useUser } from "~/utils/auth"
import { canGuestRate, snapshotGuestProgress } from "~/utils/guest-progress"
import { titleKey } from "~/utils/title-key"
import { useLeaveThroughTv } from "../tv-transition"
import {
	STREAMING_BLOCK,
	type TvEffect,
	type TvScreen,
	watchHref,
} from "./tv-machine"
import {
	type TvKnownTitle,
	type TvTitleOnScreen,
	parseTvTitleKey,
	ratedToast,
	recordsWatch,
	watchKey,
} from "./tv-title"

async function fetchCards(
	keys: number[],
	member: boolean,
): Promise<TitleCardsAnswer> {
	const response = await fetch(
		`/api/title-cards?keys=${keys.join(",")}`,
		member
			? undefined
			: {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ guest: snapshotGuestProgress() }),
				},
	)
	if (!response.ok) throw new Error(`Title cards: ${response.status}`)
	return response.json()
}

export function useTvTitle({
	screen,
	member,
	known,
	say,
}: {
	screen: TvScreen
	member: boolean
	/** What the lists on the page know of a title, by its key on the TV. */
	known: (key: string) => TvKnownTitle | null
	/** The TV's toast. */
	say: (text: string) => void
}) {
	const key =
		screen.name === "title" || screen.name === "rate" ? screen.title : null
	const ref = useMemo(() => (key ? parseTvTitleKey(key) : null), [key])
	const cards = useQuery({
		queryKey: ["tv-title-card", member ? "member" : "guest", key],
		enabled: Boolean(ref),
		queryFn: () =>
			fetchCards(ref ? [titleKey(ref.mediaType, ref.tmdbId)] : [], member),
	})
	const card = cards.data?.cards[0] ?? null
	const mine = cards.data?.services
	const { data: marks } = useUserData()

	const title: TvTitleOnScreen | null = useMemo(() => {
		if (!key || !ref) return null
		const shown = card ?? known(key)
		const mediaKey = `${ref.mediaType}-${ref.tmdbId}` as const
		return {
			key,
			title: shown,
			missing: Boolean(cards.data) && !card,
			mine: mine ?? [],
			// Until the person's marks are read, the card says what it knew of them.
			want: marks ? mediaKey in marks.wishlist : (shown?.wantToSee ?? false),
			seen: marks ? isSeen(marks, mediaKey) : (shown?.seen ?? false),
			score: marks?.scores[mediaKey]?.score ?? null,
		}
	}, [key, ref, card, mine, known, marks, cards.data])

	const leave = useLeaveThroughTv()
	const { mutate: setWish } = useWishlistMutation()
	const { mutate: setWatched } = useWatchedMutation()
	const { mutate: setScore } = useScoreMutation()
	// Who stores what is the browser's session, as the mutations themselves decide it.
	const signedIn = Boolean(useUser().user)
	const latest = useRef({ title, marks, signedIn })
	latest.current = { title, marks, signedIn }

	/** Carries out an effect of the machine that is this hook's; answers whether it was. */
	const onEffect = useCallback(
		(effect: TvEffect): boolean => {
			if (effect.type === "expand") {
				leave(effect.href)
				return true
			}
			if (
				effect.type !== "watch" &&
				effect.type !== "want-to-see" &&
				effect.type !== "seen" &&
				effect.type !== "rate"
			)
				return false
			const now = latest.current
			const target = parseTvTitleKey(effect.title)
			// The title screen shows the title the effect names; a title the catalog lacks has nothing to mark.
			if (!target || now.title?.key !== effect.title || now.title.missing)
				return true
			const mediaKey = `${target.mediaType}-${target.tmdbId}` as const
			switch (effect.type) {
				case "watch": {
					const shown = now.title.title
					// "Not streaming" does nothing; without the title's name its page has no address to scroll in.
					if (!shown || !watchKey(shown, now.title.mine).goes) return true
					const href = watchHref(effect.title, { titleName: shown.title })
					const arrival: StreamingArrival = { highlight: STREAMING_BLOCK }
					if (href) leave(href, arrival)
					return true
				}
				case "want-to-see": {
					const want = now.title.want
					setWish({ ...target, action: want ? "remove" : "add" })
					say(want ? "Off your Wishlist" : "On your Wishlist")
					return true
				}
				case "seen": {
					// Without the person's marks nobody knows whether a watch is already there.
					if (
						now.marks &&
						recordsWatch({
							signedIn: now.signedIn,
							mediaType: target.mediaType,
							seen: now.title.seen,
							started: mediaKey in now.marks.watchState,
						})
					)
						setWatched({ ...target, action: "add" })
					return true
				}
				case "rate": {
					// Past the guest rating limit the score is not stored, and the page says why.
					const stored =
						now.signedIn || canGuestRate(target.mediaType, target.tmdbId)
					setScore({ ...target, score: effect.score })
					if (stored) say(ratedToast(effect.score))
					return true
				}
			}
		},
		[leave, setWish, setWatched, setScore, say],
	)

	return {
		/** The title the title screen and the rating show; null on every other screen. */
		title,
		/** Its name, for its page's address, once anything knows it. */
		titleName: title?.title?.title ?? null,
		onEffect,
	}
}
