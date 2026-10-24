import assert from "node:assert/strict"
import test from "node:test"
import "../../server/title-filter/test-alias.ts"
import type { ImportSummary } from "~/domain/imports"

const {
	sourceQuestions,
	sourceOptions,
	sourceWouldWrite,
	sourcePreviewContent,
	imdbPreviewContent,
	scoreConflictCount,
	conflictCountNeedsRows,
	firstUnanswered,
	doneTiles,
	doneReplaced,
	libraryTotals,
	clearedByList,
	stopReason,
} = await import("./import-flow-model.ts")
const { groupImportResult } = await import("../../domain/import-result.ts")

const summary = (fields: Partial<ImportSummary> = {}): ImportSummary => ({
	id: "00000000-0000-4000-8000-000000000001",
	source: "trakt",
	fileName: "trakt.zip",
	status: "preview",
	createdAt: "2026-10-24T09:00:00Z",
	finishedAt: null,
	counts: {
		rows: 10,
		new: 6,
		unchanged: 2,
		conflict: 2,
		unmatched: 0,
		unsupported: 0,
		invalid: 0,
	},
	kinds: {
		rating: 4,
		watch: 6,
		want: 2,
		favorite: 0,
		review: 0,
		show_status: 0,
	},
	warnings: [],
	options: null,
	processed: 0,
	total: 0,
	applied: { added: 0, updated: 0, kept: 0, failed: 0 },
	stalled: false,
	canUndo: false,
	error: null,
	...fields,
})

test("questions come in a fixed order and only when they apply to the kinds left in", () => {
	const all = summary({
		source: "mdblist",
		counts: { ...summary().counts, conflict: 5 },
		wishlistRewatchChoiceCount: 2,
		wishlistShowChoiceCount: 1,
	})
	assert.deepEqual(
		sourceQuestions({
			summary: all,
			kinds: ["rating", "watch", "want"],
			scoreConflicts: 2,
		}),
		["conflicts", "rewatch", "whole-show"],
	)
	// Without scores, no score question; without Want to See, no wishlist questions.
	assert.deepEqual(
		sourceQuestions({ summary: all, kinds: ["watch"], scoreConflicts: 2 }),
		[],
	)
	assert.deepEqual(
		sourceQuestions({ summary: all, kinds: ["want"], scoreConflicts: 2 }),
		["rewatch", "whole-show"],
	)
	// Entries to match by hand come last.
	assert.deepEqual(
		sourceQuestions({
			summary: summary({
				source: "tvtime",
				wishlistMatchCount: 4,
				wishlistUnresolvedMatchCount: 3,
			}),
			kinds: ["rating", "watch"],
			scoreConflicts: 2,
		}),
		["conflicts", "matching"],
	)
})

test("a wishlist's conflicts are its Seen and whole-show titles, not differing scores", () => {
	const wishlist = summary({
		source: "wishlist",
		kinds: {
			rating: 0,
			watch: 0,
			want: 5,
			favorite: 0,
			review: 0,
			show_status: 0,
		},
		counts: { ...summary().counts, conflict: 3 },
		wishlistRewatchChoiceCount: 3,
	})
	assert.equal(scoreConflictCount(wishlist, null), 0)
	assert.equal(conflictCountNeedsRows(wishlist), false)
	// A library with wishlist choices counts the rows the server says follow the conflict choice.
	const library = summary({
		source: "mdblist",
		counts: { ...summary().counts, conflict: 4 },
		wishlistRewatchChoiceCount: 2,
	})
	assert.equal(conflictCountNeedsRows(library), true)
	assert.equal(scoreConflictCount(library, 2), 2)
	// Unknown until the count loads, or when it can't: never guessed by subtracting.
	assert.equal(scoreConflictCount(library, null), null)
	// Without wishlist choices, every conflict is a score or a review.
	assert.equal(conflictCountNeedsRows(summary()), false)
	assert.equal(scoreConflictCount(summary(), null), 2)
})

test("a Seen season wish counted by both wishlist answers never hides a differing score", () => {
	// 200 Seen season wishes wait on both Want to rewatch and the whole-show answer, and 1 score differs: 201 conflicts.
	const mdblist = summary({
		source: "mdblist",
		counts: { ...summary().counts, conflict: 201 },
		wishlistRewatchChoiceCount: 200,
		wishlistShowChoiceCount: 200,
	})
	const scoreConflicts = scoreConflictCount(mdblist, 1)
	assert.equal(scoreConflicts, 1)
	assert.deepEqual(
		sourceQuestions({
			summary: mdblist,
			kinds: ["rating", "want"],
			scoreConflicts,
		}),
		["conflicts", "rewatch", "whole-show"],
	)
	// An unknown count still asks.
	assert.deepEqual(
		sourceQuestions({
			summary: mdblist,
			kinds: ["rating"],
			scoreConflicts: null,
		}),
		["conflicts"],
	)
	assert.deepEqual(
		sourceQuestions({ summary: mdblist, kinds: ["rating"], scoreConflicts: 0 }),
		[],
	)
})

