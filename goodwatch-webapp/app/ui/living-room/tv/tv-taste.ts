import type { PresentedMedia } from "../../../utils/media-presentation.ts"
import { copyMediaPresentation } from "../../../utils/media-presentation.ts"
// What the new TV's Taste shows, and what the taste quiz says about the title it asks about. Pure, so the three
// states, the words and the quiz's write path stay in one place and have tests.
//
// Taste has three states (the plan's "Mini Taste"):
// - start: the person has fewer than five scores. "Rate 5 titles you've seen." and the way into the quiz.
// - sides: their taste has sides, two to five of them (`/api/taste/portrait?tab=sides`, `status: "ready"`). Each
//   is a tile; a side's screen lists the titles of it they rated.
// - picks: five scores or more and no sides yet. The quiz's picks as a list, "Made for you", with Rate more.
// A taste is not "five ratings": sides need about five loved titles, so the person's own score count only decides
// between start and picks, never whether there are sides.
import type { Score } from "~/server/scores.server"
import type {
	PortraitTitle,
	Side,
	SidesView,
} from "~/server/taste-portrait/view"
import type { ScoringMedia } from "~/ui/scoring/types"
import type { QuizPick } from "~/ui/taste-quiz/use-quiz-picks"
import { QUIZ_GOAL } from "../../taste-quiz/quiz-flow.ts"
import type { TvListTitle } from "./TitleList.tsx"
import {
	LIST_TITLES,
	TASTE_SIDES,
	type TvContext,
	type TvEffect,
	type TvScreen,
} from "./tv-machine.ts"
import { type TvKnownTitle, parseTvTitleKey } from "./tv-title.ts"

/** One side of the person's taste, as its tile and its screen show it. */
export type TvSide = {
	id: string
	/** "Slow-burning crime stories". */
	name: string
	/** The attributes that set it apart: "Slow burn, crime, moral ambiguity." */
	line: string
	backdrop: string | null
	/** The titles of it the person rated, best first, up to four. */
	titles: TvListTitle[]
}

export type TvTasteOnScreen =
	/** Nobody knows yet which state it is: the portrait is on its way. */
	| { state: "reading" }
	| {
			state: "start"
			rated: number
			/** The picture of the first title the quiz will ask about, once the quiz knows it. */
			backdrop: string | null
	  }
	| { state: "sides"; sides: TvSide[] }
	| {
			state: "picks"
			picks: TvListTitle[]
			/** The picks are still on their way. */
			waiting: boolean
	  }

/** The title the quiz asks about. */
export type TvQuizTitle = PresentedMedia & {
	key: string
	title: string
	backdrop: string | null
	/** "2019 · Movie". */
	facts: string
}

export type TvQuizOnScreen = {
	/** Null while the titles are on their way, and when there is none left to ask about. */
	title: TvQuizTitle | null
	waiting: boolean
	/** The person's scores toward the goal. */
	rated: number
}

/** What Taste, a side's screen and the quiz draw from. */
export type TvTasteScreens = {
	taste: TvTasteOnScreen
	quiz: TvQuizOnScreen
}

const tvKey = (mediaType: string, tmdbId: number) => `${mediaType}-${tmdbId}`
const kind = (mediaType: string) => (mediaType === "show" ? "Show" : "Movie")
const join = (parts: (string | number | null | false | undefined)[]) =>
	parts.filter(Boolean).join(" · ")

/**
 * Which of Taste's states a person is in. `view` is the portrait's answer, or null when it did not come (it is not
 * asked for at all for a guest under five scores, who gets the sample taste). `scores` is how many titles the
 * person has scored.
 */
export function tasteState(
	view: Pick<SidesView, "status" | "subject" | "sides"> | null,
	scores: number,
): "start" | "sides" | "picks" {
	// The sample taste is somebody else's: its sides are not the person's.
	if (
		view?.status === "ready" &&
		view.subject.kind !== "sample" &&
		view.sides.length > 0
	)
		return "sides"
	return scores < QUIZ_GOAL ? "start" : "picks"
}

/** A title of the portrait, as a list shows it. A title the person rated says their score, another its match. */
export function portraitListTitle(title: PortraitTitle): TvListTitle {
	return {
		key: tvKey(title.mediaType, title.tmdbId),
		...copyMediaPresentation(title),
		title: title.title,
		poster: title.poster,
		backdrop: title.backdrop,
		facts: join([
			title.year,
			kind(title.mediaType),
			title.score != null && `${Math.round(title.score)} score`,
			title.mine != null
				? `You gave it ${title.mine}`
				: title.match != null && `${title.match}% match`,
		]),
	}
}

/** One of the quiz's picks, as the list "Made for you" shows it. */
export function pickListTitle(pick: QuizPick): TvListTitle {
	return {
		key: tvKey(pick.media_type, pick.tmdb_id),
		...copyMediaPresentation(pick),
		title: pick.title,
		poster: pick.poster_path || null,
		backdrop: pick.backdrop_path || null,
		facts: join([
			pick.release_year,
			kind(pick.media_type),
			pick.goodwatch_overall_score_normalized_percent > 0 &&
				`${Math.round(pick.goodwatch_overall_score_normalized_percent)} score`,
			pick.match_percentage > 0 &&
				`${Math.round(pick.match_percentage)}% match`,
		]),
	}
}

