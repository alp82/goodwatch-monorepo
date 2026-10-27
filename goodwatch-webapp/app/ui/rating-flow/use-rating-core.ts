// The rating flow's core, shared by /taste/quiz (use-rating-flow.ts) and the living room TV (living-room/tv/
// use-tv-taste.ts), so the two can't diverge: the title queue from smart-titles without the titles the person answered
// before, the answers saved through useTasteScoring (guest progress for guests, the account for members) with the
// shared acknowledgement (ui/scoring/score-ack.ts), and the totals and milestones (flow.ts). `useFlowPicks` adds the
// picks the person's scores make. Each surface draws from what these return, in its own layout.
import { useCallback, useEffect, useMemo, useReducer, useRef } from "react"
import { fetchSmartTitles } from "~/routes/api.smart-titles"
import { useUserData } from "~/routes/api.user-data"
import type { Score } from "~/server/scores.server"
import {
	useProductAnalytics,
	useProductExposure,
} from "~/telemetry/useProductAnalytics"
import { ACK_FAILED, type AckAnswer } from "~/ui/scoring/score-ack"
import type { ScoringMedia } from "~/ui/scoring/types"
import { ackView, useScoreAck } from "~/ui/scoring/use-score-ack"
import { accountAnsweredKeys, excludeIdsFor } from "~/ui/taste/answered"
import { useTasteScoring } from "~/ui/taste/hooks/useTasteScoring"
import { useTitleQueue } from "~/ui/taste/hooks/useTitleQueue"
import { useKeptCards } from "~/ui/title-actions/hide-feedback"
import { canGuestRate } from "~/utils/guest-progress"
import { useHydrated } from "~/utils/hydrated"
import useLocale from "~/utils/locale"
import { titleKey } from "~/utils/title-key"
import {
	INITIAL_FLOW,
	isReady,
	justLanded,
	litMilestone,
	nextStep,
	ratingFlow,
	tally as tallyOf,
} from "./flow"
import { usePicks } from "./use-picks"
import { WORDS } from "./words"

const keyOf = (i: { media_type: string; tmdb_id: number }) =>
	`${i.media_type}-${i.tmdb_id}`

/** What the line under the title says while an answer is on its way, held, or failed to save. */
function answerLine(
	answer: AckAnswer,
	failed: boolean,
	scoreLine: string | null,
) {
	if (failed) return ACK_FAILED
	if (answer.kind === "skip") return `${WORDS.unseen}. ${WORDS.unseenHint}`
	if (answer.kind === "not-interested")
		return `${WORDS.notInterested}. ${WORDS.notInterestedHint}`
	return scoreLine
}

/** The answer just given, short: "Scored 8 · Great", "Haven't seen it", "Not interested" (the phone TV's header). */
function answerShort(answer: AckAnswer, scoreLine: string | null) {
	if (answer.kind === "skip") return WORDS.unseen
	if (answer.kind === "not-interested") return WORDS.notInterested
	return scoreLine
}