test("every question that applies needs an explicit answer; checking matches still waits", () => {
	const questions = ["conflicts", "rewatch", "matching"] as const
	assert.equal(firstUnanswered(questions, {}), "conflicts")
	assert.equal(firstUnanswered(questions, { conflicts: "keep" }), "rewatch")
	assert.equal(
		firstUnanswered(questions, {
			conflicts: "keep",
			rewatch: "leave",
			matching: "check",
		}),
		"matching",
	)
	assert.equal(
		firstUnanswered(questions, {
			conflicts: "keep",
			rewatch: "leave",
			matching: "leave",
		}),
		null,
	)
})

test("the options always keep the source's watch dates and send what the answers chose", () => {
	assert.deepEqual(sourceOptions(summary(), ["rating", "watch"], {}), {
		kinds: ["rating", "watch"],
		conflictChoice: "keep",
		watchDates: "preserve",
	})
	assert.deepEqual(
		sourceOptions(summary(), ["rating"], { conflicts: "source" }),
		{ kinds: ["rating"], conflictChoice: "source", watchDates: "preserve" },
	)
	const mdblist = summary({
		source: "mdblist",
		wishlistRewatchChoiceCount: 1,
		wishlistShowChoiceCount: 1,
	})
	assert.deepEqual(
		sourceOptions(mdblist, ["want"], { rewatch: "add", "whole-show": "leave" }),
		{
			kinds: ["want"],
			conflictChoice: "keep",
			watchDates: "preserve",
			wishlistRewatch: true,
			wishlistShows: false,
		},
	)
	// A wishlist-only file says Want to rewatch through the conflict choice too, as the server reads it.
	const wishlist = summary({
		source: "wishlist",
		kinds: {
			rating: 0,
			watch: 0,
			want: 2,
			favorite: 0,
			review: 0,
			show_status: 0,
		},
		wishlistRewatchChoiceCount: 1,
	})
	assert.deepEqual(sourceOptions(wishlist, ["want"], { rewatch: "add" }), {
		kinds: ["want"],
		conflictChoice: "source",
		wishlistRewatch: true,
		watchDates: "preserve",
	})
	assert.deepEqual(sourceOptions(wishlist, ["want"], { rewatch: "leave" }), {
		kinds: ["want"],
		conflictChoice: "keep",
		watchDates: "preserve",
	})
})

test("answers that keep everything as it is start no import", () => {
	const seenOnly = summary({
		source: "wishlist",
		kinds: {
			rating: 0,
			watch: 0,
			want: 1,
			favorite: 0,
			review: 0,
			show_status: 0,
		},
		counts: { ...summary().counts, new: 0, conflict: 1 },
		wishlistRewatchChoiceCount: 1,
	})
	assert.equal(
		sourceWouldWrite(seenOnly, ["want"], { rewatch: "leave" }),
		false,
	)
	assert.equal(sourceWouldWrite(seenOnly, ["want"], { rewatch: "add" }), true)
	assert.equal(sourceWouldWrite(summary(), [], {}), false)
	assert.equal(sourceWouldWrite(summary(), ["rating"], {}), true)
})

test("a file with nothing new is caught up; one with nothing usable says so; still matching is neither", () => {
	const caughtUp = summary({
		counts: { ...summary().counts, new: 0, conflict: 0, unchanged: 8 },
	})
	assert.equal(sourcePreviewContent(caughtUp, false), "caught-up")
	assert.equal(sourcePreviewContent(caughtUp, true), "some")
	assert.equal(
		sourcePreviewContent(
			summary({
				counts: {
					...summary().counts,
					new: 0,
					conflict: 0,
					unchanged: 0,
					unmatched: 10,
				},
			}),
			false,
		),
		"nothing",
	)
	assert.equal(sourcePreviewContent(summary(), false), "some")
	const imdb = {
		counts: {
			rows: 5,
			new: 0,
			update: 0,
			unchanged: 5,
			conflict: 0,
			unmatched: 0,
			unsupported: 0,
			invalid: 0,
		},
	}
	assert.equal(imdbPreviewContent(imdb as never), "caught-up")
	assert.equal(
		imdbPreviewContent({ counts: { ...imdb.counts, conflict: 1 } } as never),
		"some",
	)
})

