// Binds the answer's acknowledgement (score-ack.ts) to time and to the save. One per page or screen that asks one
// title at a time; the page draws what `state` says with `ScoreChoices`'s `acknowledged` and the `score-ack-*`
// classes of main.css, so the web and the TV look and move the same.
import { useCallback, useEffect, useRef, useState } from "react"
import { scoreLabels } from "~/utils/ratings"
import {
	ACK_FAILED,
	type AckAnswer,
	type AckState,
	IDLE,
	ackLeaving,
	ackScore,
	ackTransition,
	pressesButtonAgain,
	takesPress,
} from "./score-ack"

const now = () => performance.now()

export function useScoreAck() {
	const [state, setState] = useState<AckState>(IDLE)
	// The state as of the last event, also before React draws it: two presses in one tick see each other.
	const latest = useRef<AckState>(IDLE)
	const timer = useRef<ReturnType<typeof setTimeout>>()
	// Each answer's run. A save or a hold that belongs to an earlier run (the page went away, or it was cancelled)
	// changes nothing when it ends.
	const run = useRef(0)
	const send = useCallback((event: Parameters<typeof ackTransition>[1]) => {
		latest.current = ackTransition(latest.current, event)
		setState(latest.current)
	}, [])

	// A held Enter or Space presses a focused score button again on every repeat of its keydown, and after the hold
	// that press would answer the next title. Taken before the page sees it, so only a new press answers.
	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			if (pressesButtonAgain(event, event.target as HTMLElement | null))
				event.preventDefault()
		}
		window.addEventListener("keydown", onKey, true)
		return () => window.removeEventListener("keydown", onKey, true)
	}, [])

	// Leaving the page or the screen ends the hold: the score is saved anyway, and nothing moves on later.
	useEffect(
		() => () => {
			clearTimeout(timer.current)
			run.current += 1
		},
		[],
	)

	/**
	 * Answers the title with `key`: lights the answer, runs `save`, and once it is saved and the hold is over runs
	 * `next`. A failed save keeps the title. Returns false when the press is not taken (an answer is on its way or
	 * held).
	 */
	const answer = useCallback(
		(
			key: string,
			given: AckAnswer,
			save: () => Promise<unknown>,
			next: () => void,
		) => {
			if (!takesPress(latest.current)) return false
			const mine = ++run.current
			send({ type: "press", key, answer: given, at: now() })
			save().then(
				() => {
					if (mine !== run.current) return
					send({ type: "saved", at: now() })
					const held = latest.current
					if (held.phase !== "held") return
					timer.current = setTimeout(
						() => {
							if (mine !== run.current) return
							send({ type: "done" })
							next()
						},
						Math.max(0, held.until - now()),
					)
				},
				() => {
					if (mine === run.current) send({ type: "failed" })
				},
			)
			return true
		},
		[send],
	)

	/**
	 * After a failed save of the title with `key`: on to the next title (`next`) without saving. Returns false when
	 * nothing failed for that title.
	 */
	const pass = useCallback(
		(key: string, next: () => void) => {
			const state = latest.current
			if (state.phase !== "failed" || state.key !== key) return false
			clearTimeout(timer.current)
			run.current += 1
			send({ type: "pass" })
			next()
			return true
		},
		[send],
	)

	/** Ends whatever is on its way or held, without moving on. */
	const cancel = useCallback(() => {
		clearTimeout(timer.current)
		run.current += 1
		send({ type: "cancel" })
	}, [send])

	return { state, answer, pass, cancel, busy: !takesPress(state) }
}

export type ScoreAck = ReturnType<typeof useScoreAck>

/** What the page shows of an answer for the title with `key`. */
export function ackView(state: AckState, key: string | null) {
	const mine = state.phase !== "idle" && state.key === key
	return {
		/** The score to light as chosen, before and after it is saved, and after it failed to. */
		score: ackScore(state, key),
		/** The answer is saved and held: the title is on its way out. */
		leaving: ackLeaving(state, key),
		/** The line under the title: what was given, or that it could not be saved. */
		line: !mine
			? null
			: state.phase === "failed"
				? ACK_FAILED
				: state.answer.kind === "skip"
					? "Not seen · next title"
					: `Scored ${state.answer.score} · ${scoreLabels[state.answer.score]}`,
		failed: mine && state.phase === "failed",
	}
}