/** "Slow burn, crime, moral ambiguity.": the first three attributes that set a side apart. */
export function sideLine(side: Pick<Side, "attributes">): string {
	const labels = side.attributes.slice(0, 3).map((a) => a.label.trim())
	if (!labels.length) return ""
	const [first, ...rest] = labels
	return `${[first, ...rest.map((label) => label.toLowerCase())].join(", ")}.`
}

/** The sides as the TV shows them: at most four, each with the titles of it the person rated. */
export function tvSides(view: Pick<SidesView, "sides" | "titles">): TvSide[] {
	return view.sides.slice(0, TASTE_SIDES).map((side) => ({
		id: side.id,
		name: side.name,
		line: sideLine(side),
		backdrop:
			(side.image != null ? view.titles[side.image]?.backdrop : null) ?? null,
		titles: side.here
			.flatMap((key) => view.titles[key] ?? [])
			.slice(0, LIST_TITLES)
			.map(portraitListTitle),
	}))
}

const COUNT = ["No", "One", "Two", "Three", "Four", "Five"]

/** "Three sides of you": there are two to five, not always three. */
export const sidesCrumb = (count: number) =>
	`${COUNT[count] ?? count} ${count === 1 ? "side" : "sides"} of you`

/** What Taste says before the person has five scores. */
export function startWords(rated: number): {
	headline: string
	line: string
	key: string
} {
	const done = Math.min(Math.max(rated, 0), QUIZ_GOAL)
	return {
		headline: `Rate ${QUIZ_GOAL} titles you've seen.`,
		line: `${done} of ${QUIZ_GOAL} rated. Then GoodWatch knows your taste.`,
		key: done ? "Keep rating" : "Start rating",
	}
}

/** The title the quiz asks about, from the quiz's queue. */
export function quizTitle(title: ScoringMedia): TvQuizTitle {
	return {
		key: tvKey(title.media_type, title.tmdb_id),
		...copyMediaPresentation(title),
		title: title.title,
		backdrop: title.backdrop_path || null,
		facts: join([title.release_year, kind(title.media_type)]),
	}
}

/** What the quiz says over the title: how far the person is, and what it asks. */
export function quizWords(quiz: Pick<TvQuizOnScreen, "rated" | "title">): {
	kicker: string
	line: string | null
} {
	return {
		// Past the goal the person is rating more.
		kicker:
			quiz.rated < QUIZ_GOAL
				? `Taste · ${quiz.rated} of ${QUIZ_GOAL} rated`
				: `Taste · ${quiz.rated} rated`,
		line: quiz.title
			? `${quiz.title.facts ? `${quiz.title.facts}. ` : ""}Have you seen it?`
			: null,
	}
}

/**
 * The machine's context for Taste, a side and the quiz: whether there are sides, their ids, and the titles of the
 * list on screen (a side's titles, the quiz's picks, or the one title the quiz asks about).
 */
export function tasteContext(
	screen: TvScreen,
	shown: TvTasteScreens,
): Pick<TvContext, "taste" | "sides" | "titles" | "quizProgress"> {
	const { taste, quiz } = shown
	const sides = taste.state === "sides" ? taste.sides : []
	const titles =
		screen.name === "quiz"
			? quiz.title
				? [quiz.title.key]
				: []
			: screen.name !== "taste"
				? []
				: screen.side
					? (sides.find((side) => side.id === screen.side)?.titles ?? []).map(
							(title) => title.key,
						)
					: taste.state === "picks"
						? taste.picks.map((pick) => pick.key)
						: []
	return {
		taste: taste.state === "sides",
		sides: sides.map((side) => side.id),
		titles,
		quizProgress: quiz.rated,
	}
}

/** What a list of Taste knows of a title before its card is there, for the title screen's first paint. */
export function tasteKnown(
	shown: TvTasteScreens,
	key: string,
): TvKnownTitle | null {
	const { taste } = shown
	const titles =
		taste.state === "sides"
			? taste.sides.flatMap((side) => side.titles)
			: taste.state === "picks"
				? taste.picks
				: []
	const found = titles.find((title) => title.key === key)
	const ref = parseTvTitleKey(key)
	if (!found || !ref) return null
	return {
		media_type: ref.mediaType,
		tmdb_id: ref.tmdbId,
		...copyMediaPresentation(found),
		title: found.title,
		poster_path: found.poster,
		backdrop_path: found.backdrop,
	}
}

/**
 * Carries out the machine's two quiz effects with the quiz's own actions (`useTasteQuiz`): a score is stored
 * through `rate` exactly as the strip gave it, and "Haven't seen it" through `skip`. Answers whether the effect
 * was the quiz's. This is the quiz's whole write path on the TV: `rate` and `skip` are the ones /taste/quiz uses,
 * which store a guest's answer in their browser and a member's on their account.
 */
export function carryOutQuiz(
	effect: TvEffect,
	quiz: { rate: (score: Score) => void; skip: () => void },
): boolean {
	if (effect.type === "quiz-rate") {
		quiz.rate(effect.score)
		return true
	}
	if (effect.type === "quiz-skip") {
		quiz.skip()
		return true
	}
	return false
}
