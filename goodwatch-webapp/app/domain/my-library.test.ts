// My library (#385): the counts of the two main choices and the drop-down, the order of a status's list under each
// sort, the movies/shows filter, the search, and the steps of 60. Counted and ordered from the member data map alone
// (docs/implementation/tracking/data-model.md, "Reads": Library).
import assert from "node:assert/strict"
import { test } from "node:test"
import "../server/title-filter/test-alias.ts"

const {
	LIBRARY_STEP,
	MAIN_STATUSES,
	MORE_STATUSES,
	libraryCounts,
	libraryChoiceOf,
	libraryOrder,
	libraryParams,
	libraryStep,
	needsTitles,
	sortKey,
	sortsFor,
	watchedWords,
} = await import("./my-library.ts")

const at = (day: string) => new Date(`${day}T00:00:00Z`)
type State = "watching" | "on_hold" | "dropped" | "seen"
const state = (s: State, watchedAt: Date | null, count = 1) => ({
	state: s,
	watchedAt,
	precision: watchedAt ? ("day" as const) : ("unknown" as const),
	count,
	pass: 1,
	episodesWatched: 0,
	furthest: null,
	lastActivityAt: watchedAt,
})
const score = (n: number) => ({ score: n as 1, review: null, updatedAt: at("2026-01-01") })
const wish = (day: string) => ({ createdAt: at(day), updatedAt: at(day) })

const DATA = {
	wishlist: {
		"movie-1": wish("2026-09-01"),
		"show-2": wish("2026-10-01"),
		"movie-3": wish("2026-08-01"),
	},
	watchState: {
		"movie-10": state("seen", at("2026-10-01")),
		"movie-11": state("seen", at("2024-03-12"), 3),
		"movie-12": state("seen", null),
		"movie-13": state("seen", at("2026-10-05")),
		"show-20": state("seen", at("2025-01-01")),
		"show-21": state("watching", at("2026-10-07")),
		"show-22": state("on_hold", at("2026-06-01")),
		"show-23": state("dropped", null),
		"show-24": state("watching", at("2026-09-01")),
	},
	scores: {
		"movie-10": score(8),
		"movie-11": score(10),
		"movie-12": score(8),
		// A rated show without a state counts as Seen.
		"show-30": score(6),
		// A rated show that is Watching stays under Watching.
		"show-21": score(9),
	},
}
const TITLES: Record<string, string> = {
	"movie-10": "The Matrix",
	"movie-11": "Alien",
	"movie-12": "A Quiet Place",
	"movie-13": "Zodiac",
	"show-20": "An Idiot Abroad",
	"show-30": "Dark",
	"movie-1": "Heat",
	"show-2": "Severance",
	"movie-3": "Arrival",
}
const title = (key: string) => TITLES[key]
const order = (choice: Record<string, unknown>) =>
	libraryOrder(DATA, { status: "seen", sort: null, kind: "all", q: "", ...choice }, title)

test("Want to see and Seen are the two main choices; the other four are in the drop-down", () => {
	assert.deepEqual(MAIN_STATUSES, ["want", "seen"])
	assert.deepEqual(MORE_STATUSES, ["watching", "on_hold", "dropped", "unrated"])
})

test("the counts come from the member data: Seen is the Seen titles and the rated shows without a state", () => {
	assert.deepEqual(libraryCounts(DATA), {
		want: 3,
		seen: 6,
		watching: 2,
		on_hold: 1,
		dropped: 1,
		// Seen without a score: movie-13 and show-20.
		unrated: 2,
	})
})

test("Last watched puts the latest dated watch first and the titles without a dated watch last", () => {
	assert.deepEqual(order({ sort: "last" }).keys, [
		"movie-13",
		"movie-10",
		"show-20",
		"movie-11",
		"movie-12",
		"show-30",
	])
})

test("My score puts the highest score first and the titles without a score last, each by last watched", () => {
	assert.deepEqual(order({ sort: "score" }).keys, [
		"movie-11",
		"movie-10",
		"movie-12",
		"show-30",
		"movie-13",
		"show-20",
	])
})

test("Title orders by the title without its article", () => {
	assert.deepEqual(order({ sort: "title" }).keys, [
		"movie-11", // Alien
		"show-30", // Dark
		"show-20", // An Idiot Abroad
		"movie-10", // The Matrix
		"movie-12", // A Quiet Place
		"movie-13", // Zodiac
	])
	assert.equal(sortKey("The Matrix"), "matrix")
	assert.equal(sortKey("An Idiot Abroad"), "idiot abroad")
	assert.equal(sortKey("A"), "a")
	assert.equal(sortKey("Élite"), "elite")
})

test("the movies and shows filter narrows the list and reports how many of each the status holds", () => {
	const movies = order({ kind: "movie" })
	assert.deepEqual(movies.keys, ["movie-13", "movie-10", "movie-11", "movie-12"])
	assert.deepEqual(movies.kinds, { all: 6, movie: 4, show: 2 })
	assert.deepEqual(order({ kind: "show" }).keys, ["show-20", "show-30"])
})

