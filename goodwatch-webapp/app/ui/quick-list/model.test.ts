import assert from "node:assert/strict"
import test from "node:test"
import { NO_FILTERS } from "../../domain/my-scores.ts"
import {
	INITIAL_PAGING,
	INITIAL_QUICK,
	MISSES_MAX,
	type QuickAction,
	type QuickAnswer,
	type QuickState,
	type QuickTitle,
	ROWS,
	SOURCE_ORDER,
	afterBatch,
	afterBulk,
	atEnd,
	bounded,
	fillOf,
	fromScoring,
	fromSearchRow,
	heldAnswer,
	keepSelected,
	listOf,
	lookFurther,
	mayAsk,
	moreRequest,
	nextOrder,
	quickList,
	scorable,
	selectRange,
	staleRows,
	toggleSelected,
} from "./model.ts"

const keys = (n: number, from = 1) => Array.from({ length: n }, (_, i) => `movie-${from + i}`)
const run = (state: QuickState, ...actions: QuickAction[]) => actions.reduce(quickList, state)
const score = (s: number): QuickAnswer => ({ type: "score", score: s })
const answer = (id: number, key: string, after: QuickAnswer | null, before: QuickAnswer | null = null): QuickAction => ({
	type: "answer",
	id,
	items: [{ key, before, after }],
})
const start = (n = 30) => run(INITIAL_QUICK, { type: "rows", fill: keys(n) })

test("a new list shows its first 20 titles", () => {
	const s = start()
	assert.equal(s.shown.length, ROWS)
	assert.deepEqual(s.shown.slice(0, 2), ["movie-1", "movie-2"])
	assert.equal(s.list, 1)
})

test("the answered row stays until the next answer, then slides out and a new title fills in at the bottom", () => {
	let s = run(start(), answer(1, "movie-3", score(8)))
	assert.deepEqual(s.latest, ["movie-3"])
	assert.deepEqual(s.leaving, [])
	assert.ok(s.shown.includes("movie-3"))

	s = run(s, answer(2, "movie-5", { type: "skip" }))
	assert.deepEqual(s.latest, ["movie-5"])
	assert.deepEqual(s.leaving, ["movie-3"], "the older answered row slides out")
	assert.ok(s.shown.includes("movie-3"), "it stays in the rows while it slides")

	s = run(s, { type: "settle", keys: ["movie-3"], fill: keys(30).filter((k) => !["movie-3", "movie-5"].includes(k)), left: true })
	assert.ok(!s.shown.includes("movie-3"))
	assert.equal(s.shown.length, ROWS)
	assert.equal(s.shown.at(-1), "movie-21", "the next title takes the place at the bottom")
	assert.deepEqual(s.leaving, [])
})

test("answering the latest row again changes its answer and sends nothing away", () => {
	const s = run(start(), answer(1, "movie-3", score(8)), answer(2, "movie-3", score(6), score(8)))
	assert.deepEqual(s.leaving, [])
	assert.deepEqual(s.latest, ["movie-3"])
	assert.deepEqual(s.answers["movie-3"], score(6))
	assert.equal(s.steps.length, 2)
})

test("the same answer again is no change", () => {
	const s = run(start(), answer(1, "movie-3", score(8)), answer(2, "movie-3", score(8), score(8)))
	assert.equal(s.steps.length, 1)
})

test("clearing a score leaves the row unanswered in place and sends nothing away", () => {
	const s = run(start(), answer(1, "movie-3", score(8)), answer(2, "movie-4", score(7)), answer(3, "movie-4", null, score(7)))
	assert.equal(s.answers["movie-4"], null)
	assert.deepEqual(s.leaving, ["movie-3"], "only the earlier answer's row left")
	assert.deepEqual(s.latest, [])
	assert.ok(s.shown.includes("movie-4"))
})