export function useRatingCore({
	titles,
	member,
	enabled = true,
	tasteOpen,
	exposure,
	source,
}: {
	/** The first titles to ask about, from smart-titles. */
	titles: ScoringMedia[]
	member: boolean
	/** False holds back the title fetch (the TV holds the core on screens that don't ask). */
	enabled?: boolean
	/** The taste is on show: the milestone has been seen. */
	tasteOpen: boolean
	/** "taste quiz started" fires once per key; null while the flow is not on show. */
	exposure: string | null
	/** The analytics source: "rating_flow" on the web, "tv_rating_flow" on the TV. */
	source: string
}) {
	const track = useProductAnalytics({ source })
	useProductExposure("taste quiz started", exposure, { source })
	const { interactions, addScore, saveScore, saveSkip, saveNotInterested } =
		useTasteScoring({ isAuthenticated: member })
	// A member's account, or a guest's browser progress in the same shape.
	const { data: userData } = useUserData()
	const hydrated = useHydrated()
	const { locale } = useLocale()

	// ---------------------------------------------------------------- totals and milestones

	// Every score the person holds: a guest's are in this browser (read after hydration), a member's on the account
	// (the score mutation puts a new one in at once).
	const known = member ? userData !== undefined : hydrated
	const scores = userData?.scores
	const totals = useMemo(
		() => tallyOf(Object.values(scores ?? {}).map((s) => s?.score)),
		[scores],
	)
	const [state, send] = useReducer(ratingFlow, INITIAL_FLOW)
	useEffect(() => {
		if (known) send({ type: "tally", tally: totals })
	}, [known, totals])
	useEffect(() => {
		if (tasteOpen) send({ type: "taste-opened" })
	}, [tasteOpen])
	const milestoneAt = state.milestone?.rated
	const milestoneKind = state.milestone?.kind
	useEffect(() => {
		if (milestoneAt == null) return
		track("taste quiz completed", {
			rating_count: milestoneAt,
			milestone: milestoneKind,
		})
	}, [milestoneAt, milestoneKind, track])

	// ---------------------------------------------------------------- the titles to ask about

	// Every title the person has answered (scored, Haven't seen it, Not interested, Want to See, watched): never asked
	// again, also after the flow mounts again.
	const answeredKeys = useMemo(() => {
		const keys = accountAnsweredKeys(userData)
		for (const i of interactions) keys.add(keyOf(i))
		return keys
	}, [userData, interactions])
	// This visit's answers (all of a guest's in this browser), oldest first, for the request for more titles; the
	// server leaves out a member's account itself. Read when the request is sent, so a new answer doesn't make a new
	// fetcher (which would fetch again at once).
	const answeredInOrder = useRef<string[]>([])
	answeredInOrder.current = [...interactions]
		.sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0))
		.map(keyOf)
	// A new fetcher when `enabled` turns true makes the queue ask again.
	const fetchMoreTitles = useCallback(
		(queued: readonly string[]) =>
			enabled
				? fetchSmartTitles({
						count: 20,
						language: locale.language,
						excludeIds: excludeIdsFor(answeredInOrder.current, queued),
					})
				: Promise.resolve([] as ScoringMedia[]),
		[enabled, locale.language],
	)
	const queue = useTitleQueue({
		initialTitles: titles,
		isAuthenticated: member,
		interactions,
		answeredKeys,
		fetchMoreTitles,
		prefetchThreshold: 5,
		batchSize: 20,
	})

	// Titles met in this flow, for the rows of Your ratings without asking the server for them again.
	const met = useRef(new Map<string, ScoringMedia>())
	for (const t of titles) met.current.set(keyOf(t), t)
	if (queue.current) met.current.set(keyOf(queue.current), queue.current)

	// ---------------------------------------------------------------- answers

	// An answer lights at once, is saved, and holds for a moment before the next title. Presses while it is on its
	// way or held change nothing; a failed save keeps the title and offers the next one.
	const ack = useScoreAck()
	const title = queue.current
	// The queue can fill before the person's marks arrive: step past titles already answered, but not the one whose
	// answer was just given (it stays while held or failed, and the hold moves on).
	const answering =
		ack.state.phase !== "idle" && title && ack.state.key === keyOf(title)
	useEffect(() => {
		if (title && !answering && answeredKeys.has(keyOf(title))) queue.advance()
	}, [title, answering, answeredKeys, queue.advance])

	const rate = useCallback(
		(score: Score) => {
			if (!title || ack.busy) return
			if (!member && !canGuestRate(title.media_type, title.tmdb_id)) {
				addScore(title, score) // Raises the guest limit prompt, as everywhere.
				return
			}
			ack.answer(
				keyOf(title),
				{ kind: "score", score },
				() => saveScore(title, score),
				queue.advance,
			)
		},
		[title, member, addScore, saveScore, queue.advance, ack],
	)
	const unseen = useCallback(() => {
		if (!title || ack.busy) return
		ack.answer(
			keyOf(title),
			{ kind: "skip" },
			() => saveSkip(title),
			queue.advance,
		)
	}, [title, saveSkip, queue.advance, ack])
	const notInterested = useCallback(() => {
		if (!title || ack.busy) return
		ack.answer(
			keyOf(title),
			{ kind: "not-interested" },
			() => saveNotInterested(title),
			queue.advance,
		)
	}, [title, saveNotInterested, queue.advance, ack])
	/** After a failed save: on to the next title without saving the answer. */
	const pass = useCallback(() => {
		if (title) ack.pass(keyOf(title), queue.advance)
	}, [title, ack, queue.advance])

	const shown = ackView(ack.state, title ? keyOf(title) : null)
	const given =
		ack.state.phase !== "idle" && title && ack.state.key === keyOf(title)
			? ack.state.answer
			: null
	const answered = {
		...shown,
		/** Whether an answer is on its way or held: the marks wait. */
		busy: ack.busy,
		/** What was given, in full, or that it could not be saved. */
		line: given ? answerLine(given, shown.failed, shown.line) : null,
		/** What was given, in a few words; null after a failed save (`line` says so). */
		short: given && !shown.failed ? answerShort(given, shown.line) : null,
	}

	return {
		member,
		/** Totals known yet: until then the strips stay empty rather than say 0. */
		tally: state.tally,
		ready: state.tally ? isReady(state.tally) : false,
		next: state.tally ? nextStep(state.tally, state.lastMilestoneAt) : null,
		lit: litMilestone(state),
		landed: justLanded(state),
		title,
		answered,
		loadingTitles: !title && queue.isLoading,
		/** No title because asking for more failed (not because there are none left). */
		titlesFailed: !title && queue.failed,
		retryTitles: queue.retry,
		rate,
		unseen,
		notInterested,
		pass,
		/** Ends an answer on its way or held without moving on (the TV leaves its rating screen). */
		cancel: ack.cancel,
		/** Every score the person holds, by title key. */
		scores,
		interactions,
		answeredKeys,
		/** Titles met in this flow by key, so Your ratings asks the server only for older ones. */
		met: met.current,
	}
}

