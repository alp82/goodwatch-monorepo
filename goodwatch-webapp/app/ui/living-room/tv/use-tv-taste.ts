// The person's taste on the TV's Your taste, a side's screen and Rate titles: what the screens show, and Rate titles'
// effects.
//
// What Your taste shows comes from two reads.
// - The portrait (`/api/taste/portrait?tab=sides`: members GET, guests POST their browser's progress, the answer
//   is never stored by a cache) says whether there are sides. A guest whose taste isn't ready (~/domain/taste-rules)
//   is never asked for one: the answer would be the sample taste, which is not theirs. `useTasteRead` holds it.
// - The rating flow's core (ui/rating-flow/use-rating-core.ts, the one /taste/quiz runs) holds the titles to ask
//   about, the answers, the totals and the milestones, and its picks. It asks for titles only while it has something
//   to do: on Rate titles, and on Your taste before the taste is ready (the first title is its picture). A person
//   looking at their sides causes none of its requests.
//
// The answers are writes, and they are the flow's own: `rate`, `unseen` and `notInterested` keep a guest's answer in
// their browser and send a member's to their account (tv-taste.ts, `carryOutQuiz`). A milestone never ends Rate
// titles: Your taste lights amber (`lit`) until it is opened or a few more ratings pass.
//
// None of this is in the page's first view: the hooks run in `TasteData` (screens/Taste.tsx), which arrives with
// Your taste's chunk and reports up to the scene (`TvTasteReport`). The scene imports this file's types only.
import { useQuery } from "@tanstack/react-query"
import { useCallback, useEffect, useMemo, useRef } from "react"
import { useUserData } from "~/routes/api.user-data"
import type { SidesView } from "~/server/taste-portrait/view"
import {
	type Tally,
	isReady,
	tally as tallyOf,
	tasteBarWords,
} from "~/ui/rating-flow/flow"
import type { RatingCore, useFlowPicks } from "~/ui/rating-flow/use-rating-core"
import {
	snapshotGuestProgress,
	useGuestInteractions,
} from "~/utils/guest-progress"
import { useHydrated } from "~/utils/hydrated"
import useLocale from "~/utils/locale"
import { mediaLanguageUrl } from "~/utils/media-presentation"
import { LIST_TITLES, type TvEffect, type TvScreen } from "./tv-machine"
import {
	type TvTasteOnScreen,
	type TvTasteScreens,
	carryOutQuiz,
	pickListTitle,
	quizTitle,
	tasteContext,
	tasteKnown,
	tasteState,
	tvSides,
} from "./tv-taste"
import type { TvKnownTitle } from "./tv-title"

const PORTRAIT_URL = "/api/taste/portrait?tab=sides"
const NONE_RATED: Tally = { rated: 0, liked: 0 }
/** The TV asks for its titles itself: none come with the page. One array, so the queue sees no change. */
const NO_TITLES: never[] = []

async function fetchSides(member: boolean, language: string): Promise<SidesView> {
	const guest = member ? null : snapshotGuestProgress()
	const response = await fetch(
		mediaLanguageUrl(PORTRAIT_URL, language),
		guest
			? {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						guest: {
							interactions: guest.interactions,
							country: guest.country,
							services: guest.services,
						},
					}),
				}
			: undefined,
	)
	if (!response.ok) throw new Error(`Taste portrait: ${response.status}`)
	return response.json()
}

/** What is read of the person's taste before the rating flow comes into it. */
export type TvTasteRead = {
	/** Which of Your taste's states the person is in; "reading" while the portrait is on its way. */
	state: TvTasteOnScreen["state"]
	/** The portrait, when it was asked for and came. */
	view: SidesView | null
	/** The person's totals; null while they are unknown. */
	tally: Tally | null
}