test("the search keeps the titles that contain the words, whatever their case", () => {
	assert.deepEqual(order({ q: "  qUiet " }).keys, ["movie-12"])
	assert.deepEqual(order({ q: "o" }).keys, ["movie-13", "show-20"])
	assert.deepEqual(order({ q: "nothing like it" }).keys, [])
})

test("Not rated is the Seen titles without a score, and has no My score sort", () => {
	assert.deepEqual(order({ status: "unrated" }).keys, ["movie-13", "show-20"])
	assert.deepEqual(sortsFor("unrated"), ["last", "title"])
	// A sort the status doesn't have falls back to its first.
	assert.equal(order({ status: "unrated", sort: "score" }).sort, "last")
})

test("Want to see is the Wishlist, last added first; Watching, On hold and Dropped are the shows in that state", () => {
	assert.deepEqual(order({ status: "want" }).keys, ["show-2", "movie-1", "movie-3"])
	assert.equal(order({ status: "want" }).sort, "added")
	assert.deepEqual(order({ status: "want", sort: "title" }).keys, ["movie-3", "movie-1", "show-2"])
	assert.deepEqual(order({ status: "watching" }).keys, ["show-21", "show-24"])
	assert.deepEqual(order({ status: "on_hold" }).keys, ["show-22"])
	assert.deepEqual(order({ status: "dropped" }).keys, ["show-23"])
	assert.deepEqual(sortsFor("want"), ["added", "title"])
	assert.deepEqual(sortsFor("seen"), ["last", "score", "title"])
	assert.deepEqual(sortsFor("watching"), ["last", "title"])
})

test("titles are read only for the Title sort and for a search", () => {
	assert.equal(needsTitles({ sort: "last", q: "" }), false)
	assert.equal(needsTitles({ sort: "score", q: " " }), false)
	assert.equal(needsTitles({ sort: "title", q: "" }), true)
	assert.equal(needsTitles({ sort: "last", q: "al" }), true)
	// Without the titles the order still stands, by key.
	const untitled = libraryOrder(DATA, { status: "seen", sort: "last", kind: "all", q: "" })
	assert.equal(untitled.keys.length, 6)
})

test("a list is drawn in steps of 60, also with 1,500 Seen titles", () => {
	const watchState: Record<string, ReturnType<typeof state>> = {}
	for (let i = 1; i <= 1500; i++)
		watchState[`movie-${i}`] = state("seen", new Date(Date.UTC(2020, 0, 1) + i * 86_400_000))
	const big = libraryOrder(
		{ wishlist: {}, scores: {}, watchState },
		{ status: "seen", sort: "last", kind: "all", q: "" },
	)
	assert.equal(LIBRARY_STEP, 60)
	assert.equal(big.total, 1500)
	const first = libraryStep(big.keys, 0)
	assert.equal(first.keys.length, 60)
	assert.equal(first.keys[0], "movie-1500")
	assert.equal(first.next, 60)
	assert.equal(first.left, 1440)
	const last = libraryStep(big.keys, 1440)
	assert.deepEqual([last.keys.length, last.next, last.left], [60, null, 0])
	assert.deepEqual(libraryStep(big.keys, 1500).keys, [])
	// An offset that is not a step's start is taken as the step before it.
	assert.equal(libraryStep(big.keys, 61).keys[0], "movie-1440")
})

test("the choice lives in the URL, with the defaults left out", () => {
	const read = (query: string) => libraryChoiceOf(new URLSearchParams(query))
	assert.deepEqual(read(""), { status: "want", sort: null, kind: "all", q: "" })
	assert.deepEqual(read("status=seen&sort=score&type=movie&q=al"), {
		status: "seen",
		sort: "score",
		kind: "movie",
		q: "al",
	})
	assert.deepEqual(read("status=nope&sort=nope&type=nope"), { status: "want", sort: null, kind: "all", q: "" })
	assert.equal(libraryParams({ status: "want", sort: null, kind: "all", q: "" }).toString(), "")
	assert.equal(
		libraryParams({ status: "unrated", sort: "title", kind: "show", q: "dark" }).toString(),
		"status=unrated&sort=title&type=show&q=dark",
	)
})

test("a Seen row says when the title was last watched, as exactly as it is known, and how often", () => {
	const now = Date.parse("2026-10-08T20:00:00Z")
	assert.equal(watchedWords({ watchedAt: at("2024-03-12"), count: 1 }, now), "12 Mar 2024")
	assert.equal(watchedWords({ watchedAt: null, count: 1 }, now), "Date unknown")
	assert.equal(
		watchedWords({ watchedAt: at("2024-03-12"), count: 3 }, now),
		"Watched 3 times, last 12 Mar 2024",
	)
	assert.equal(watchedWords({ watchedAt: null, count: 2 }, now), "Watched 2 times, dates unknown")
	assert.equal(watchedWords({ watchedAt: new Date(now - 3_600_000), count: 1 }, now), "Today")
	assert.equal(watchedWords({ watchedAt: at("2026-10-07"), count: 1 }, now), "Yesterday")
	// A rated show without a watch state has no watch to tell of.
	assert.equal(watchedWords(null, now), "Rated")
})
