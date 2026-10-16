// Taste's three states, what its screens say, the machine's context for them, and the quiz's write path.
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type { Score } from "~/server/scores.server"
import type {
	PortraitTitle,
	Side,
	SidesView,
} from "~/server/taste-portrait/view"
import type { ScoringMedia } from "~/ui/scoring/types"
import type { QuizPick } from "~/ui/taste-quiz/use-quiz-picks"
import {
	EMPTY_CONTEXT,
	STRIP_LEVELS,
	STRIP_SCORES,
	type TvContext,
	type TvEffect,
	type TvScreen,
	readTvState,
	transition,
	tvItems,
} from "./tv-machine.ts"
import {
	type TvTasteScreens,
	carryOutQuiz,
	pickListTitle,
	portraitListTitle,
	quizTitle,
	quizWords,
	sideLine,
	sidesCrumb,
	startWords,
	tasteContext,
	tasteKnown,
	tasteState,
	tvSides,
} from "./tv-taste.ts"

const title = (
	key: number,
	mediaType: "movie" | "show",
	tmdbId: number,
	rest: Partial<PortraitTitle> = {},
): PortraitTitle => ({
	key: key as PortraitTitle["key"],
	mediaType,
	anime: false,
	tmdbId,
	title: `Title ${tmdbId}`,
	year: 2019,
	poster: `/poster-${tmdbId}.jpg`,
	backdrop: `/backdrop-${tmdbId}.jpg`,
	score: 86.4,
	mine: 8,
	match: null,
	onMyServices: null,
	reasons: [],
	services: null,
	...rest,
})

const side = (
	id: string,
	name: string,
	here: number[],
	rest: Partial<Side> = {},
) =>
	({
		id,
		name,
		attributes: [
			{ key: "slow_burn", label: "Slow burn" },
			{ key: "crime", label: "Crime" },
			{ key: "moral_ambiguity", label: "Moral ambiguity" },
			{ key: "tension", label: "Tension" },
		],
		average: 8.2,
		here,
		image: here[0] ?? null,
		edges: [],
		moreOfThis: [],
		...rest,
	}) as Side

const titles: Record<string, PortraitTitle> = Object.fromEntries(
	[
		title(1, "show", 95480),
		title(2, "show", 1427, { mine: 9, backdrop: null }),
		title(3, "movie", 388),
		title(4, "movie", 546554, { mine: 7 }),
		title(5, "movie", 346648),
		title(6, "movie", 329865, { mine: null, match: 91 }),
	].map((one) => [String(one.key), one]),
)

const view = (
	rest: Partial<SidesView> = {},
	kind: SidesView["subject"]["kind"] = "guest",
): SidesView => ({
	tab: "sides",
	subject: { kind, rated: 12, usual: 7.1 },
	status: "ready",
	titles,
	sides: [
		side("dark-crime", "Slow-burning crime stories", [1, 2, 3, 4, 5]),
		side("gentle-comedy", "Warm comedies", [5], { image: null }),
		side("big-ideas", "Mind-bending futures", [6, 99]),
	],
	headline: null,
	openFirst: "dark-crime",
	hasServices: false,
	services: [],
	...rest,
})

