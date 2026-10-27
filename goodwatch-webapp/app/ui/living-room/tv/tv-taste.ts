// What the TV's Your taste shows, and what Rate titles (the TV's screen of the rating flow, ui/rating-flow) says
// about the title it asks about. Pure, so the three states, the words and the write path stay in one place and have
// tests. The rules are the rating flow's (ui/rating-flow/flow.ts, ~/domain/taste-rules): the taste is ready at
// MIN_LIKED liked titles, and the words are the web's, identical for identical things.
//
// Your taste has three states (the plan's "Mini Taste"):
// - start: the taste isn't ready. "3 more liked to your taste." and Rate titles.
// - sides: their taste has sides, two to five of them (`/api/taste/portrait?tab=sides`, `status: "ready"`). Each
//   is a tile; a side's screen lists the titles of it they rated.
// - picks: the taste is ready and has no sides yet. The flow's picks as a list, "Made for you", with Rate titles.
import type { Score } from "~/server/scores.server"
import type {
	PortraitTitle,
	Side,
	SidesView,
} from "~/server/taste-portrait/view"
import type { ScoringMedia } from "~/ui/scoring/types"
import type { PresentedMedia } from "../../../utils/media-presentation.ts"
import { copyMediaPresentation } from "../../../utils/media-presentation.ts"
import {
	type Milestone,
	type NextStep,
	type Tally,
	isReady,
	nextStep,
	nextStepWords,
	tasteBarWords,
} from "../../rating-flow/flow.ts"
import type { FlowPick } from "../../rating-flow/use-picks.ts"
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
			/** The person's totals; none rated while they are unknown. */
			tally: Tally
			/** The picture of the first title Rate titles will ask about, once it knows it. */
			backdrop: string | null
	  }
	| { state: "sides"; sides: TvSide[] }
	| {
			state: "picks"
			picks: TvListTitle[]
			/** The picks are still on their way. */
			waiting: boolean
	  }

/** The title Rate titles asks about. */
export type TvQuizTitle = PresentedMedia & {
	key: string
	title: string
	/** "2019"; null when unknown. */
	year: string | null
	backdrop: string | null
	poster: string | null
	/** "2019 · Movie". */
	facts: string
}

/** The answer just given for the title (ui/rating-flow/use-rating-core.ts, `answered`). */
export type TvQuizAnswered = {
	score: Score | null
	leaving: boolean
	/** What was given in full ("Haven't seen it. We won't ask about it again."), or that it couldn't be saved. */
	line: string | null
	/** What was given in a few words ("Scored 8 · Great", "Haven't seen it"); null after a failed save. */
	short: string | null
	failed: boolean
}

export const NOT_ANSWERED: TvQuizAnswered = {
	score: null,
	leaving: false,
	line: null,
	short: null,
	failed: false,
}

export type TvQuizOnScreen = {
	/** Null while the titles are on their way, and when there is none left to ask about. */
	title: TvQuizTitle | null
	waiting: boolean
	/** No title because asking for more failed (not because there are none left). */
	failed?: boolean
	/** The person's totals; null until they are known. */
	tally: Tally | null
	/** The next milestone and how far along it is (flow.ts, `nextStep`); null until the totals are known. */
	next: NextStep | null
	/** The milestone Your taste lights amber for (flow.ts, `litMilestone`). */
	lit: Milestone | null
	/** The answer just given: lit at once, held, then the next title (the same as on /taste/quiz). */
	answered: TvQuizAnswered
	/** A guest at the rating limit: sign-up in place of the strip (the rating flow's locked panel). */
	locked?: boolean
}

/** What Your taste, a side's screen and Rate titles draw from. */
export type TvTasteScreens = {
	taste: TvTasteOnScreen
	quiz: TvQuizOnScreen
	/** The milestone's words while Your taste is lit ("Your taste is ready"), for the menu; null otherwise. */
	tasteLit: string | null
}

const tvKey = (mediaType: string, tmdbId: number) => `${mediaType}-${tmdbId}`
const kind = (mediaType: string) => (mediaType === "show" ? "Show" : "Movie")
const join = (parts: (string | number | null | false | undefined)[]) =>
	parts.filter(Boolean).join(" · ")

/**
 * Which of Your taste's states a person is in. `view` is the portrait's answer, or null when it did not come (it is
 * not asked for at all for a guest whose taste isn't ready, who would get the sample taste). `tally` is the person's
 * totals, null while unknown.
 */
