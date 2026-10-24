import assert from "node:assert/strict"
import test from "node:test"
import type { ImportItem, ImportSummary } from "~/domain/imports"
import "../../server/title-filter/test-alias.ts"
import type { HeldRow, LiveQuestion } from "./import-questions-model"

const {
	askedQuestions,
	conflictTitlesLeft,
	groupHeld,
	heldFromImdbItem,
	heldFromItem,
	imdbLiveQuestions,
	applyingCount,
	leftToDecide,
	leftToFinish,
	liveQuestions,
	openScreens,
	questionCounter,
	questionSize,
	runOptions,
	runWouldWrite,
	scoreArticle,
} = await import("./import-questions-model.ts")

const preview = (
	questions: ImportSummary["questions"],
	extra: Partial<ImportSummary> = {},
): ImportSummary =>
	({
		id: "p",
		source: "trakt",
		status: "preview",
		counts: {
			rows: 10,
			new: 3,
			unchanged: 0,
			conflict: 4,
			unmatched: 0,
			unsupported: 0,
			invalid: 0,
		},
		kinds: { rating: 5, want: 3, watch: 2 },
		questions,
		...extra,
	}) as ImportSummary

const q = (
	kind: LiveQuestion["kind"],
	waiting: number,
	byKind?: Record<string, number>,
) => ({ kind, waiting, applying: 0, answer: null, byKind })

test("confirm asks every question the preview counts among the kinds left in, undated included", () => {
	const summary = preview([
		q("conflict", 4, { rating: 4 }),
		q("rewatch", 2, { want: 2 }),
		q("wholeShow", 0, {}),
		q("undated", 3, { watch: 3 }),
	])
	assert.deepEqual(askedQuestions(summary, ["rating", "want", "watch"]), [
		"conflict",
		"rewatch",
		"undated",
	])
	assert.deepEqual(askedQuestions(summary, ["rating"]), ["conflict"])
	assert.deepEqual(askedQuestions(summary, ["watch"]), ["undated"])
})

test("confirm also asks the questions a row can come to after its first answer", () => {
	// A season wish for a show already Seen: the preview counts it once, under the whole show. After "add the whole
	// show" it waits on rewatch, so rewatch is asked too and no wishlistRewatch placeholder decides it.
	const seasonWish = preview([q("wholeShow", 1, { want: 1 })], {
		source: "mdblist",
		counts: { ...preview([]).counts, new: 0, conflict: 1 },
		kinds: { want: 1 } as ImportSummary["kinds"],
		wishlistShowChoiceCount: 1,
		wishlistRewatchChoiceCount: 1,
	})
	assert.deepEqual(askedQuestions(seasonWish, ["want"]), [
		"conflict",
		"rewatch",
		"wholeShow",
	])
	const options = runOptions(seasonWish, ["want"], false)
	assert.deepEqual(options, {
		kinds: ["want"],
		conflictChoice: "keep",
		watchDates: "preserve",
		ask: ["conflict", "rewatch", "wholeShow"],
	})
	assert.equal(runWouldWrite(seasonWish, options), true)
	// Rewatch rows counted nowhere first (they all wait on the whole show) are still asked when the preview has any.
	const rewatchOnly = preview([q("conflict", 2, { rating: 2 })], {
		source: "mdblist",
		wishlistRewatchChoiceCount: 1,
	})
	assert.deepEqual(askedQuestions(rewatchOnly, ["rating", "want"]), [
		"conflict",
		"rewatch",
	])
	assert.deepEqual(
		askedQuestions(rewatchOnly, ["rating"]),
		["conflict"],
		"without wishes kept, no wishlist question",
	)
})

test("asked questions keep their placeholders; wishlist answers go only for questions not asked", () => {
	const summary = preview(
		[q("conflict", 4, { rating: 4 }), q("rewatch", 2, { want: 2 })],
		{ wishlistShowChoiceCount: 1, source: "mdblist" },
	)
	assert.deepEqual(runOptions(summary, ["rating", "want"], false), {
		kinds: ["rating", "want"],
		conflictChoice: "keep",
		watchDates: "preserve",
		ask: ["conflict", "rewatch", "wholeShow"],
	})
	assert.deepEqual(runOptions(summary, ["rating"], false), {
		kinds: ["rating"],
		conflictChoice: "keep",
		watchDates: "preserve",
		ask: ["conflict"],
		wishlistRewatch: false,
		wishlistShows: false,
	})
	const shows = preview([q("wholeShow", 2, { want: 2 })], {
		source: "wishlist",
		kinds: { want: 4 } as ImportSummary["kinds"],
		wishlistShowChoiceCount: 2,
	})
	assert.deepEqual(runOptions(shows, ["want"], true), {
		kinds: ["want"],
		conflictChoice: "keep",
		watchDates: "preserve",
		ask: ["conflict", "rewatch", "wholeShow"],
	})
})