export function useTasteRead({
	screen,
	member,
}: {
	screen: TvScreen
	member: boolean
}): TvTasteRead {
	const { locale } = useLocale()
	const { data: marks } = useUserData()
	const hydrated = useHydrated()
	// The person's totals: a guest's in their browser (read after hydration), a member's on their account. Unknown
	// while a member's marks are on their way.
	const known = member ? marks !== undefined : hydrated
	const scores = marks?.scores
	const tally = useMemo(
		() =>
			known
				? tallyOf(Object.values(scores ?? {}).map((s) => s?.score))
				: null,
		[known, scores],
	)
	const interactions = useGuestInteractions()

	const asks = member || (tally ? isReady(tally) : false)
	const portrait = useQuery<SidesView>({
		// A guest's taste lives in their browser, so the key is their progress, the Taste page's own key: the page
		// behind the Expand key finds the answer there. A member's is read again when they have scored.
		queryKey: member
			? ["tv-taste-portrait", "member", tally?.rated ?? null, locale.language]
			: ["taste-portrait", "sides", interactions, locale.language],
		// Only while Your taste is on show: on Rate titles every score would ask again.
		enabled: asks && tally !== null && screen.name === "taste",
		// The last answer stays while a new score recomputes it.
		placeholderData: (previous, query) =>
			query?.queryKey.at(-1) === locale.language ? previous : undefined,
		queryFn: () => fetchSides(member, locale.language),
	})
	const view = portrait.data ?? null
	const reading = asks && !view && !portrait.isError
	const state = reading ? "reading" : tasteState(view, tally)
	return useMemo(() => ({ state, view, tally }), [state, view, tally])
}

/** How the rating flow's core runs for the screen on show: it asks for titles on Rate titles and before the taste is ready. */
export const coreOptions = (
	screen: TvScreen,
	read: Pick<TvTasteRead, "state">,
	member: boolean,
) => ({
	titles: NO_TITLES,
	member,
	enabled: screen.name === "quiz" || read.state === "start",
	tasteOpen: screen.name === "taste",
	exposure: screen.name === "quiz" ? "tv" : null,
	source: "tv_rating_flow",
})

/** What Your taste's data component reports up to the scene. */
export type TvTasteReport = {
	/** What Your taste, a side's screen and Rate titles draw. */
	screens: TvTasteScreens
	/** The machine's context for them. */
	ctx: ReturnType<typeof tasteContext>
	/** What Your taste's lists know of a title, for the title screen's first paint. */
	known: (key: string) => TvKnownTitle | null
	/** Carries out an effect of the machine that is Rate titles'; answers whether it was. */
	onEffect: (effect: TvEffect) => boolean
}

/** Puts the read, the rating flow and its picks together. */
export function useTasteReport(
	screen: TvScreen,
	read: TvTasteRead,
	flow: RatingCore,
	flowPicks: ReturnType<typeof useFlowPicks>,
): TvTasteReport {
	const { state, view } = read
	const tally = flow.tally ?? read.tally
	const { picks, picksLoading } = flowPicks
	const asked = flow.title
	const next = asked?.backdrop_path || null
	const taste: TvTasteOnScreen = useMemo(() => {
		if (state === "reading") return { state }
		if (state === "start")
			return { state, tally: tally ?? NONE_RATED, backdrop: next }
		if (state === "sides" && view) return { state, sides: tvSides(view) }
		return {
			state: "picks",
			picks: picks.slice(0, LIST_TITLES).map(pickListTitle),
			waiting: picksLoading,
		}
	}, [state, tally, next, view, picks, picksLoading])

	const { loadingTitles: waiting, titlesFailed, lit, locked } = flow
	const step = flow.next
	const { score, leaving, line, short, failed } = flow.answered
	const screens: TvTasteScreens = useMemo(
		() => ({
			taste,
			tasteLit:
				lit && flow.tally ? tasteBarWords(flow.tally, lit).head : null,
			quiz: {
				title: asked ? quizTitle(asked) : null,
				waiting,
				failed: titlesFailed,
				tally: flow.tally,
				next: step,
				lit,
				answered: { score, leaving, line, short, failed },
				locked,
			},
		}),
		[
			taste,
			asked,
			waiting,
			titlesFailed,
			flow.tally,
			step,
			lit,
			locked,
			score,
			leaving,
			line,
			short,
			failed,
		],
	)
	// An answer on its way or held belongs to Rate titles on show: leaving it ends the hold. The answer is saved
	// anyway; nothing moves on later, and the answered title is stepped past on the way back.
	const { cancel } = flow
	useEffect(() => {
		if (screen.name !== "quiz") cancel()
	}, [screen.name, cancel])

	const latest = useRef({ flow, screens })
	latest.current = { flow, screens }
	const onEffect = useCallback(
		(effect: TvEffect) => carryOutQuiz(effect, latest.current.flow),
		[],
	)
	const known = useCallback(
		(key: string) => tasteKnown(latest.current.screens, key),
		[],
	)

	const ctx = useMemo(() => tasteContext(screen, screens), [screen, screens])
	// The same object while nothing changed: every new one is another render of the scene (`useReport`).
	return useMemo(
		() => ({ screens, ctx, known, onEffect }),
		[screens, ctx, known, onEffect],
	)
}