export function tasteState(
	view: Pick<SidesView, "status" | "subject" | "sides"> | null,
	tally: Tally | null,
): "start" | "sides" | "picks" {
	// The sample taste is somebody else's: its sides are not the person's.
	if (
		view?.status === "ready" &&
		view.subject.kind !== "sample" &&
		view.sides.length > 0
	)
		return "sides"
	return tally && isReady(tally) ? "picks" : "start"
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

/** One of the flow's picks, as the list "Made for you" shows it. */
export function pickListTitle(pick: FlowPick): TvListTitle {
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

/** The sides as the TV shows them: every one (two to five), each with the titles of it the person rated. */
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

/** The words and the key of Rate titles, wherever a TV screen leads into it. */
export const RATE_TITLES = "Rate titles"

/** What Your taste says before the taste is ready: the next step, as Rate titles' top line says it. */
export function startWords(tally: Tally): {
	headline: string
	line: string
	key: string
} {
	return {
		headline: `${nextStepWords(nextStep(tally, null))}.`,
		line: `${tasteBarWords(tally, null).line}.`,
		key: RATE_TITLES,
	}
}

/** The title Rate titles asks about, from the flow's queue. */
export function quizTitle(title: ScoringMedia): TvQuizTitle {
	return {
		key: tvKey(title.media_type, title.tmdb_id),
		...copyMediaPresentation(title),
		title: title.title,
		year: title.release_year ? String(title.release_year) : null,
		backdrop: title.backdrop_path || null,
		poster: title.poster_path || null,
		facts: join([title.release_year, kind(title.media_type)]),
	}
}

/**
 * What Rate titles says over the title and beside it: the next step on top ("3 more liked to your taste", "4 more
 * to new picks", the web's top strip), what it asks, and the taste key's words (the web's taste bar: "Your taste",
 * amber "Your taste is ready" or "Your picks changed" at a milestone, and the totals).
 */
export function quizWords(
	quiz: Pick<TvQuizOnScreen, "title" | "next" | "lit" | "tally">,
): {
	kicker: string
	line: string | null
	taste: string
	totals: string | null
} {
	const bar = quiz.tally ? tasteBarWords(quiz.tally, quiz.lit) : null
	return {
		kicker: quiz.next ? nextStepWords(quiz.next) : RATE_TITLES,
		line: quiz.title
			? `${quiz.title.facts ? `${quiz.title.facts}. ` : ""}Have you seen it?`
			: null,
		taste: bar?.head ?? tasteBarWords({ rated: 0, liked: 0 }, null).head,
		totals: bar?.line ?? null,
	}
}

/** The title as the phone's header names it, with its year, so "The Office (2005)" never reads as the 2001 one. */
export const quizHeaderName = (title: Pick<TvQuizTitle, "title" | "year">) =>
	title.year ? `${title.title} (${title.year})` : title.title

/**
 * The machine's context for Taste, a side and the quiz: whether there are sides, their ids, and the titles of the
 * list on screen (a side's titles, the quiz's picks, or the one title the quiz asks about).
 */
export function tasteContext(
	screen: TvScreen,
	shown: TvTasteScreens,
): Pick<TvContext, "taste" | "sides" | "titles" | "quizFailed" | "quizLocked"> {
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
		// Only when it failed, so the context is the same as ever otherwise.
		...(screen.name === "quiz" && !quiz.title && quiz.failed
			? { quizFailed: true }
			: {}),
		...(screen.name === "quiz" && quiz.locked ? { quizLocked: true } : {}),
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
 * Carries out the machine's effects of Rate titles with the rating flow's own actions (ui/rating-flow/
 * use-rating-core.ts): a score is stored through `rate` exactly as the strip gave it, "Haven't seen it" through
 * `unseen` and "Not interested" through `notInterested`. Answers whether the effect was Rate titles'. This is the
 * whole write path on the TV, the one /taste/quiz uses, which stores a guest's answer in their browser and a member's
 * on their account. After a save that failed, the "Haven't seen it" key reads "Next title" (screens/Quiz.tsx) and goes
 * on without saving (`pass`).
 */
export function carryOutQuiz(
	effect: TvEffect,
	flow: {
		rate: (score: Score) => void
		unseen: () => void
		notInterested: () => void
		pass?: () => void
		retryTitles?: () => void
		answered?: Pick<TvQuizAnswered, "failed">
	},
): boolean {
	if (effect.type === "quiz-retry") {
		flow.retryTitles?.()
		return true
	}
	if (effect.type === "quiz-rate") {
		flow.rate(effect.score)
		return true
	}
	if (effect.type === "quiz-skip") {
		if (flow.answered?.failed && flow.pass) flow.pass()
		else flow.unseen()
		return true
	}
	if (effect.type === "quiz-not-interested") {
		flow.notInterested()
		return true
	}
	return false
}
