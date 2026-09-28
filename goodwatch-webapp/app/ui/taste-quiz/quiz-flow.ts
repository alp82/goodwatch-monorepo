// The taste quiz flow, shared by /taste/quiz and the Living room TV.
//
// A pure state machine: one widely seen title at a time, the "Keep these 5?" ask once the person has scored
// `QUIZ_GOAL` titles, then their picks three at a time. Only scores count toward the goal; skips ("Haven't seen it")
// and Want to See don't. Rate more raises the goal by another `QUIZ_GOAL` and keeps the picks page, so Back to my
// picks returns to the same page. The machine never fetches or stores anything; `useTasteQuiz` binds it to the
// person's ratings and picks.
import type { Score } from "~/server/scores.server"

export const QUIZ_GOAL = 5
export const PICKS_PER_PAGE = 3
export const MAX_PICK_PAGES = 4

export type QuizScreen = "quiz" | "keep" | "picks"

export type QuizState = {
	screen: QuizScreen
	/** Scores needed before the next "Keep these?" ask. */
	goal: number
	/** The picks page, zero-based. */
	page: number
	/** Whether the person has seen their picks, which turns the quiz into Rate more. */
	pickedBefore: boolean
}

export type QuizAction =
	/** Guest progress read after hydration: resume where the guest left off. */
	| { type: "resume"; progress: number }
	/** A title was scored; `progress` is the count toward the goal after it. */
	| { type: "scored"; progress: number }
	| { type: "show-picks" }
	/** Back to rating: `progress` is the current count toward the goal. */
	| { type: "rate-more"; progress: number }
	/** Turn the picks page; `pages` is how many pages there are now. */
	| { type: "turn"; by: 1 | -1; pages: number }

/** The next multiple of the goal above `progress`. */
export function nextGoal(progress: number): number {
	return (Math.floor(progress / QUIZ_GOAL) + 1) * QUIZ_GOAL
}

/**
 * Where the quiz starts. A guest who already has `QUIZ_GOAL` scores comes back to Rate more, with their picks
 * behind it; a guest below that resumes where they left off. `showPicks` opens on the picks (the return from
 * Continue with Google).
 */
export function initialQuizState({
	progress,
	member,
	showPicks = false,
}: {
	progress: number
	member: boolean
	showPicks?: boolean
}): QuizState {
	const returning = !member && progress >= QUIZ_GOAL
	return {
		screen: showPicks ? "picks" : "quiz",
		goal: returning ? nextGoal(progress) : QUIZ_GOAL,
		page: 0,
		pickedBefore: showPicks || returning,
	}
}

export function quizTransition(
	state: QuizState,
	action: QuizAction,
): QuizState {
	switch (action.type) {
		case "resume": {
			if (state.pickedBefore || state.screen !== "quiz") return state
			const resumed = initialQuizState({
				progress: action.progress,
				member: false,
			})
			return {
				...state,
				goal: resumed.goal,
				pickedBefore: resumed.pickedBefore,
			}
		}
		case "scored":
			if (state.screen !== "quiz" || action.progress < state.goal) return state
			return { ...state, screen: "keep" }
		case "show-picks":
			return { ...state, screen: "picks", pickedBefore: true }
		case "rate-more":
			return {
				...state,
				screen: "quiz",
				goal: Math.max(state.goal, nextGoal(action.progress)),
			}
		case "turn": {
			const last = Math.max(0, action.pages - 1)
			const page = Math.max(0, Math.min(last, state.page + action.by))
			return page === state.page ? state : { ...state, page }
		}
	}
}

/** How many pages `count` picks fill, at most `MAX_PICK_PAGES`. */
export function pickPages(count: number): number {
	return Math.max(
		1,
		Math.min(MAX_PICK_PAGES, Math.ceil(count / PICKS_PER_PAGE)),
	)
}

/** The picks on `page`, clamped to the last page. */
export function picksOnPage<T>(picks: readonly T[], page: number): T[] {
	const at = Math.min(page, pickPages(picks.length) - 1)
	return picks.slice(at * PICKS_PER_PAGE, at * PICKS_PER_PAGE + PICKS_PER_PAGE)
}

// ---------------------------------------------------------------------------------------------------------
// The rating control: four levels over the ten scores. A level press stores its `score`; a press on the 1-10
// strip stores the exact score.

export type RatingLevel = {
	name: "Dislike" | "Okay" | "Good" | "Excellent"
	lo: Score
	hi: Score
	score: Score
}

export const RATING_LEVELS: readonly RatingLevel[] = [
	{ name: "Dislike", lo: 1, hi: 4, score: 3 },
	{ name: "Okay", lo: 5, hi: 6, score: 5 },
	{ name: "Good", lo: 7, hi: 8, score: 7 },
	{ name: "Excellent", lo: 9, hi: 10, score: 9 },
]

/** The index of the level a score belongs to. */
export function levelOf(score: number): number {
	return RATING_LEVELS.findIndex((level) => score <= level.hi)
}

// ---------------------------------------------------------------------------------------------------------
// Keys: 1-9 score, 0 is 10, S skips, P goes back to the picks, the arrows turn the picks pages.

export type QuizKeyIntent =
	| { type: "score"; score: Score }
	| { type: "skip" }
	| { type: "show-picks" }
	| { type: "turn"; by: 1 | -1 }

export function readQuizKey(
	key: string,
	state: Pick<QuizState, "screen" | "pickedBefore">,
): QuizKeyIntent | null {
	if (state.screen === "quiz") {
		if (/^[0-9]$/.test(key))
			return { type: "score", score: (key === "0" ? 10 : Number(key)) as Score }
		if (key === "s" || key === "S") return { type: "skip" }
		if ((key === "p" || key === "P") && state.pickedBefore)
			return { type: "show-picks" }
		return null
	}
	if (state.screen === "picks") {
		if (key === "ArrowRight") return { type: "turn", by: 1 }
		if (key === "ArrowLeft") return { type: "turn", by: -1 }
	}
	return null
}