describe("Taste's three states", () => {
	it("sides, when the portrait has the person's own", () => {
		assert.equal(tasteState(view(), 12), "sides")
		assert.equal(tasteState(view({}, "member"), 40), "sides")
		// Sides do not depend on how many scores the browser counts.
		assert.equal(tasteState(view(), 0), "sides")
	})

	it("start under five scores: no portrait, the sample taste, or no sides yet", () => {
		assert.equal(tasteState(null, 0), "start")
		assert.equal(tasteState(null, 4), "start")
		assert.equal(tasteState(view({}, "sample"), 3), "start")
		assert.equal(tasteState(view({ status: "empty", sides: [] }), 4), "start")
		assert.equal(
			tasteState(view({ status: "unavailable", sides: [] }), 2),
			"start",
		)
	})

	it("picks from five scores on, while there are no sides", () => {
		assert.equal(tasteState(view({ status: "empty", sides: [] }), 5), "picks")
		assert.equal(
			tasteState(view({ status: "empty", sides: [] }, "member"), 30),
			"picks",
		)
		// The portrait did not come, or the title snapshot is not loaded yet.
		assert.equal(tasteState(null, 5), "picks")
		assert.equal(
			tasteState(view({ status: "unavailable", sides: [] }), 9),
			"picks",
		)
	})

	it("never shows the sample taste's sides as the person's", () => {
		assert.equal(tasteState(view({}, "sample"), 0), "start")
		// Five scores of which the portrait could read fewer: the answer is the sample.
		assert.equal(tasteState(view({}, "sample"), 5), "picks")
	})

	it("a ready portrait without a side is no sides", () => {
		assert.equal(tasteState(view({ sides: [] }), 8), "picks")
	})
})

describe("the sides on the TV", () => {
	const sides = tvSides(view())

	it("are the portrait's, in its order, with name, line and picture", () => {
		assert.deepEqual(
			sides.map((one) => [one.id, one.name, one.backdrop]),
			[
				["dark-crime", "Slow-burning crime stories", "/backdrop-95480.jpg"],
				["gentle-comedy", "Warm comedies", null],
				["big-ideas", "Mind-bending futures", "/backdrop-329865.jpg"],
			],
		)
		assert.equal(sides[0].line, "Slow burn, crime, moral ambiguity.")
	})

	it("a side lists up to four titles the person rated, with what a list says of each", () => {
		assert.deepEqual(
			sides[0].titles.map((one) => one.key),
			["show-95480", "show-1427", "movie-388", "movie-546554"],
		)
		assert.deepEqual(sides[0].titles[0], {
			key: "show-95480",
			title: "Title 95480",
			poster: "/poster-95480.jpg",
			backdrop: "/backdrop-95480.jpg",
			facts: "2019 · Show · 86 score · You gave it 8",
		})
		// There can be fewer than four, and a key the view does not hold is left out.
		assert.deepEqual(
			sides[1].titles.map((one) => one.key),
			["movie-346648"],
		)
		assert.deepEqual(
			sides[2].titles.map((one) => one.key),
			["movie-329865"],
		)
	})

	it("are every side of the portrait, five at most", () => {
		const five = view({
			sides: ["a", "b", "c", "d", "e"].map((id) => side(id, id, [1])),
		})
		assert.equal(tvSides(five).length, 5)
		const six = view({
			sides: ["a", "b", "c", "d", "e", "f"].map((id) => side(id, id, [1])),
		})
		assert.equal(tvSides(six).length, 5)
	})

	it("are counted in words: there are two to five, not always three", () => {
		assert.equal(sidesCrumb(2), "Two sides of you")
		assert.equal(sidesCrumb(3), "Three sides of you")
		assert.equal(sidesCrumb(4), "Four sides of you")
		assert.equal(sidesCrumb(5), "Five sides of you")
		assert.equal(sidesCrumb(1), "One side of you")
	})

	it("a side's line is its first three attributes, or nothing", () => {
		assert.equal(sideLine({ attributes: [] }), "")
		assert.equal(
			sideLine({ attributes: [{ key: "a", label: "Absurd humor" }] }),
			"Absurd humor.",
		)
	})
})

