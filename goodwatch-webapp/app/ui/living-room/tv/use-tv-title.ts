import useLocale from "~/utils/locale"
import {
	mediaLanguageUrl,
	canonicalMediaTitle,
} from "~/utils/media-presentation"
// The title on the TV's title screen and on the rating after Seen it: what the screens show of it, and the effects
// the machine names for it.
//
// What a screen shows comes in two steps: at once what a list on the page knew of the title (`known`), then its
// card from `/api/title-cards` (members GET, guests POST their browser's progress; the answer is never stored by a
// cache). The person's marks (Want to See, Seen, their score) are the page's own user data, a guest's from their
// browser, so a key says what is the moment it is pressed.
//
// The effects: Want to See and the rating are the mutations every title surface uses, and work for a guest. Seen
// is a member's: the server refuses a guest's watch, and a guest's score counts as Seen. Watch leaves through the
// TV (ui/living-room/tv-transition.ts) and asks the title's page to highlight its streaming block, in the history
// entry's state.
//
// None of this is in the page's first view: the hook runs in `TitleData` (screens/Title.tsx), which arrives with
// the title screen's chunk and reports up to the scene (`TvTitleReport`). The scene imports this file's types
// only.
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
import { useTvTitleExtras } from "./use-tv-extras"
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
} from "./tv-title"

async function fetchCards(
	keys: number[],
	member: boolean,
	language: string,
): Promise<TitleCardsAnswer> {
	const response = await fetch(
		mediaLanguageUrl(`/api/title-cards?keys=${keys.join(",")}`, language),
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

/** What the title's data component reports up to the scene. */
export type TvTitleReport = {
	/** The title the title screen and the rating show. */
	title: TvTitleOnScreen | null
	/** Its name, for its page's address in the machine's context, once anything knows it. */
	titleName: string | null
	/** Carries out an effect of the machine that is the title's; answers whether it was. */
	onEffect: (effect: TvEffect) => boolean
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
}): TvTitleReport {
	const key =
		screen.name === "title" || screen.name === "rate" ? screen.title : null
	const panel = screen.name === "title" ? screen.panel : undefined
	const group = screen.name === "title" ? screen.group : undefined
	const ref = useMemo(() => (key ? parseTvTitleKey(key) : null), [key])
	const { locale } = useLocale()
	const cards = useQuery({
		queryKey: [
			"tv-title-card",
			member ? "member" : "guest",
			key,
			locale.language,
		],
		enabled: Boolean(ref),
		queryFn: () =>
			fetchCards(
				ref ? [titleKey(ref.mediaType, ref.tmdbId)] : [],
				member,
				locale.language,
			),
	})
	const extras = useTvTitleExtras(key)
	const card = cards.data?.cards[0] ?? null
	const mine = cards.data?.services
	const { data: marks } = useUserData()

	const title: TvTitleOnScreen | null = useMemo(() => {
		if (!key || !ref) return null
		const shown = card ?? known(key)
		const mediaKey = `${ref.mediaType}-${ref.tmdbId}` as const
		return {
			key,
			extras: extras.data,
			extrasFailed: extras.isError,
			panel,
			group,
			title: shown,
			missing: Boolean(cards.data) && !card,
			mine: mine ?? [],
			// Until the person's marks are read, the card says what it knew of them.
			want: marks ? mediaKey in marks.wishlist : (shown?.wantToSee ?? false),
			seen: marks ? isSeen(marks, mediaKey) : (shown?.seen ?? false),
			score: marks?.scores[mediaKey]?.score ?? null,
		}
	}, [
		key,
		ref,
		card,
		mine,
		known,
		marks,
		cards.data,
		extras.data,
		extras.isError,
		panel,
		group,
	])

	const leave = useLeaveThroughTv()
	const { mutate: setWish } = useWishlistMutation()
	const { mutate: setWatched } = useWatchedMutation()
	const { mutate: setScore } = useScoreMutation()
	// Who stores what is the browser's session, as the mutations themselves decide it.
	const signedIn = Boolean(useUser().user)
	const latest = useRef({ title, marks, signedIn })
	latest.current = { title, marks, signedIn }

	const onEffect = useCallback(
		(effect: TvEffect): boolean => {
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
					// Where to watch is the fallback when no direct offer link is available.
					if (!shown) return true
					const href = watchHref(effect.title, {
						titleName: canonicalMediaTitle(shown),
					})
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

	// The same object while nothing changed: every new one is another render of the scene (`useReport`).
	const titleName = title?.title ? canonicalMediaTitle(title.title) : null
	return useMemo(
		() => ({ title, titleName, onEffect }),
		[title, titleName, onEffect],
	)
}
