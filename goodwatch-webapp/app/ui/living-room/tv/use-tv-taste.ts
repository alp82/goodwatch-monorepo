// The person's taste on the TV's Taste, a side's screen and the taste quiz: what the screens show, and the quiz's
// two effects.
//
// What Taste shows comes from two reads.
// - The portrait (`/api/taste/portrait?tab=sides`: members GET, guests POST their browser's progress, the answer
//   is never stored by a cache) says whether there are sides. A guest under five scores is never asked for one:
//   the answer would be the sample taste, which is not theirs. `useTasteRead` holds it.
// - The quiz (`useTasteQuiz`, the hook /taste/quiz runs) holds the titles to ask about and the person's picks. It
//   runs only while it has something to do (`TvTasteRead.quizzes`): on the quiz, and on Taste before there are
//   sides. A person looking at their sides causes none of its requests.
//
// The quiz's scores are writes, and they are the quiz's own: `rate` and `skip` of `useTasteQuiz`, which keep a
// guest's answer in their browser and send a member's to their account (tv-taste.ts, `carryOutQuiz`).
//
// None of this is in the page's first view: the hooks run in `TasteData` (screens/Taste.tsx), which arrives with
// Taste's chunk and reports up to the scene (`TvTasteReport`). The scene imports this file's types only.
import { useQuery } from "@tanstack/react-query"
import { useCallback, useMemo, useRef } from "react"
import { useUserData } from "~/routes/api.user-data"
import type { SidesView } from "~/server/taste-portrait/view"
import type { TasteQuiz } from "~/ui/taste-quiz/use-taste-quiz"
import {
	snapshotGuestProgress,
	useGuestInteractions,
} from "~/utils/guest-progress"
import { QUIZ_GOAL } from "../../taste-quiz/quiz-flow"
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

async function fetchSides(member: boolean): Promise<SidesView> {
	const guest = member ? null : snapshotGuestProgress()
	const response = await fetch(
		PORTRAIT_URL,
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

/** What is read of the person's taste before the quiz comes into it. */
export type TvTasteRead = {
	/** Which of Taste's states the person is in; "reading" while the portrait is on its way. */
	state: TvTasteOnScreen["state"]
	/** The portrait, when it was asked for and came. */
	view: SidesView | null
	/** How many titles the person has scored. */
	scores: number
	/** The quiz has something to do: it is on show, or Taste offers nothing but it or shows its picks. */
	quizzes: boolean
}

export function useTasteRead({
	screen,
	member,
}: {
	screen: TvScreen
	member: boolean
}): TvTasteRead {
	const { data: marks } = useUserData()
	// How many titles the person has scored: a guest's in their browser, a member's on their account. Unknown
	// while a member's marks are on their way.
	const scores = marks ? Object.keys(marks.scores).length : null
	const interactions = useGuestInteractions()

	const asks = member || (scores ?? 0) >= QUIZ_GOAL
	const portrait = useQuery<SidesView>({
		// A guest's taste lives in their browser, so the key is their progress, the Taste page's own key: the page
		// behind the Expand key finds the answer there. A member's is read again when they have scored.
		queryKey: member
			? ["tv-taste-portrait", "member", scores]
			: ["taste-portrait", "sides", interactions],
		// Only while Taste is on show: in the quiz every score would ask again.
		enabled: asks && scores !== null && screen.name === "taste",
		// The last answer stays while a new score recomputes it.
		placeholderData: (previous) => previous,
		queryFn: () => fetchSides(member),
	})
	const view = portrait.data ?? null
	const reading = asks && !view && !portrait.isError
	const state = reading ? "reading" : tasteState(view, scores ?? 0)
	const quizzes =
		screen.name === "quiz" || state === "start" || state === "picks"
	return useMemo(
		() => ({ state, view, scores: scores ?? 0, quizzes }),
		[state, view, scores, quizzes],
	)
}

/** How the quiz runs for what Taste shows: its titles once the person is about to rate, its picks on "picks". */
export const quizOptions = (
	screen: TvScreen,
	read: Pick<TvTasteRead, "state">,
	member: boolean,
) => ({
	titles: [],
	member,
	enabled: screen.name === "quiz" || read.state === "start",
	// The TV shows the picks on Taste, not in the quiz's own flow.
	wantPicks: read.state === "picks",
})

/** What Taste's data component reports up to the scene. */
export type TvTasteReport = {
	/** What Taste, a side's screen and the quiz draw. */
	screens: TvTasteScreens
	/** The machine's context for them. */
	ctx: ReturnType<typeof tasteContext>
	/** What Taste's lists know of a title, for the title screen's first paint. */
	known: (key: string) => TvKnownTitle | null
	/** Carries out an effect of the machine that is the quiz's; answers whether it was. */
	onEffect: (effect: TvEffect) => boolean
}

/** Puts the two reads together. `quiz` is null while the quiz is not running. */
export function useTasteReport(
	screen: TvScreen,
	read: TvTasteRead,
	quiz: TasteQuiz | null,
): TvTasteReport {
	const { state, view } = read
	const rated = Math.max(read.scores, quiz?.progress ?? 0)
	const picks = quiz?.picks
	const picksLoading = quiz?.picksLoading ?? true
	const asked = quiz?.title ?? null
	const next = asked?.backdrop_path || null
	const taste: TvTasteOnScreen = useMemo(() => {
		if (state === "reading") return { state }
		if (state === "start") return { state, rated, backdrop: next }
		if (state === "sides" && view) return { state, sides: tvSides(view) }
		return {
			state: "picks",
			picks: (picks ?? []).slice(0, LIST_TITLES).map(pickListTitle),
			waiting: picksLoading,
		}
	}, [state, rated, next, view, picks, picksLoading])

	const waiting = quiz ? quiz.loadingTitles : true
	const screens: TvTasteScreens = useMemo(
		() => ({
			taste,
			quiz: { title: asked ? quizTitle(asked) : null, waiting, rated },
		}),
		[taste, asked, waiting, rated],
	)

	const latest = useRef({ quiz, screens })
	latest.current = { quiz, screens }
	const onEffect = useCallback((effect: TvEffect) => {
		const now = latest.current.quiz
		// Without a running quiz there is nothing to score: the effect is still the quiz's, and is dropped.
		return carryOutQuiz(effect, now ?? { rate: () => {}, skip: () => {} })
	}, [])
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
