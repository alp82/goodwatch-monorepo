// What happens between answering "How was it?" and the next title, on every page that asks one title at a time:
// /taste/quiz, the Taste page's start and the TV's Taste. The chosen score lights at once and the line under the
// title says what was given ("Scored 8 · Great"). The answer is saved; once it is, the light holds until
// `ACK_MS` after the press, then the next title comes in. A save that fails keeps the title and the chosen answer
// lit, says so (`ACK_FAILED`, the same words on every page), and takes a new answer, or goes on to the next title
// without saving (`pass`), so a save the server keeps turning down never holds the person on one title. While an answer is on its way or held, another press changes nothing, so a quick second press never
// scores the next title.
//
// A pure state machine, so the tests run it as it is: `use-score-ack.ts` binds it to time and to the save.
import type { Score } from "~/server/scores.server"

/** How long the chosen answer stays lit, from the press, before the next title. */
export const ACK_MS = 700

/** What every page says when an answer could not be saved. */
export const ACK_FAILED = "Couldn't save. Try again, or go to the next title."

/** An answer to "How was it?": a score (a level gives its own score), "Haven't seen it", or "Not interested". */
export type AckAnswer =
	| { kind: "score"; score: Score }
	| { kind: "skip" }
	| { kind: "not-interested" }

export type AckState =
	| { phase: "idle" }
	/** The answer is being saved. `key` is the title's, `at` the press's time in ms. */
	| { phase: "saving"; key: string; answer: AckAnswer; at: number }
	/** Saved: the answer stays lit until `until`. */
	| { phase: "held"; key: string; answer: AckAnswer; until: number }
	/** The save failed: the title stays, and a new answer is taken. */
	| { phase: "failed"; key: string; answer: AckAnswer }

export const IDLE: AckState = { phase: "idle" }

export type AckEvent =
	| { type: "press"; key: string; answer: AckAnswer; at: number }
	| { type: "saved"; at: number }
	| { type: "failed" }
	/** The hold ended: the next title takes this one's place. */
	| { type: "done" }
	/** After a failed save: the next title takes this one's place, its answer not saved. */
	| { type: "pass" }
	/** The page or screen went away, or the title changed under the answer. */
	| { type: "cancel" }

/** Whether a press is taken now. A failed save takes a new one; a save on its way or a hold does not. */
export const takesPress = (state: AckState) =>
	state.phase === "idle" || state.phase === "failed"

export function ackTransition(state: AckState, event: AckEvent): AckState {
	switch (event.type) {
		case "press":
			return takesPress(state)
				? { phase: "saving", key: event.key, answer: event.answer, at: event.at }
				: state
		case "saved":
			return state.phase === "saving"
				? {
						phase: "held",
						key: state.key,
						answer: state.answer,
						until: Math.max(event.at, state.at + ACK_MS),
					}
				: state
		case "failed":
			return state.phase === "saving"
				? { phase: "failed", key: state.key, answer: state.answer }
				: state
		case "done":
			return state.phase === "held" ? IDLE : state
		case "pass":
			return state.phase === "failed" ? IDLE : state
		case "cancel":
			return IDLE
	}
}

/**
 * The score to show as chosen while an answer is on its way or held, or failed to save (it stays as chosen, so
 * the person sees what they gave), for the title with `key`.
 */
export function ackScore(state: AckState, key: string | null): Score | null {
	if (state.phase === "idle" || state.key !== key) return null
	return state.answer.kind === "score" ? state.answer.score : null
}

/** The title is on its way out: its answer is saved and held. */
export const ackLeaving = (state: AckState, key: string | null) =>
	state.phase === "held" && state.key === key

/**
 * A key the person is holding down: the browser repeats its keydown. It never answers, on any page that asks one
 * title at a time, so a held key can't score the title after the hold. A new answer needs the key let go and
 * pressed again.
 */
export const isRepeatPress = (event: Pick<KeyboardEvent, "repeat">) =>
	event.repeat === true

/**
 * Whether a repeated keydown would press the button it lands on: Enter and Space activate a focused button, and
 * the browser presses it again on every repeat. Not in a text field, where a held key types.
 */
export function pressesButtonAgain(
	event: Pick<KeyboardEvent, "repeat" | "key">,
	target: { tagName?: string; isContentEditable?: boolean } | null,
): boolean {
	if (!isRepeatPress(event) || (event.key !== "Enter" && event.key !== " ")) return false
	const tag = target?.tagName?.toUpperCase()
	if (!tag || target?.isContentEditable) return false
	return tag === "BUTTON" || tag === "A" || tag === "SUMMARY"
}