test("undo brings back the row that slid out, in its place, and takes the answers back one step at a time", () => {
	const all = keys(30)
	let s = run(start(), answer(1, "movie-3", score(8)), answer(2, "movie-5", { type: "skip" }))
	s = run(s, { type: "settle", keys: ["movie-3"], fill: all.filter((k) => !["movie-3", "movie-5"].includes(k)), left: true })
	assert.ok(!s.shown.includes("movie-3"))

	s = run(s, { type: "undo" })
	assert.equal(s.answers["movie-5"], null, "the latest answer is taken back")
	assert.deepEqual(s.answers["movie-3"], score(8), "the earlier one stays")
	assert.equal(s.shown.indexOf("movie-3"), 2, "back in its place")
	assert.ok(!s.shown.includes("movie-21"), "the title that came in for it goes")
	assert.deepEqual(s.back, ["movie-3"])
	assert.deepEqual(s.latest, ["movie-3"], "dimmed with its answer again")
	assert.deepEqual(s.leaving, [])

	s = run(s, { type: "undo" })
	assert.equal(s.answers["movie-3"], null)
	assert.deepEqual(s.latest, [])
	assert.equal(s.shown.indexOf("movie-3"), 2)

	assert.equal(run(s, { type: "undo" }), s, "nothing left to take back")
})

test("undo while a row is still sliding out keeps it, and its late settle doesn't remove it", () => {
	let s = run(start(), answer(1, "movie-3", score(8)), answer(2, "movie-5", score(9)))
	s = run(s, { type: "undo" })
	assert.deepEqual(s.leaving, [])
	s = run(s, { type: "settle", keys: ["movie-3"], fill: keys(30), left: true })
	assert.ok(s.shown.includes("movie-3"))
})

test("undo after the list changed brings a title it took back in at the top", () => {
	let s = run(start(), answer(1, "movie-3", score(8)))
	s = run(s, { type: "rows", fill: keys(30, 100) })
	s = run(s, { type: "undo" })
	assert.equal(s.shown[0], "movie-3")
	assert.equal(s.shown.length, ROWS)
	assert.equal(s.answers["movie-3"], null)
})

test("several rows answered at once stay together, and leave together", () => {
	let s = run(start(), {
		type: "answer",
		id: 1,
		items: ["movie-1", "movie-2"].map((key) => ({ key, before: null, after: { type: "not-interested" } as const })),
	})
	assert.deepEqual(s.latest, ["movie-1", "movie-2"])
	s = run(s, answer(2, "movie-4", score(5)))
	assert.deepEqual(s.leaving, ["movie-1", "movie-2"])
	s = run(s, { type: "undo" })
	assert.deepEqual(s.latest, ["movie-1", "movie-2"])
})

test("a failed save takes the answer back to the person's marks and out of Undo", () => {
	let s = run(start(), answer(1, "movie-3", score(8)), answer(2, "movie-4", score(6)))
	s = run(s, { type: "failed", step: 2, key: "movie-4" })
	assert.ok(!("movie-4" in s.answers))
	assert.equal(s.steps.length, 1)
	assert.equal(s.steps[0].id, 1)
})

const titlesOf = (ks: string[]) =>
	ks.map((key) => fromScoring({ tmdb_id: Number(key.split("-")[1]), media_type: "movie", title: key, poster_path: "/p.jpg" }))

test("titles that may fill a place: unanswered ones; in a search every title, also those answered here", () => {
	const titles = titlesOf(keys(5))
	const state = { answers: { "movie-2": score(7), "movie-3": null }, shown: ["movie-1"], gone: [] }
	const answered = new Set(["movie-3", "movie-4"])
	assert.deepEqual(fillOf(titles, state, answered, false), ["movie-3", "movie-5"])
	assert.deepEqual(fillOf(titles, state, answered, true), ["movie-2", "movie-3", "movie-4", "movie-5"])
})

