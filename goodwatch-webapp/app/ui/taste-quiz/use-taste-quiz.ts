// Binds the taste quiz flow to the person: the title queue from smart-titles, scores through useTasteScoring (guest
// progress for guests, the account for members), and the picks those scores make. Both the /taste/quiz page and the
// Living room TV render from what this hook returns.
import { useCallback, useEffect, useMemo, useReducer, useState } from "react"
import { fetchSmartTitles } from "~/routes/api.smart-titles"
import { useUserData } from "~/routes/api.user-data"
import type { Score } from "~/server/scores.server"
import type { ScoringMedia } from "~/ui/scoring/types"
import { useTasteScoring } from "~/ui/taste/hooks/useTasteScoring"
import { useTitleQueue } from "~/ui/taste/hooks/useTitleQueue"
import { canGuestRate, readGuestInteractions } from "~/utils/guest-progress"
import {
	type QuizAction,
	initialQuizState,
	pickPages,
	picksOnPage,
	quizTransition,
} from "./quiz-flow"
import { useQuizPicks } from "./use-quiz-picks"

const keyOf = (i: { media_type: string; tmdb_id: number }) =>
	`${i.media_type}-${i.tmdb_id}`

export function useTasteQuiz({
	titles,
	member,
	showPicks = false,
	enabled = true,
	wantPicks = false,
}: {
	/** The first titles to rate, from smart-titles. */
	titles: ScoringMedia[]
	member: boolean
	/** Open on the picks (the return from Continue with Google). */
	showPicks?: boolean
	/** False holds back the title fetch until the quiz shows (the Living room TV mounts this hook on every screen). */
	enabled?: boolean
	/** Fetch the picks now, whatever this hook's own state says (the TV keeps its quiz step in the URL). */
	wantPicks?: boolean
}) {
	const { interactions, addScore, addSkip, addPlanToWatch } = useTasteScoring({
		isAuthenticated: member,
	})
	const { data: userData } = useUserData()

	// Toward the goal: all guest scores (they resume), or a member's scores in this visit.
	const progress = interactions.filter((i) => i.type === "score").length
	const [state, send] = useReducer(
		quizTransition,
		{ progress: 0, member, showPicks },
		initialQuizState,
	)
	// Guest progress lives in this browser, so it is read after hydration.
	useEffect(() => {
		if (member) return
		const scores = readGuestInteractions().filter((i) => i.type === "score")
		send({ type: "resume", progress: scores.length })
	}, [member])
	// Titles scored or added in this visit, newest last, for the "Keep these?" ask.
	const [kept, setKept] = useState<
		{ title: ScoringMedia; score: Score | null }[]
	>([])
	const keep = useCallback(
		(title: ScoringMedia, score: Score | null) =>
			setKept((prev) => [
				...prev.filter((k) => keyOf(k.title) !== keyOf(title)),
				{ title, score },
			]),
		[],
	)

	// A new callback when `enabled` turns true makes the queue fetch again.
	const fetchMoreTitles = useCallback(
		() =>
			enabled
				? fetchSmartTitles({ count: 20 })
				: Promise.resolve([] as ScoringMedia[]),
		[enabled],
	)
	const queue = useTitleQueue({
		initialTitles: titles,
		isAuthenticated: member,
		interactions,
		fetchMoreTitles,
		prefetchThreshold: 5,
		batchSize: 20,
	})

	// Picks come from every score the person has: the account's for members, this device's for guests.
	const scored = useMemo(() => {
		if (member && userData?.scores)
			return Object.entries(userData.scores).map(([key, value]) => {
				const [media_type, id] = key.split("-")
				return {
					media_type: media_type as "movie" | "show",
					tmdb_id: Number(id),
					score: value.score,
				}
			})
		return interactions
			.filter((i) => i.type === "score" && i.score)
			.map((i) => ({
				media_type: i.media_type,
				tmdb_id: i.tmdb_id,
				score: i.score as Score,
			}))
	}, [member, userData?.scores, interactions])
	const exclude = useMemo(
		() =>
			interactions
				.filter((i) => i.type !== "score")
				.map((i) => ({ media_type: i.media_type, tmdb_id: i.tmdb_id })),
		[interactions],
	)
	const { picks, isLoading: picksLoading } = useQuizPicks({
		scored,
		exclude,
		enabled: wantPicks || state.pickedBefore || state.screen !== "quiz",
	})
	const pages = pickPages(picks.length)

	const title = queue.current
	// The queue can fill before guest progress hydrates; step past titles already answered.
	useEffect(() => {
		if (title && interactions.some((i) => keyOf(i) === keyOf(title)))
			queue.advance()
	}, [title, interactions, queue.advance])
	const rate = useCallback(
		(score: Score) => {
			if (!title) return
			if (!member && !canGuestRate(title.media_type, title.tmdb_id)) {
				addScore(title, score) // Raises the guest limit prompt.
				return
			}
			const already = interactions.some(
				(i) => i.type === "score" && keyOf(i) === keyOf(title),
			)
			addScore(title, score)
			keep(title, score)
			queue.advance()
			send({ type: "scored", progress: progress + (already ? 0 : 1) })
		},
		[title, member, interactions, addScore, keep, queue.advance, progress],
	)
	const skip = useCallback(() => {
		if (!title) return
		addSkip(title)
		queue.advance()
	}, [title, addSkip, queue.advance])
	const wantToSee = useCallback(() => {
		if (!title) return
		addPlanToWatch(title)
		keep(title, null)
		queue.advance()
	}, [title, addPlanToWatch, keep, queue.advance])

	const dispatch = useCallback((action: QuizAction) => send(action), [])

	return {
		state,
		screen: state.screen,
		member,
		/** The title being rated; null when the queue is empty. */
		title,
		nextTitle: queue.next,
		loadingTitles: !title && queue.isLoading,
		progress,
		goal: state.goal,
		/** This visit's scores (and Want to See titles, score null), newest last, for the "Keep these?" ask. */
		kept,
		picks,
		pagePicks: picksOnPage(picks, state.page),
		page: Math.min(state.page, pages - 1),
		pages,
		picksLoading,
		rate,
		skip,
		wantToSee,
		showPicks: () => dispatch({ type: "show-picks" }),
		rateMore: () => dispatch({ type: "rate-more", progress }),
		turn: (by: 1 | -1) => dispatch({ type: "turn", by, pages }),
	}
}

export type TasteQuiz = ReturnType<typeof useTasteQuiz>