describe("what a list says of a title", () => {
	it("a rated title says the person's score, an unseen one its match", () => {
		assert.equal(
			portraitListTitle(title(1, "movie", 603, { mine: 9 })).facts,
			"2019 · Movie · 86 score · You gave it 9",
		)
		assert.equal(
			portraitListTitle(title(1, "movie", 603, { mine: null, match: 91 }))
				.facts,
			"2019 · Movie · 86 score · 91% match",
		)
		assert.equal(
			portraitListTitle(
				title(1, "show", 1399, {
					mine: null,
					match: null,
					score: null,
					year: null,
				}),
			).facts,
			"Show",
		)
	})

	it("one of the quiz's picks says its year, kind, score and match", () => {
		const pick = {
			tmdb_id: 603,
			media_type: "movie",
			title: "The Matrix",
			release_year: "1999",
			poster_path: "/p.jpg",
			backdrop_path: "/b.jpg",
			goodwatch_overall_score_normalized_percent: 86.6,
			match_percentage: 92.4,
		} as QuizPick
		assert.deepEqual(pickListTitle(pick), {
			key: "movie-603",
			title: "The Matrix",
			poster: "/p.jpg",
			backdrop: "/b.jpg",
			facts: "1999 · Movie · 87 score · 92% match",
		})
		assert.equal(
			pickListTitle({
				...pick,
				backdrop_path: "",
				goodwatch_overall_score_normalized_percent: 0,
				match_percentage: 0,
			}).facts,
			"1999 · Movie",
		)
	})
})

describe("what Taste and the quiz say", () => {
	it("before five scores: how many are rated, and Start or Keep rating", () => {
		assert.deepEqual(startWords(0), {
			headline: "Rate 5 titles you've seen.",
			line: "0 of 5 rated. Then GoodWatch knows your taste.",
			key: "Start rating",
		})
		assert.equal(startWords(3).key, "Keep rating")
		assert.match(startWords(3).line, /^3 of 5 rated\./)
		assert.match(startWords(9).line, /^5 of 5 rated\./)
	})

	it("the quiz: the progress toward the goal, then how many are rated", () => {
		const asked = quizTitle({
			tmdb_id: 2316,
			media_type: "show",
			title: "The Office",
			poster_path: "/p.jpg",
			backdrop_path: "/b.jpg",
			release_year: "2005",
		})
		assert.deepEqual(asked, {
			key: "show-2316",
			title: "The Office",
			backdrop: "/b.jpg",
			facts: "2005 · Show",
		})
		assert.deepEqual(quizWords({ rated: 0, title: asked }), {
			kicker: "Taste · 0 of 5 rated",
			line: "2005 · Show. Have you seen it?",
		})
		assert.equal(
			quizWords({ rated: 4, title: asked }).kicker,
			"Taste · 4 of 5 rated",
		)
		assert.equal(
			quizWords({ rated: 7, title: asked }).kicker,
			"Taste · 7 rated",
		)
		assert.equal(quizWords({ rated: 2, title: null }).line, null)
	})

	it("a title without a backdrop or a year still has its words", () => {
		const bare = quizTitle({
			tmdb_id: 1,
			media_type: "movie",
			title: "Bare",
			poster_path: "/p.jpg",
		} as ScoringMedia)
		assert.deepEqual(bare, {
			key: "movie-1",
			title: "Bare",
			backdrop: null,
			facts: "Movie",
		})
	})
})

const screensOf = (
	taste: TvTasteScreens["taste"],
	quiz: Partial<TvTasteScreens["quiz"]> = {},
): TvTasteScreens => ({
	taste,
	quiz: { title: null, waiting: false, rated: 0, ...quiz },
})
const TASTE: TvScreen = { name: "taste", side: null }
const QUIZ: TvScreen = { name: "quiz" }
const asked = {
	key: "show-2316",
	title: "The Office",
	backdrop: null,
	facts: "",
}
const picks = [
	"movie-603",
	"movie-604",
	"show-1399",
	"movie-13",
	"movie-14",
].map((key) => ({ key, title: key, poster: null, backdrop: null, facts: "" }))
const BAR = ["bar:back", "bar:search", "bar:menu"]
const ctxOf = (
	screen: TvScreen,
	shown: TvTasteScreens,
	exactScores = false,
): TvContext => ({
	...EMPTY_CONTEXT,
	...tasteContext(screen, shown),
	exactScores,
})