test("a search shows a title answered in this visit with its answer; a row that slid out of it doesn't come back", () => {
	const all = keys(30)
	// Answered in the person's own list: movie-3, which slides out after the next answer.
	let s = run(start(), answer(1, "movie-3", score(8)), answer(2, "movie-4", { type: "skip" }))
	s = run(s, { type: "settle", keys: ["movie-3"], fill: fillOf(titlesOf(all), s, new Set(), false), left: true })
	assert.deepEqual(s.gone, ["movie-3"])
	// A new search: its first rows include movie-3, with its answer, to be changed.
	const found = titlesOf(["movie-3", "movie-4", "movie-40"])
	s = run(s, { type: "rows", fill: fillOf(found, { ...s, shown: [], gone: [] }, new Set(["movie-3", "movie-4"]), true) })
	assert.deepEqual(s.shown, ["movie-3", "movie-4", "movie-40"])
	assert.deepEqual(s.gone, [], "a new list starts with no rows dismissed")
	assert.deepEqual(s.answers["movie-3"], score(8))
	// In the search, movie-3 is answered again, slides out after the next answer, and doesn't fill back in.
	s = run(s, answer(3, "movie-3", score(9), score(8)), answer(4, "movie-40", { type: "skip" }))
	s = run(s, { type: "settle", keys: ["movie-3"], fill: fillOf(found, s, new Set(), true), left: true })
	assert.ok(!s.shown.includes("movie-3"))
	assert.deepEqual(fillOf(found, s, new Set(), true), [], "dismissed in this search")
	// The query changes (or clears): a new list, and movie-3 shows again.
	s = run(s, { type: "rows", fill: fillOf(found, { ...s, shown: [], gone: [] }, new Set(), true) })
	assert.ok(s.shown.includes("movie-3"))
})

test("undo brings a dismissed row back, and it may fill a place again", () => {
	let s = run(start(), answer(1, "movie-3", score(8)), answer(2, "movie-4", score(6)))
	s = run(s, { type: "settle", keys: ["movie-3"], fill: [], left: true })
	assert.deepEqual(s.gone, ["movie-3"])
	s = run(s, { type: "undo" })
	assert.deepEqual(s.gone, [])
	assert.ok(s.shown.includes("movie-3"))
})

test("rows found answered elsewhere go, unless answered here or in a search", () => {
	const state = { answers: { "movie-2": score(7) }, shown: ["movie-1", "movie-2", "movie-3"], leaving: [], gone: [] }
	const answered = new Set(["movie-1", "movie-2"])
	assert.deepEqual(staleRows(state, answered, false), ["movie-1"])
	assert.deepEqual(staleRows(state, answered, true), [])
})

test("the person's marks read as one answer, the score first", () => {
	assert.deepEqual(heldAnswer({ scores: { "movie-1": { score: 7 } }, skipped: { "movie-1": {} } }, "movie-1"), score(7))
	assert.deepEqual(heldAnswer({ skipped: { "show-2": {} }, wishlist: { "show-2": {} } }, "show-2"), { type: "plan" })
	assert.deepEqual(heldAnswer({ notInterested: { "show-2": {} } }, "show-2"), { type: "not-interested" })
	assert.deepEqual(heldAnswer({ skipped: { "show-2": {} } }, "show-2"), { type: "skip" })
	assert.equal(heldAnswer({}, "show-2"), null)
	assert.equal(heldAnswer(undefined, "show-2"), null)
})

test("a guest scores only up to the limit; changing a score always goes through", () => {
	const scored = (k: string) => k === "movie-1"
	assert.deepEqual(scorable(["movie-1", "movie-2", "movie-3"], scored, 19, 20, false), ["movie-1", "movie-2"])
	assert.deepEqual(scorable(["movie-2", "movie-3"], scored, 20, 20, false), [])
	assert.deepEqual(scorable(["movie-2", "movie-3"], scored, 20, 20, true), ["movie-2", "movie-3"])
})