export type RatingCore = ReturnType<typeof useRatingCore>

/**
 * The picks the person's scores make, while `enabled`. Picks come from every score the person holds. Guests send
 * their other marks along; a member's account is left out here (the recommendations can't see it, and it can be
 * long). Not interested on a pick takes it out at once; its card stays in place under its cover with Undo.
 */
export function useFlowPicks(
	core: Pick<RatingCore, "scores" | "interactions" | "answeredKeys">,
	enabled: boolean,
) {
	const { scores, interactions, answeredKeys } = core
	const scored = useMemo(
		() =>
			Object.entries(scores ?? {}).flatMap(([key, value]) => {
				const [media_type, id] = key.split("-")
				return value?.score
					? [
							{
								media_type: media_type as "movie" | "show",
								tmdb_id: Number(id),
								score: value.score,
							},
						]
					: []
			}),
		[scores],
	)
	const exclude = useMemo(
		() =>
			interactions
				.filter((i) => i.type !== "score")
				.map((i) => ({ media_type: i.media_type, tmdb_id: i.tmdb_id })),
		[interactions],
	)
	const { picks: listed, isLoading } = usePicks({
		scored,
		exclude,
		hide: answeredKeys,
		enabled,
	})
	const keyed = useMemo(
		() =>
			listed.map((pick) => ({
				key: titleKey(pick.media_type, pick.tmdb_id),
				pick,
			})),
		[listed],
	)
	const { cards, keeper } = useKeptCards(keyed)
	const picks = useMemo(() => cards.map((c) => c.pick), [cards])
	return { picks, picksKeeper: keeper, picksLoading: isLoading }
}