describe("the machine's context for Taste, and the items it gives", () => {
	it("start, and while the portrait is read: the way into the quiz alone", () => {
		for (const taste of [
			{ state: "start", rated: 2, backdrop: null } as const,
			{ state: "reading" } as const,
		]) {
			const shown = screensOf(taste, { rated: 2 })
			assert.deepEqual(tasteContext(TASTE, shown), {
				taste: false,
				sides: [],
				titles: [],
				quizProgress: 2,
			})
			assert.deepEqual(tvItems(TASTE, ctxOf(TASTE, shown)), [
				"start-quiz",
				"expand",
				...BAR,
			])
		}
	})

	it("sides: each side, then Rate more", () => {
		const shown = screensOf({ state: "sides", sides: tvSides(view()) })
		assert.deepEqual(tvItems(TASTE, ctxOf(TASTE, shown)), [
			"side:dark-crime",
			"side:gentle-comedy",
			"side:big-ideas",
			"start-quiz",
			"expand",
			...BAR,
		])
	})

	it("a side: its titles, and nothing of another's", () => {
		const shown = screensOf({ state: "sides", sides: tvSides(view()) })
		const side: TvScreen = { name: "taste", side: "dark-crime" }
		assert.deepEqual(tvItems(side, ctxOf(side, shown)), [
			"title:show-95480",
			"title:show-1427",
			"title:movie-388",
			"title:movie-546554",
			"expand",
			...BAR,
		])
		const gone: TvScreen = { name: "taste", side: "no-such-side" }
		assert.deepEqual(tvItems(gone, ctxOf(gone, shown)), ["expand", ...BAR])
	})

	it("picks: up to four of the quiz's picks, then Rate more", () => {
		const shown = screensOf({ state: "picks", picks, waiting: false })
		assert.deepEqual(tvItems(TASTE, ctxOf(TASTE, shown)), [
			...picks.slice(0, 4).map((pick) => `title:${pick.key}`),
			"start-quiz",
			"expand",
			...BAR,
		])
		// The picks are no list of a side's screen.
		const side: TvScreen = { name: "taste", side: "dark-crime" }
		assert.deepEqual(tasteContext(side, shown).titles, [])
	})

	it("the quiz: the strip while there is a title to ask about, with exact scores on the desktop", () => {
		const shown = screensOf(
			{ state: "start", rated: 3, backdrop: null },
			{ title: asked, rated: 3 },
		)
		assert.deepEqual(tasteContext(QUIZ, shown), {
			taste: false,
			sides: [],
			titles: ["show-2316"],
			quizProgress: 3,
		})
		const levels = STRIP_LEVELS.map((score) => `level:${score}`)
		assert.deepEqual(tvItems(QUIZ, ctxOf(QUIZ, shown)), [
			...levels,
			"skip",
			...BAR,
		])
		assert.deepEqual(tvItems(QUIZ, ctxOf(QUIZ, shown, true)), [
			...levels,
			...STRIP_SCORES.map((score) => `score:${score}`),
			"skip",
			...BAR,
		])
		const waiting = screensOf(
			{ state: "start", rated: 3, backdrop: null },
			{ waiting: true },
		)
		assert.deepEqual(tvItems(QUIZ, ctxOf(QUIZ, waiting, true)), BAR)
	})

	it("nothing of Taste on another screen", () => {
		const shown = screensOf({ state: "picks", picks, waiting: false })
		assert.deepEqual(tasteContext({ name: "home" }, shown).titles, [])
	})
})