test("sorting: first press, second press the other way, third press back to the source order", () => {
	let o = nextOrder(SOURCE_ORDER, "title")
	assert.deepEqual(o, { by: "title", dir: "asc" })
	o = nextOrder(o, "title")
	assert.deepEqual(o, { by: "title", dir: "desc" })
	assert.deepEqual(nextOrder(o, "title"), SOURCE_ORDER)
	o = nextOrder(o, "year")
	assert.deepEqual(o, { by: "year", dir: "desc" }, "another column starts in its own first direction")
	assert.deepEqual(nextOrder(nextOrder(o, "year"), "year"), SOURCE_ORDER)
})

test("the list: filters apply, the source order stays, sorts ignore a leading article", () => {
	const t = (id: number, title: string, year: number, type: "movie" | "show" = "movie", genres: string[] = []) =>
		fromScoring({ tmdb_id: id, media_type: type, title, poster_path: "", release_year: String(year), genres })
	const titles: QuickTitle[] = [t(1, "Zodiac", 2007), t(2, "The Abyss", 1989), t(3, "Barry", 2018, "show", ["Comedy"])]
	assert.deepEqual(listOf(titles, NO_FILTERS, SOURCE_ORDER).map((x) => x.tmdbId), [1, 2, 3])
	assert.deepEqual(listOf(titles, NO_FILTERS, { by: "title", dir: "asc" }).map((x) => x.tmdbId), [2, 3, 1])
	assert.deepEqual(listOf(titles, NO_FILTERS, { by: "year", dir: "desc" }).map((x) => x.tmdbId), [3, 1, 2])
	assert.deepEqual(listOf(titles, { ...NO_FILTERS, kind: "movie" }, SOURCE_ORDER).map((x) => x.tmdbId), [1, 2])
	assert.deepEqual(listOf(titles, { ...NO_FILTERS, decades: [1980] }, SOURCE_ORDER).map((x) => x.tmdbId), [2])
	assert.deepEqual(listOf(titles, { ...NO_FILTERS, q: "zzz" }, SOURCE_ORDER).length, 3, "the search box is its own list")
	assert.deepEqual(t(4, "X", 2000, "show", ["Sci-Fi & Fantasy"]).genres, ["Science Fiction", "Fantasy"])
})

test("a search row becomes a title; anything but a movie or show doesn't", () => {
	const t = fromSearchRow({ key: "show:1396", title: "Breaking Bad", type: "show", year: "2008", poster: null, discovery: { genres: ["Drama"] } })
	assert.equal(t?.key, "show-1396")
	assert.equal(t?.release_year, 2008)
	assert.equal(t?.poster_path, null)
	assert.deepEqual(t?.genres, ["Drama"])
	assert.equal(fromSearchRow({ key: "person:5", title: "X", type: "person" }), null)
})

test("selection: a press toggles a row, Shift adds the range from the last row pressed", () => {
	const rows = keys(6)
	let s = toggleSelected(new Set(), "movie-2")
	assert.deepEqual([...s], ["movie-2"])
	s = selectRange(s, rows, "movie-2", "movie-5")
	assert.deepEqual([...s].sort(), ["movie-2", "movie-3", "movie-4", "movie-5"])
	s = selectRange(s, rows, "movie-5", "movie-1")
	assert.equal(s.size, 5)
	assert.deepEqual([...selectRange(new Set(), rows, null, "movie-3")], ["movie-3"], "no anchor: a press")
	assert.deepEqual([...toggleSelected(s, "movie-1")].includes("movie-1"), false)
	const kept = new Set(["movie-1"])
	assert.equal(keepSelected(kept, rows), kept, "unchanged selection keeps its identity")
	assert.deepEqual([...keepSelected(new Set(["movie-1", "movie-9"]), rows)], ["movie-1"])
})

