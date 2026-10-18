// Your scores: the filters (and what each option would leave), the two-way sort and the groups of the table.
import assert from "node:assert/strict"
import { test } from "node:test"
import "../server/title-filter/test-alias.ts"

const { NO_FILTERS, arrange, activeFilterCount, nextSort, optionCounts, passes, scoreSpread, versusOf } = await import(
	"./my-scores.ts"
)
type Title = import("./my-scores.ts").ScoredTitle

const title = (key: string, name: string, score: number, more: Partial<Title> = {}): Title => ({
	key: key as Title["key"],
	mediaType: key.startsWith("show") ? "show" : "movie",
	tmdbId: Number(key.split("-")[1]),
	title: name,
	poster_path: null,
	release_year: 2000,
	genres: [],
	gw: null,
	score,
	ratedAt: "2024-05-01T00:00:00Z",
	watchedAt: null,
	...more,
})
const titles = [
	title("movie-1", "The Matrix", 10, { gw: 82, genres: ["Action", "Science Fiction"], release_year: 1999 }),
	title("movie-2", "Amélie", 7, { gw: 80, genres: ["Comedy", "Romance"], release_year: 2001 }),
	title("show-3", "Dark", 9, { gw: 88, genres: ["Drama", "Mystery"], release_year: 2017, ratedAt: "2025-01-02T00:00:00Z" }),
	title("movie-4", "Cats", 3, { gw: 60, genres: ["Comedy"], release_year: 2019 }),
	title("movie-5", "An Unknown", 6, { genres: ["Drama"] }),
]
const as = (t: Title) => ({ score: t.score, changed: false })
const names = (groups: { titles: Title[] }[]) => groups.flatMap((g) => g.titles.map((t) => t.title))

test("your score against GoodWatch: 1.5 apart or more is a difference", () => {
	assert.equal(versusOf({ gw: 82 }, 10), "more")
	assert.equal(versusOf({ gw: 80 }, 7), "close")
	assert.equal(versusOf({ gw: 80 }, 6.6), "close")
	assert.equal(versusOf({ gw: 80 }, 6.5), "less")
	assert.equal(versusOf({ gw: null }, 6), null)
})

test("filters: any of the genres, the search without accents, the score as it stands", () => {
	const f = { ...NO_FILTERS, genres: ["Comedy", "Drama"] }
	assert.deepEqual(names(arrange(titles, f, { by: "title", dir: "asc" }, "none", as)), ["Amélie", "Cats", "Dark", "An Unknown"])
	assert.equal(passes(titles[1], { ...NO_FILTERS, q: "ameli" }, as(titles[1])), true)
	assert.equal(passes(titles[0], { ...NO_FILTERS, scores: [8] }, { score: 8, changed: true }), true)
	assert.equal(passes(titles[0], { ...NO_FILTERS, changedOnly: true }, as(titles[0])), false)
	assert.equal(passes(titles[4], { ...NO_FILTERS, minGw: 60 }, as(titles[4])), false)
	assert.equal(passes(titles[2], { ...NO_FILTERS, rated: ["2025"] }, as(titles[2])), true)
})

test("an option counts what it would leave, its own group left out", () => {
	const counts = optionCounts(titles, { ...NO_FILTERS, kind: "movie", genres: ["Comedy"] }, as)
	// The kind group ignores the kind filter: of the comedies, two movies and no show.
	assert.equal(counts.kind.get("movie"), 2)
	assert.equal(counts.kind.get("show"), undefined)
	// The genre group ignores the genre filter: every movie's genres.
	assert.equal(counts.genres.get("Drama"), 1)
	assert.equal(counts.genres.get("Action"), 1)
	assert.equal(counts.scores.get("7"), 1)
	assert.equal(counts.minGw.get("80"), 1)
	assert.equal(activeFilterCount({ ...NO_FILTERS, kind: "movie", genres: ["Comedy", "Drama"], minGw: 70 }), 4)
})

test("each column sorts both ways; a new column starts in its own direction", () => {
	assert.deepEqual(nextSort({ by: "score", dir: "desc" }, "score"), { by: "score", dir: "asc" })
	assert.deepEqual(nextSort({ by: "score", dir: "asc" }, "title"), { by: "title", dir: "asc" })
	assert.deepEqual(nextSort({ by: "title", dir: "asc" }, "gw"), { by: "gw", dir: "desc" })
	const byTitle = names(arrange(titles, NO_FILTERS, { by: "title", dir: "asc" }, "none", as))
	assert.deepEqual(byTitle, ["Amélie", "Cats", "Dark", "The Matrix", "An Unknown"])
	assert.deepEqual(names(arrange(titles, NO_FILTERS, { by: "title", dir: "desc" }, "none", as)), [...byTitle].reverse())
	assert.deepEqual(names(arrange(titles, NO_FILTERS, { by: "score", dir: "desc" }, "none", as)).slice(0, 2), ["The Matrix", "Dark"])
	// A title without a GoodWatch score sorts after the others by the gap, either way it's read as smallest.
	assert.equal(names(arrange(titles, NO_FILTERS, { by: "gap", dir: "desc" }, "none", as)).at(-1), "An Unknown")
})

test("groups: by score high first, by GoodWatch difference, by genre biggest first", () => {
	const sort = { by: "title", dir: "asc" } as const
	const byScore = arrange(titles, NO_FILTERS, sort, "score", as, (s) => (s === 10 ? "Masterpiece" : "x"))
	assert.deepEqual(byScore.map((g) => g.key), ["10", "9", "7", "6", "3"])
	assert.equal(byScore[0].label, "10 · Masterpiece")
	const versus = arrange(titles, NO_FILTERS, sort, "versus", as)
	assert.deepEqual(versus.map((g) => g.key), ["more", "close", "less", "none"])
	assert.deepEqual(versus[0].titles.map((t) => t.title), ["The Matrix"])
	assert.deepEqual(versus[2].titles.map((t) => t.title), ["Cats"])
	const genres = arrange(titles, NO_FILTERS, sort, "genre", as)
	assert.deepEqual(genres.map((g) => g.label), ["Comedy", "Drama", "Action"])
	// The row sits by the score the page passes, so a rescored row stays in its group until the view changes.
	const kept = arrange(titles, NO_FILTERS, sort, "score", (t) => ({ score: t.key === "movie-4" ? 3 : t.score, changed: false }))
	assert.ok(kept.find((g) => g.key === "3"))
})

test("the score spread counts each score from 1 to 10", () => {
	assert.deepEqual(scoreSpread([10, 7, 7, 1, 0, 11]), [1, 0, 0, 0, 0, 0, 2, 0, 0, 1])
})