describe("what Taste's lists know of a title", () => {
	it("a side's title and a pick, for the title screen's first paint", () => {
		const sides = screensOf({ state: "sides", sides: tvSides(view()) })
		assert.deepEqual(tasteKnown(sides, "show-1427"), {
			media_type: "show",
			tmdb_id: 1427,
			title: "Title 1427",
			poster_path: "/poster-1427.jpg",
			backdrop_path: null,
		})
		const made = screensOf({ state: "picks", picks, waiting: false })
		assert.equal(tasteKnown(made, "movie-603")?.title, "movie-603")
	})

	it("nothing of a title no list holds", () => {
		const sides = screensOf({ state: "sides", sides: tvSides(view()) })
		assert.equal(tasteKnown(sides, "movie-1"), null)
		assert.equal(
			tasteKnown(
				screensOf({ state: "start", rated: 0, backdrop: null }),
				"movie-603",
			),
			null,
		)
		assert.equal(tasteKnown(sides, "nothing"), null)
	})
})

describe("the quiz's write path", () => {
	/** A quiz that records what it was asked to store. */
	const recorder = () => {
		const stored: (Score | "skip")[] = []
		return {
			stored,
			quiz: {
				rate: (score: Score) => void stored.push(score),
				skip: () => void stored.push("skip"),
			},
		}
	}
	/** Presses an item of the quiz as the TV does, and carries out what the machine names. */
	function press(
		item: string,
		ctx: TvContext,
		quiz: ReturnType<typeof recorder>,
	) {
		const state = readTvState(new URLSearchParams("tv=quiz"), ctx, 1)
		const next = transition(state, { type: "choose", item }, ctx)
		for (const effect of next.effects) carryOutQuiz(effect, quiz.quiz)
		return next
	}
	const shown = screensOf(
		{ state: "start", rated: 0, backdrop: null },
		{ title: asked },
	)

	it("OK on each level stores the level's score: 3, 5, 7 and 9", () => {
		const quiz = recorder()
		for (const score of STRIP_LEVELS)
			press(`level:${score}`, ctxOf(QUIZ, shown), quiz)
		assert.deepEqual(quiz.stored, [3, 5, 7, 9])
	})

	it("an exact score is stored as given", () => {
		const quiz = recorder()
		for (const score of STRIP_SCORES)
			press(`score:${score}`, ctxOf(QUIZ, shown, true), quiz)
		assert.deepEqual(quiz.stored, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
	})

	it("on the phone an exact score is no key: nothing is stored", () => {
		const quiz = recorder()
		press("score:8", ctxOf(QUIZ, shown), quiz)
		assert.deepEqual(quiz.stored, [])
	})

	it("Haven't seen it skips, and stores no score", () => {
		const quiz = recorder()
		const next = press("skip", ctxOf(QUIZ, shown), quiz)
		assert.deepEqual(quiz.stored, ["skip"])
		assert.equal(next.history, "none")
	})

	it("the score that reaches the goal is stored, and the quiz returns to Taste", () => {
		const quiz = recorder()
		const last = screensOf(
			{ state: "start", rated: 4, backdrop: null },
			{ title: asked, rated: 4 },
		)
		const next = press("level:7", ctxOf(QUIZ, last), quiz)
		assert.deepEqual(quiz.stored, [7])
		assert.equal(next.history, "back")
	})

	it("without a title to ask about nothing can be pressed", () => {
		const quiz = recorder()
		const empty = screensOf({ state: "start", rated: 0, backdrop: null })
		press("level:7", ctxOf(QUIZ, empty), quiz)
		press("skip", ctxOf(QUIZ, empty), quiz)
		assert.deepEqual(quiz.stored, [])
	})

	it("is the quiz's alone: another screen's effect is not carried out", () => {
		const quiz = recorder()
		const others: TvEffect[] = [
			{ type: "rate", title: "movie-603", score: 8 },
			{ type: "want-to-see", title: "movie-603" },
			{ type: "sign-in" },
			{ type: "expand", href: "/taste" },
		]
		for (const effect of others)
			assert.equal(carryOutQuiz(effect, quiz.quiz), false)
		assert.deepEqual(quiz.stored, [])
		assert.equal(carryOutQuiz({ type: "quiz-rate", score: 8 }, quiz.quiz), true)
		assert.equal(carryOutQuiz({ type: "quiz-skip" }, quiz.quiz), true)
	})
})