const title = (tmdbId: number) => ({
	tmdbId,
	mediaType: "movie" as const,
	title: `Film ${tmdbId}`,
	year: 2024,
	posterPath: null,
})

test("Done tiles show the member's total now, with what came in and what came off", () => {
	const result = groupImportResult("import", [
		{
			key: "movie:1",
			title: title(1),
			change: { type: "rating-added", score: 8 },
		},
		{
			key: "movie:2",
			title: title(2),
			change: { type: "rating-added", score: 6 },
		},
		{
			key: "movie:3",
			title: title(3),
			change: { type: "rating-replaced", from: 5, to: 7 },
		},
		{
			key: "movie:4",
			title: title(4),
			change: { type: "list-added", list: "want_to_see" },
		},
		{
			key: "movie:5",
			title: title(5),
			change: {
				type: "list-cleared",
				list: "want_to_see",
				because: "watched",
				undoRestores: false,
			},
		},
		{
			key: "movie:6",
			title: title(6),
			change: {
				type: "list-cleared",
				list: "not_interested",
				because: "watched",
				undoRestores: false,
			},
		},
	])
	const cleared = clearedByList(
		result.sections.find((s) => s.key === "lists_cleared")?.rows ?? [],
	)
	assert.deepEqual(cleared, { want_to_see: 1, not_interested: 1 })
	const data = {
		scores: Object.fromEntries(
			[1, 2, 3, 7, 8].map((id) => [
				`movie-${id}`,
				{ score: 7, review: null, updatedAt: new Date() },
			]),
		),
		wishlist: { "movie-4": { createdAt: new Date(), updatedAt: new Date() } },
		watchState: {},
		favorites: {},
		notInterested: {},
	} as never
	assert.deepEqual(
		doneTiles(result, cleared, data).map((tile) => [
			tile.name,
			tile.total,
			tile.added,
			tile.removed,
		]),
		[
			["Scores", 5, 2, 0],
			["Want to See", 1, 1, 1],
			["Not interested", 0, 0, 1],
		],
	)
	// While the member's data loads, a tile shows what came in.
	assert.equal(doneTiles(result, cleared, undefined)[0].total, null)
})

test("Done tiles count only what was added: a review-only entry isn't a score, a replacement adds nothing", () => {
	const show = (tmdbId: number) => ({
		...title(tmdbId),
		mediaType: "tv" as const,
	})
	const result = groupImportResult("import", [
		{ key: "movie:1", title: title(1), change: { type: "review-added" } },
		{ key: "movie:2", title: title(2), change: { type: "review-replaced" } },
		{ key: "movie:3", title: title(3), change: { type: "review-replaced" } },
		{
			key: "tv:10",
			title: show(10),
			change: { type: "status-set", status: { from: null, to: "watching" } },
		},
		{
			key: "tv:11",
			title: show(11),
			change: {
				type: "status-set",
				status: { from: "watching", to: "dropped" },
			},
		},
		{
			key: "tv:12",
			title: show(12),
			change: {
				type: "episode-rating-added",
				part: "S1",
				score: 8,
				from: null,
			},
		},
		{
			key: "tv:12",
			title: show(12),
			change: { type: "episode-rating-added", part: "S2", score: 7, from: 5 },
		},
	] as never)
	const data = {
		scores: {
			"movie-1": { score: null, review: "Loved it", updatedAt: new Date() },
			"movie-2": { score: 7, review: "Fine", updatedAt: new Date() },
			"movie-3": { score: 6, review: "Okay", updatedAt: new Date() },
		},
		wishlist: {},
		watchState: {
			"show-10": { state: "watching", count: 0 },
			"show-11": { state: "dropped", count: 0 },
		},
		favorites: {},
		notInterested: {},
	} as never
	assert.deepEqual(
		doneTiles(result, { want_to_see: 0, not_interested: 0 }, data).map(
			(tile) => [tile.key, tile.total, tile.added],
		),
		[
			["reviews", 3, 1],
			["episode-scores", null, 1],
			["statuses", 2, 1],
		],
	)
	assert.equal(libraryTotals(data).scores, 2)
	assert.deepEqual(doneReplaced(result), {
		scores: 0,
		reviews: 2,
		episodeScores: 1,
		statuses: 1,
	})
})

test("a stopped run gives the server's reason first", () => {
	assert.equal(
		stopReason({ error: "GoodWatch restarted.", stalled: false }),
		"GoodWatch restarted.",
	)
	assert.equal(
		stopReason({ error: null, stalled: true, operation: "undo" }),
		"Your undo stopped making progress.",
	)
})
