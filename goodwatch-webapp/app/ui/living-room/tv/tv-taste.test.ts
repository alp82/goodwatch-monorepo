// Your taste's three states, what its screens and Rate titles say, the machine's context for them, and Rate titles'
// write path (the rating flow's).
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type { Score } from "~/server/scores.server"
import type {
	PortraitTitle,
	Side,
	SidesView,
} from "~/server/taste-portrait/view"
import type { ScoringMedia } from "~/ui/scoring/types"
import type { Tally } from "~/ui/rating-flow/flow"
import type { FlowPick } from "~/ui/rating-flow/use-picks"
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
	NOT_ANSWERED,
	type TvTasteScreens,
	carryOutQuiz,
	pickListTitle,
	portraitListTitle,
	quizHeaderName,
	quizTitle,
	quizWords,
	sideLine,
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

/** Totals: `rated` scores of which `liked` are 6 or higher. */
const t = (rated: number, liked = rated): Tally => ({ rated, liked })

describe("Your taste's three states", () => {
	it("sides, when the portrait has the person's own", () => {
		assert.equal(tasteState(view(), t(12)), "sides")
		assert.equal(tasteState(view({}, "member"), t(40)), "sides")
		// Sides do not depend on what the browser counts.
		assert.equal(tasteState(view(), t(0)), "sides")
		assert.equal(tasteState(view(), null), "sides")
	})

	it("start until five liked titles: no portrait, the sample taste, or no sides yet", () => {
		assert.equal(tasteState(null, t(0)), "start")
		assert.equal(tasteState(null, null), "start")
		assert.equal(tasteState(null, t(4)), "start")
		assert.equal(tasteState(view({}, "sample"), t(3)), "start")
		assert.equal(tasteState(view({ status: "empty", sides: [] }), t(4)), "start")
		assert.equal(
			tasteState(view({ status: "unavailable", sides: [] }), t(2)),
			"start",
		)
		// Five scores aren't a taste: five liked ones are (the rating flow's rule, ~/domain/taste-rules).
		assert.equal(tasteState(null, t(5, 4)), "start")
		assert.equal(tasteState(null, t(12, 2)), "start")
	})

	it("picks from five liked titles on, while there are no sides", () => {
		assert.equal(tasteState(view({ status: "empty", sides: [] }), t(5)), "picks")
		assert.equal(
			tasteState(view({ status: "empty", sides: [] }, "member"), t(30, 9)),
			"picks",
		)
		// The portrait did not come, or the title snapshot is not loaded yet.
		assert.equal(tasteState(null, t(7, 5)), "picks")
		assert.equal(
			tasteState(view({ status: "unavailable", sides: [] }), t(9)),
			"picks",
		)
	})

	it("never shows the sample taste's sides as the person's", () => {
		assert.equal(tasteState(view({}, "sample"), t(0)), "start")
		// A ready taste of which the portrait could read less: the answer is the sample.
		assert.equal(tasteState(view({}, "sample"), t(5)), "picks")
	})

	it("a ready portrait without a side is no sides", () => {
		assert.equal(tasteState(view({ sides: [] }), t(8)), "picks")
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
		} as FlowPick
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

describe("what Your taste and Rate titles say", () => {
	it("before the taste is ready: the next step in the rating flow's words, the totals, and Rate titles", () => {
		assert.deepEqual(startWords(t(0)), {
			headline: "5 more liked to your taste.",
			line: "0 rated · 0 liked (6 or higher).",
			key: "Rate titles",
		})
		assert.deepEqual(startWords(t(6, 3)), {
			headline: "2 more liked to your taste.",
			line: "6 rated · 3 liked (6 or higher).",
			key: "Rate titles",
		})
		// Scores below 6 bring the taste no closer.
		assert.equal(startWords(t(4, 0)).headline, "5 more liked to your taste.")
	})

	it("Rate titles: the next milestone on top, as the web's top strip says it, and Your taste as the taste bar", () => {
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
			year: "2005",
			backdrop: "/b.jpg",
			poster: "/p.jpg",
			facts: "2005 · Show",
		})
		const liked = { kind: "liked", done: 2, of: 5, left: 3 } as const
		assert.deepEqual(
			quizWords({ title: asked, tally: t(4, 2), next: liked, lit: null }),
			{
				kicker: "3 more liked to your taste",
				line: "2005 · Show. Have you seen it?",
				taste: "Your taste",
				totals: "4 rated · 2 liked (6 or higher)",
			},
		)
		// After the taste is ready: ratings toward new picks, and Your taste lights at a milestone.
		const rated = { kind: "rated", done: 6, of: 10, left: 4 } as const
		const words = quizWords({
			title: asked,
			tally: t(16, 9),
			next: rated,
			lit: null,
		})
		assert.equal(words.kicker, "4 more to new picks")
		assert.equal(words.totals, "16 rated · 9 liked")
		assert.equal(
			quizWords({
				title: asked,
				tally: t(7, 5),
				next: { kind: "rated", done: 0, of: 10, left: 10 },
				lit: { kind: "ready", rated: 7, of: 5 },
			}).taste,
			"Your taste is ready",
		)
		assert.equal(
			quizWords({
				title: asked,
				tally: t(17, 9),
				next: { kind: "rated", done: 0, of: 10, left: 10 },
				lit: { kind: "picks", rated: 17, of: 10 },
			}).taste,
			"Your picks changed",
		)
		// Before the totals are known: the screen's name on top, and no totals.
		const unknown = quizWords({ title: null, tally: null, next: null, lit: null })
		assert.equal(unknown.kicker, "Rate titles")
		assert.equal(unknown.line, null)
		assert.equal(unknown.taste, "Your taste")
		assert.equal(unknown.totals, null)
	})

	it("the phone's header names the title with its year", () => {
		assert.equal(
			quizHeaderName({ title: "The Office", year: "2005" }),
			"The Office (2005)",
		)
		assert.equal(quizHeaderName({ title: "Bare", year: null }), "Bare")
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
			year: null,
			backdrop: null,
			poster: "/p.jpg",
			facts: "Movie",
		})
	})
})