test("a bulk answer leaves out rows still saving: they stay selected, with a count for the line", () => {
	const out = afterBulk(["movie-1", "movie-2", "movie-3", "movie-4"], ["movie-2", "movie-4"])
	assert.deepEqual([...out.selected], ["movie-2", "movie-4"])
	assert.equal(out.stillSaving, 2)
	const all = afterBulk(["movie-1", "movie-2"], [])
	assert.equal(all.selected.size, 0)
	assert.equal(all.stillSaving, 0)
})

test("bulk saves run a few at a time, in order, and every one settles", async () => {
	const run = bounded(4)
	let running = 0
	let most = 0
	const started: number[] = []
	const task = (n: number) => async () => {
		started.push(n)
		running++
		most = Math.max(most, running)
		await new Promise((r) => setTimeout(r, 2))
		running--
		if (n === 5) throw new Error("not saved")
		return n
	}
	const settled = await Promise.allSettled(Array.from({ length: 10 }, (_, n) => run(task(n))))
	assert.equal(most, 4)
	assert.deepEqual(started, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
	assert.equal(settled.filter((r) => r.status === "rejected").length, 1, "a failed save doesn't stop the rest")
})

test("paging names every title known, also past 600, so a batch never brings back the list's titles", () => {
	const pool = keys(950)
	const answered = keys(80, 2000)
	const { excludeIds } = moreRequest(answered, pool)
	assert.equal(excludeIds.length, 1030)
	assert.deepEqual(excludeIds[0], { media_type: "movie", tmdb_id: 2000 })
	assert.deepEqual(excludeIds.at(-1), { media_type: "movie", tmdb_id: 950 })
})

test("paging: a batch with nothing new ends it; Look further doesn't send the same request again", () => {
	const at650 = moreRequest([], keys(650)).exclusion
	let p = afterBatch({ ...INITIAL_PAGING, fetching: true }, at650, 0, 0)
	assert.ok(atEnd(p, at650))
	assert.equal(mayAsk(p, at650), false)
	p = lookFurther(p, at650)
	assert.equal(mayAsk(p, at650), false, "same exclusion set: no request")
	assert.ok(atEnd(p, at650), "the end state shows")
	// A title answered in a search changes the set: the list may ask again.
	const changed = moreRequest(["movie-9000"], keys(650)).exclusion
	assert.equal(atEnd(p, changed), false)
	assert.equal(mayAsk(p, changed), true)
})

test("paging: batches the filters let nothing through from stop it; Look further tries again", () => {
	let p = INITIAL_PAGING
	for (let i = 0; i < MISSES_MAX; i++) p = afterBatch(p, `set-${i}`, 50, 0)
	assert.equal(mayAsk(p, "set-9"), false)
	p = lookFurther(p, "set-9")
	assert.equal(mayAsk(p, "set-9"), true)
	assert.equal(afterBatch(p, "set-9", 50, 3).misses, 0)
})

test("scrolling to the end shows 20 more rows while titles last, and a new list starts at 20 again", () => {
	const s = start(50)
	const more = run(s, { type: "more", fill: keys(50) })
	assert.equal(more.cap, ROWS * 2)
	assert.equal(more.shown.length, 40)
	assert.deepEqual(more.shown.slice(20, 22), ["movie-21", "movie-22"])
	const last = run(more, { type: "more", fill: keys(50) })
	assert.equal(last.shown.length, 50)
	// The rows don't fill the cap: nothing more to show, so it stays.
	assert.equal(run(last, { type: "more", fill: keys(50) }), last)
	// Nothing left yet: the places wait for the next titles, and the cap grows no further until they fill.
	const waiting = run(start(20), { type: "more", fill: keys(20) })
	assert.equal(waiting.cap, ROWS * 2)
	assert.equal(run(waiting, { type: "more", fill: keys(20) }), waiting)
	assert.equal(run(waiting, { type: "fill", fill: keys(30) }).shown.length, 30)
	const again = run(last, { type: "rows", fill: keys(50) })
	assert.equal(again.cap, ROWS)
	assert.equal(again.shown.length, ROWS)
})
