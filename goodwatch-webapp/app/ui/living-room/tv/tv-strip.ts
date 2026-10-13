// What the TV's rating strip (RatingStrip.tsx) reads of the focus, and what it says about it. Pure, so the words
// and the rule stay in one place and have tests.
//
// The strip is the app's own score control (ui/title-actions/ScoreControl.tsx) at TV size: the four levels of
// `RATING_LEVELS` from low on the left to high on the right, and under them, on the desktop, the ten exact scores.
// The levels, their scores and their names are read from the app's list, and a score's name from `scoreLabels`.
import { scoreLabels } from "../../../utils/ratings.ts"
import {
	RATING_LEVELS,
	type RatingLevel,
	levelOf,
} from "../../taste-quiz/quiz-flow.ts"

/** Where the focus is on the strip: the level it is in, and the exact score when it is on one. */
export type StripFocus = {
	/** The index of the level in `RATING_LEVELS`. */
	at: number
	level: RatingLevel
	exact: number | null
}

/** The strip's part of the focus, or null while the focus is on another key (the bar, "Haven't seen it"). */
export function stripFocus(focused: string): StripFocus | null {
	const [kind, arg] = focused.split(":")
	const score = Number(arg)
	if ((kind !== "level" && kind !== "score") || !(score >= 1 && score <= 10))
		return null
	const at = levelOf(score)
	return {
		at,
		level: RATING_LEVELS[at],
		exact: kind === "score" ? score : null,
	}
}

/** A score with its name: "8 · Great". */
export const scoreWords = (score: number) => `${score} · ${scoreLabels[score]}`

/**
 * What the focus would give, in words: "Good · OK gives it 7" on a level, "8 · Great" on an exact score. `short`
 * is the phone's, which has one narrow line for it. Null while the focus is not on the strip.
 */
export function stripSays(focused: string, short = false): string | null {
	const on = stripFocus(focused)
	if (!on) return null
	if (on.exact) return scoreWords(on.exact)
	return short
		? `${on.level.name} · gives ${on.level.score}`
		: `${on.level.name} · OK gives it ${on.level.score}`
}

/**
 * How a score's key is lit, as the app's control lights it: the score the focus is on at full colour, the scores
 * of the level the focus is in brighter than the others, and all of them even while the focus is elsewhere.
 */
export function scoreLight(
	score: number,
	focus: StripFocus | null,
): "on" | "lit" | "dim" | "even" {
	if (!focus) return "even"
	if (focus.exact === score) return "on"
	return levelOf(score) === focus.at ? "lit" : "dim"
}