test("a run starts when something is new or a question waits, never with no kinds", () => {
	const summary = preview([q("conflict", 4, { rating: 4 })], {
		counts: { ...preview([]).counts, new: 0 },
	})
	assert.equal(
		runWouldWrite(summary, runOptions(summary, ["rating"], false)),
		true,
	)
	assert.equal(
		runWouldWrite(summary, runOptions(summary, ["want"], false)),
		false,
	)
	// A question asked only for rows that could come to it later holds nothing at the start: nothing to run.
	const later = preview([q("conflict", 0, {})], {
		counts: { ...preview([]).counts, new: 0, conflict: 2 },
		source: "mdblist",
		wishlistRewatchChoiceCount: 2,
	})
	const options = runOptions(later, ["rating"], false)
	assert.equal(runWouldWrite(later, options), false)
	assert.equal(
		runWouldWrite(summary, { ...runOptions(summary, [], false), kinds: [] }),
		false,
	)
})

const item = (index: number, extra: Partial<ImportItem>): ImportItem =>
	({
		index,
		key: `k${index}`,
		kind: "rating",
		mediaType: "movie",
		title: "Heat",
		year: 1995,
		tmdbId: 949,
		imdbId: null,
		outcome: "conflict",
		reason: null,
		score: 9,
		currentScore: 8,
		...extra,
	}) as ImportItem

test("held rows group by title: a score and a review are one screen, two episodes are two", () => {
	const rows: HeldRow[] = [
		heldFromItem(item(3, { kind: "review", score: null, currentScore: null })),
		heldFromItem(item(4, {})),
		heldFromItem(
			item(7, {
				kind: "episode_rating",
				mediaType: "show",
				tmdbId: 1396,
				title: "Breaking Bad",
				season: 1,
				episode: 2,
				scoreScope: "episode",
			} as Partial<ImportItem>),
		),
		heldFromItem(
			item(8, {
				kind: "episode_rating",
				mediaType: "show",
				tmdbId: 1396,
				title: "Breaking Bad",
				season: 1,
				episode: 3,
				scoreScope: "episode",
			} as Partial<ImportItem>),
		),
	]
	const titles = groupHeld(rows)
	assert.equal(titles.length, 3)
	assert.deepEqual(titles[0].rows, [3, 4])
	assert.equal(titles[0].yours, 8, "the score row gives the title its scores")
	assert.equal(titles[0].theirs, 9)
	assert.equal(titles[1].posterKey, "show:1396")
	assert.notEqual(titles[1].key, titles[2].key)
})

test("IMDb held rows carry their row index; rows without one can't be answered alone", () => {
	const base = {
		imdbId: "tt1",
		title: "Heat",
		year: 1995,
		titleType: "Movie",
		imdbScore: 10,
		dateRated: null,
		outcome: "conflict" as const,
		reason: null,
		tmdbId: 949,
		mediaType: "movie" as const,
		currentScore: 8,
	}
	assert.equal(heldFromImdbItem(base), null)
	assert.deepEqual(heldFromImdbItem({ ...base, index: 5 }), {
		index: 5,
		key: "movie:949",
		posterKey: "movie:949",
		title: "Heat",
		part: null,
		kind: "rating",
		yours: 8,
		theirs: 10,
	})
	assert.deepEqual(
		imdbLiveQuestions({
			status: "done",
			questions: [
				{ kind: "conflict", waiting: 0, applying: 2, answer: "imdb" },
			],
		}),
		[{ kind: "conflict", waiting: 0, applying: 2, answer: "source" }],
	)
})

const held = (index: number, title: string): HeldRow => ({
	index,
	key: `movie:${index}`,
	posterKey: `movie:${index}`,
	title,
	part: null,
	kind: "rating",
	yours: 8,
	theirs: 9,
})