const screensOf = (
	taste: TvTasteScreens["taste"],
	quiz: Partial<TvTasteScreens["quiz"]> = {},
): TvTasteScreens => ({
	taste,
	tasteLit: null,
	quiz: {
		title: null,
		waiting: false,
		tally: null,
		next: null,
		lit: null,
		answered: NOT_ANSWERED,
		...quiz,
	},
})
const TASTE: TvScreen = { name: "taste", side: null }
const QUIZ: TvScreen = { name: "quiz" }
const asked = {
	key: "show-2316",
	title: "The Office",
	year: "2005",
	backdrop: null,
	poster: null,
	facts: "",
}
const picks = [
	"movie-603",
	"movie-604",
	"show-1399",
	"movie-13",
	"movie-14",
].map((key) => ({ key, title: key, poster: null, backdrop: null, facts: "" }))
/** The desktop bar of a screen without the navigation: the white G (since 2026-10-22), Back, Search, Menu. */
const BAR = ["nav:home", "bar:back", "bar:search", "bar:menu"]
const NAV = [
	"nav:home",
	"nav:tonight",
	"nav:discover",
	"nav:search",
	"nav:quiz",
	"bar:menu",
]
const ctxOf = (screen: TvScreen, shown: TvTasteScreens): TvContext => ({
	...EMPTY_CONTEXT,
	...tasteContext(screen, shown),
})