test("screens: a title per differing score, then the yes/no questions; answered ones leave, the counter keeps them", () => {
	const questions = liveQuestions({
		status: "running",
		questions: [
			{ kind: "rewatch", waiting: 2, applying: 0, answer: null },
			{ kind: "conflict", waiting: 3, applying: 0, answer: null },
		],
	})
	const input = {
		questions,
		held: { conflict: [held(1, "Heat"), held(2, "Alien")] },
		answered: new Set<string>(),
		answeredRows: new Set<number>(),
	}
	assert.deepEqual(
		openScreens(input).map((screen) => screen.key),
		["conflict:movie:1", "conflict:movie:2", "rewatch"],
	)
	assert.equal(conflictTitlesLeft(input), 3, "one held row isn't loaded yet")
	assert.deepEqual(questionCounter(input, [], "conflict:movie:1"), {
		number: 1,
		of: 4,
	})
	// The answer's response carries the import with one held row fewer.
	const after = {
		...input,
		questions: input.questions.map((question) =>
			question.kind === "conflict" ? { ...question, waiting: 2 } : question,
		),
		answeredRows: new Set([1]),
	}
	assert.deepEqual(
		questionCounter(after, ["conflict:movie:1"], "conflict:movie:2"),
		{
			number: 2,
			of: 4,
		},
	)
	assert.equal(questionSize(input, "rewatch"), 2)
})

test("a question answered as a whole, or with nothing held, is not left to decide", () => {
	assert.deepEqual(
		leftToDecide([
			{ kind: "conflict", waiting: 0, applying: 3, answer: "source" },
			{ kind: "rewatch", waiting: 2, applying: 0, answer: null },
			{ kind: "wholeShow", waiting: 0, applying: 0, answer: null },
		]),
		["rewatch"],
	)
	assert.deepEqual(liveQuestions({ status: "preview", questions: [] }), [])
})

test("a score reads with the article it's said with", () => {
	assert.deepEqual([8, 9, 10, 11, 18, 1, 8.5, 1.5].map(scoreArticle), [
		"an",
		"a",
		"a",
		"an",
		"an",
		"a",
		"an",
		"a",
	])
})

test("answered conflict rows leave by row: a title with rows the answer didn't reach comes back with those", () => {
	const questions = liveQuestions({
		status: "running",
		// The answer's response already counts row 0 as answered; the list hasn't caught up.
		questions: [{ kind: "conflict", waiting: 2, applying: 0, answer: null }],
	})
	const heat = (index: number): HeldRow => ({
		...held(index, "Heat"),
		key: "movie:949",
	})
	const input = {
		questions,
		held: { conflict: [heat(0), held(1, "Alien"), heat(250)] },
		answered: new Set<string>(),
		answeredRows: new Set([0]),
	}
	const screens = openScreens(input)
	assert.deepEqual(
		screens.map((screen) => screen.key),
		["conflict:movie:1", "conflict:movie:949"],
	)
	assert.deepEqual(
		screens[1].q === "conflict" ? screens[1].title.rows : null,
		[250],
		"only the row not answered yet",
	)
	assert.equal(conflictTitlesLeft(input), 2)
})

test("a saved answer with rows still held is unfinished: no screen, not to decide, but to finish and counted as coming in", () => {
	const questions = liveQuestions({
		status: "done",
		questions: [
			// The request saved the answer and failed before it moved the rows.
			{ kind: "conflict", waiting: 2, applying: 1, answer: "source" },
			{ kind: "rewatch", waiting: 1, applying: 0, answer: null },
			{ kind: "undated", waiting: 0, applying: 0, answer: "add" },
		],
	})
	const input = {
		questions,
		held: { conflict: [held(1, "Heat"), held(2, "Alien")] },
		answered: new Set<string>(),
		answeredRows: new Set<number>(),
	}
	assert.deepEqual(
		openScreens(input).map((screen) => screen.key),
		["rewatch"],
	)
	assert.equal(conflictTitlesLeft(input), 0)
	assert.deepEqual(leftToDecide(questions), ["rewatch"])
	assert.deepEqual(leftToFinish(questions), [
		{ kind: "conflict", answer: "source" },
	])
	assert.equal(applyingCount(questions), 3)
	// Sent again, the answer moves the rows: nothing is left to finish.
	assert.deepEqual(
		leftToFinish([
			{ kind: "conflict", waiting: 0, applying: 2, answer: "source" },
		]),
		[],
	)
	// IMDb's "use theirs" saved answer is finished with the same answer.
	assert.deepEqual(
		leftToFinish(
			imdbLiveQuestions({
				status: "done",
				questions: [
					{ kind: "conflict", waiting: 4, applying: 0, answer: "imdb" },
				],
			}),
		),
		[{ kind: "conflict", answer: "source" }],
	)
})