describe("the machine's context for Taste, and the items it gives", () => {
	it("start, and while the portrait is read: Rate titles alone", () => {
		for (const taste of [
			{ state: "start", tally: t(2), backdrop: null } as const,
			{ state: "reading" } as const,
		]) {
			const shown = screensOf(taste, { tally: t(2) })
			assert.deepEqual(tasteContext(TASTE, shown), {
				taste: false,
				sides: [],
				titles: [],
			})
			// A guest can sign up to keep it; a member cannot.
			assert.deepEqual(tvItems(TASTE, ctxOf(TASTE, shown)), [
				"start-quiz",
				"sign-up",
				"expand",
				...BAR,
			])
			assert.deepEqual(
				tvItems(TASTE, { ...ctxOf(TASTE, shown), member: true }),
				["start-quiz", "expand", ...BAR],
			)
		}
	})

	it("sides: each side, then Rate titles", () => {
		const shown = screensOf({ state: "sides", sides: tvSides(view()) })
		assert.deepEqual(tvItems(TASTE, ctxOf(TASTE, shown)), [
			"side:dark-crime",
			"side:gentle-comedy",
			"side:big-ideas",
			"start-quiz",
			"sign-up",
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

	it("picks: up to four of the flow's picks, then Rate titles", () => {
		const shown = screensOf({ state: "picks", picks, waiting: false })
		assert.deepEqual(tvItems(TASTE, ctxOf(TASTE, shown)), [
			...picks.slice(0, 4).map((pick) => `title:${pick.key}`),
			"start-quiz",
			"sign-up",
			"expand",
			...BAR,
		])
		// The picks are no list of a side's screen.
		const side: TvScreen = { name: "taste", side: "dark-crime" }
		assert.deepEqual(tasteContext(side, shown).titles, [])
	})

	it("Rate titles for a guest at the rating limit: sign-up and Your taste, the rating flow's locked panel", () => {
		const shown = screensOf(
			{ state: "picks", picks: [], waiting: false },
			{ title: asked, tally: t(20), locked: true },
		)
		assert.equal(tasteContext(QUIZ, shown).quizLocked, true)
		assert.equal(tasteContext(TASTE, shown).quizLocked, undefined)
		assert.deepEqual(tvItems(QUIZ, ctxOf(QUIZ, shown)), [
			"sign-up",
			"your-taste",
			"expand",
			...NAV,
		])
	})

	it("Rate titles: the strip and its two marks while there is a title to ask about, then Your taste", () => {
		const shown = screensOf(
			{ state: "start", tally: t(3), backdrop: null },
			{ title: asked, tally: t(3) },
		)
		assert.deepEqual(tasteContext(QUIZ, shown), {
			taste: false,
			sides: [],
			titles: ["show-2316"],
		})
		const levels = STRIP_LEVELS.map((score) => `level:${score}`)
		assert.deepEqual(tvItems(QUIZ, ctxOf(QUIZ, shown)), [
			...levels,
			...STRIP_SCORES.map((score) => `score:${score}`),
			"skip",
			"not-interested",
			"your-taste",
			"expand",
			...NAV,
		])
		const waiting = screensOf(
			{ state: "start", tally: t(3), backdrop: null },
			{ waiting: true },
		)
		assert.deepEqual(tvItems(QUIZ, ctxOf(QUIZ, waiting)), [
			"your-taste",
			"expand",
			...NAV,
		])
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
				screensOf({ state: "start", tally: t(0), backdrop: null }),
				"movie-603",
			),
			null,
		)
		assert.equal(tasteKnown(sides, "nothing"), null)
	})
})

describe("Rate titles' write path", () => {
	/** A rating flow that records what it was asked to store. */
	const recorder = () => {
		const stored: (Score | "unseen" | "not-interested" | "pass")[] = []
		const answered = { failed: false }
		return {
			stored,
			answered,
			flow: {
				rate: (score: Score) => void stored.push(score),
				unseen: () => void stored.push("unseen"),
				notInterested: () => void stored.push("not-interested"),
				pass: () => void stored.push("pass"),
				answered,
			},
		}
	}
	/** Presses an item of Rate titles as the TV does, and carries out what the machine names. */
	function press(
		item: string,
		ctx: TvContext,
		flow: ReturnType<typeof recorder>,
	) {
		const state = readTvState(new URLSearchParams("tv=quiz"), ctx, 1)
		const next = transition(state, { type: "choose", item }, ctx)
		for (const effect of next.effects) carryOutQuiz(effect, flow.flow)
		return next
	}
	const shown = screensOf(
		{ state: "start", tally: t(0), backdrop: null },
		{ title: asked },
	)

	it("OK on each level stores the level's score: 3, 5, 7 and 9", () => {
		const flow = recorder()
		for (const score of STRIP_LEVELS)
			press(`level:${score}`, ctxOf(QUIZ, shown), flow)
		assert.deepEqual(flow.stored, [3, 5, 7, 9])
	})

	it("an exact score is stored as given", () => {
		const flow = recorder()
		for (const score of STRIP_SCORES)
			press(`score:${score}`, ctxOf(QUIZ, shown), flow)
		assert.deepEqual(flow.stored, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
	})

	it("on the phone an exact score is stored", () => {
		const flow = recorder()
		press("score:8", ctxOf(QUIZ, shown), flow)
		assert.deepEqual(flow.stored, [8])
	})

	it("Haven't seen it and Not interested are two marks of their own, and store no score", () => {
		const flow = recorder()
		assert.equal(press("skip", ctxOf(QUIZ, shown), flow).history, "none")
		assert.equal(
			press("not-interested", ctxOf(QUIZ, shown), flow).history,
			"none",
		)
		assert.deepEqual(flow.stored, ["unseen", "not-interested"])
	})

	it("after a save that failed, Haven't seen it is Next title: on without saving", () => {
		const flow = recorder()
		flow.answered.failed = true
		press("skip", ctxOf(QUIZ, shown), flow)
		assert.deepEqual(flow.stored, ["pass"])
	})

	it("a milestone never ends rating: every answer stays on Rate titles", () => {
		const flow = recorder()
		const ready = screensOf(
			{ state: "start", tally: t(4), backdrop: null },
			{ title: asked, tally: t(4) },
		)
		const ctx = ctxOf(QUIZ, ready)
		for (const item of ["level:7", "score:9", "skip", "not-interested"]) {
			const next = press(item, ctx, flow)
			assert.equal(next.history, "none", item)
			assert.equal(next.state.screen.name, "quiz", item)
		}
		assert.deepEqual(flow.stored, [7, 9, "unseen", "not-interested"])
	})

	it("without a title to ask about nothing can be pressed", () => {
		const flow = recorder()
		const empty = screensOf({ state: "start", tally: t(0), backdrop: null })
		for (const item of ["level:7", "skip", "not-interested"])
			press(item, ctxOf(QUIZ, empty), flow)
		assert.deepEqual(flow.stored, [])
	})

	it("is Rate titles' alone: another screen's effect is not carried out", () => {
		const flow = recorder()
		const others: TvEffect[] = [
			{ type: "rate", title: "movie-603", score: 8 },
			{ type: "want-to-see", title: "movie-603" },
			{ type: "sign-in" },
			{ type: "expand", href: "/taste" },
		]
		for (const effect of others)
			assert.equal(carryOutQuiz(effect, flow.flow), false)
		assert.deepEqual(flow.stored, [])
		assert.equal(carryOutQuiz({ type: "quiz-rate", score: 8 }, flow.flow), true)
		assert.equal(carryOutQuiz({ type: "quiz-skip" }, flow.flow), true)
		assert.equal(
			carryOutQuiz({ type: "quiz-not-interested" }, flow.flow),
			true,
		)
	})
})
