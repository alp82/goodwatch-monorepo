// The start page mood picker's data, wording, counts request, and panel placement (start-picker.ts, mood-counts.ts).
import assert from "node:assert/strict"
import { test } from "node:test"
import "../../../server/title-filter/test-alias.ts"

const { panelBox, startPicker, startShelfLines } = await import(
	"./start-picker.ts"
)
const { countText, countsOfResults, countsQuery, readCounts } = await import(
	"./mood-counts.ts"
)
const { resultsPath } = await import("../search/start-search.ts")
const { querySignature } = await import("../stage/start-query.ts")
const { pickMix } = await import("./mixes.ts")
const { WORDS } = await import("~/domain/taste-picker")

const counts = {
	query: "",
	byWord: { "m:funny": 120, "m:scary": 40, "t:war": 0 } as Record<
		string,
		number
	>,
	total: 75,
}

test("the picker in My movies' shape: mixes as groups first, then every word, with counts and pictures", () => {
	const picker = startPicker(["m:funny"], counts, { g1: "/a.jpg" })
	assert.deepEqual(picker.picks, ["m:funny"])
	assert.equal(picker.fitting, 75)
	assert.equal(picker.groups.length, 8)
	assert.deepEqual(picker.groups[0].madeOf, ["m:funny", "m:feelgood"])
	assert.equal(picker.groups[0].hues.length, 2)
	assert.deepEqual(
		picker.forYou,
		picker.groups.map((g) => g.id),
	)
	assert.equal(picker.choices.length, 8 + WORDS.length)
	assert.equal(picker.choices.find((c) => c.id === "g1")?.picture, "/a.jpg")
	assert.equal(picker.choices.find((c) => c.id === "m:scary")?.count, 40)
	assert.deepEqual(picker.narrow, [])
})

test("mix tiles show their parts line, never a count, and are never dimmed", () => {
	const picks = ["m:funny", "t:war", "s:slow"]
	const lines = startShelfLines(picks, counts, "any").lines
	assert.deepEqual(lines("g2"), {
		on: false,
		full: false,
		line: "Crime & mystery · Scary · Graphic",
		tap: null,
	})
	assert.equal(
		startShelfLines(pickMix([], "g2"), counts, "any").lines("g2").on,
		true,
	)
})

test("word tiles: counts in titles or on your services; a picked word says what is on show; dimmed at three", () => {
	const any = startShelfLines(["m:funny"], counts, "any").lines
	assert.equal(any("m:scary").tap, "40 titles")
	assert.equal(any("m:funny").tap, "75 titles")
	assert.equal(any("m:funny").on, true)
	assert.equal(any("t:war").tap, "0 titles")
	assert.match(any("m:scary").line ?? "", /\w/)
	assert.equal(any("t:war").line, null)
	const mine = startShelfLines([], counts, "mine").lines
	assert.equal(mine("m:scary").tap, "40 on your services")
	// No answer yet: no count line.
	assert.equal(startShelfLines([], null, "any").lines("m:scary").tap, null)
	const full = startShelfLines(["m:funny", "t:war", "s:slow"], counts, "any")
	assert.equal(full.lines("m:scary").full, true)
	assert.equal(full.lines("t:war").full, false)
	assert.equal(full.first.title, "Start with a mix")
})

test("the counts' wording follows the results' scope", () => {
	assert.equal(countText(1, "any"), "1 title")
	assert.equal(countText(12, "any"), "12 titles")
	assert.equal(countText(12, "mine"), "12 on your services")
	assert.equal(countText(1234, "any"), "1,234 titles")
	assert.equal(countText(1234, "mine"), "1,234 on your services")
})

test("one counts request: the results request's own query, with the picks by kind, the scope, and the search's ranked list", () => {
	const q = new URLSearchParams(
		countsQuery(["m:funny", "t:war", "s:slow"], "any", null),
	)
	assert.equal(q.get("moods"), "funny")
	assert.equal(q.get("themes"), "war")
	assert.equal(q.get("styles"), "slow")
	assert.equal(q.get("services"), "any")
	// Seen titles count, as they show in the row (a member's Discover default would leave them out).
	assert.equal(q.get("unseen"), "0")
	assert.equal(q.has("ranked"), false)
	assert.equal(q.get("page"), "1")
	assert.equal(
		`/api/discover/results?${countsQuery(["m:funny"], "mine", null)}`,
		resultsPath({ picks: ["m:funny"], scope: "mine", ranked: null }),
	)
	const searched = new URLSearchParams(
		countsQuery([], "mine", [1000000000603, 2000000001399]),
	)
	assert.equal(searched.get("ranked"), "1000000000603,2000000001399")
	assert.equal(searched.get("services"), "mine")
	assert.equal(searched.has("moods"), false)
	// A search that found nothing still searches.
	assert.equal(
		new URLSearchParams(countsQuery([], "mine", [])).get("ranked"),
		"",
	)
})

test("while a query is on, the counts are its results' own; another query's or unfinished results give none", () => {
	const query = { text: "heist", picks: ["m:funny"] }
	const ready = {
		status: "ready" as const,
		signature: querySignature(query),
		total: 12,
		optionCounts: { moods: { funny: 12, scary: 3 }, themes: {}, styles: {} },
	}
	assert.deepEqual(countsOfResults(query, ready), {
		query: querySignature(query),
		byWord: { "m:funny": 12, "m:scary": 3 },
		total: 12,
	})
	assert.equal(
		countsOfResults({ ...query, picks: ["m:scary"] }, ready),
		null,
		"another query's",
	)
	assert.equal(countsOfResults(query, { ...ready, status: "loading" }), null)
	assert.equal(countsOfResults(query, { ...ready, optionCounts: null }), null)
})

test("the answer's option counts by word id, and its total", () => {
	const read = readCounts("q", {
		total: 321,
		optionCounts: {
			moods: { funny: 10 },
			themes: { war: 3 },
			styles: { slow: 7 },
		} as never,
	})
	assert.deepEqual(read, {
		query: "q",
		byWord: { "m:funny": 10, "t:war": 3, "s:slow": 7 },
		total: 321,
	})
})

test("the panel runs from under the row to 16 px above the bottom; with less than 360 px left it scrolls up to 72 px", () => {
	const base = { column: { left: 16, width: 1328 }, scrollY: 0, room: 2000 }
	// Room enough: no scroll, as wide as 980 px, centered in the column.
	const roomy = panelBox({ ...base, row: { bottom: 300 }, bottom: 900 })
	assert.deepEqual(roomy, {
		top: 308,
		left: 16 + (1328 - 980) / 2,
		width: 980,
		maxHeight: 900 - 16 - 308,
		scrollBy: 0,
		viewTop: 308,
	})
	// A phone: the row at 480 of 740 with the dock at 668: scroll by 416 so the panel opens 72 px from the top.
	const phone = panelBox({
		...base,
		column: { left: 0, width: 375 },
		row: { bottom: 480 },
		bottom: 668,
		scrollY: 10,
	})
	assert.equal(phone.scrollBy, 416)
	assert.equal(phone.top, 498)
	assert.equal(phone.viewTop, 72)
	assert.equal(phone.maxHeight, 668 - 16 - 72)
	assert.equal(phone.width, 375)
	// The page can scroll only so far: the panel opens lower and is shorter.
	const short = panelBox({
		...base,
		row: { bottom: 480 },
		bottom: 740,
		room: 100,
	})
	assert.equal(short.scrollBy, 100)
	assert.equal(short.maxHeight, 740 - 16 - 388)
})

test("a resize places the panel from the page as it is now: under its row, above the new bottom", () => {
	const column = { left: 0, width: 375 }
	const phone = panelBox({
		column,
		row: { bottom: 480 },
		bottom: 668,
		scrollY: 0,
		room: 2000,
	})
	assert.equal(phone.scrollBy, 416)
	// The phone's bars hide after that scroll: the row is at TOP - 8, the window 56 px taller. Only the height grows.
	const grown = panelBox({
		column,
		row: { bottom: 64 },
		bottom: 724,
		scrollY: 416,
		room: 1584,
	})
	assert.equal(grown.top, phone.top)
	assert.equal(grown.viewTop, 72)
	assert.equal(grown.maxHeight, 724 - 16 - 72)
	assert.equal(grown.scrollBy, 0)
	// Turned to landscape: the page reflowed, the row is lower in a shorter, wider window. The panel hangs under the row
	// where it is now and the page scrolls it up, so it ends above the window's bottom instead of behind it.
	const turned = panelBox({
		column: { left: 24, width: 700 },
		row: { bottom: 300 },
		bottom: 375,
		scrollY: 900,
		room: 1500,
	})
	assert.equal(turned.top, 300 + 8 + 900)
	assert.equal(turned.left, 24)
	assert.equal(turned.width, 700)
	assert.equal(turned.scrollBy, 308 - 72)
	assert.equal(turned.viewTop, 72)
	assert.equal(turned.maxHeight, 375 - 16 - 72)
	// Mid-way through the open's smooth scroll: measured where the row is. With MIN_PANEL left there, it stays put
	// in the page and ends above the bottom from where it is now (shorter than once the scroll ends, never behind).
	const midway = panelBox({
		column,
		row: { bottom: 280 },
		bottom: 668,
		scrollY: 200,
		room: 1800,
	})
	assert.equal(midway.top, phone.top)
	assert.equal(midway.scrollBy, 0)
	assert.equal(midway.viewTop + midway.maxHeight, 668 - 16)
	// With less, the rest of the way scrolls, to TOP.
	const late = panelBox({
		column,
		row: { bottom: 320 },
		bottom: 668,
		scrollY: 160,
		room: 1840,
	})
	assert.equal(late.top, phone.top)
	assert.equal(late.scrollBy, 328 - 72)
	assert.equal(late.maxHeight, phone.maxHeight)
	// Turned with the row left above the window: the page scrolls back down to it, so the panel never starts out of
	// sight or runs past the bottom; at the page's top it scrolls only as far as it can.
	const above = panelBox({
		column,
		row: { bottom: -197 },
		bottom: 318,
		scrollY: 416,
		room: 1500,
	})
	assert.equal(above.top, -189 + 416)
	assert.equal(above.scrollBy, -189 - 72)
	assert.equal(above.viewTop, 72)
	assert.equal(above.maxHeight, 318 - 16 - 72)
	const nearTop = panelBox({
		column,
		row: { bottom: 20 },
		bottom: 668,
		scrollY: 30,
		room: 1500,
	})
	assert.equal(nearTop.scrollBy, -30)
	assert.equal(nearTop.viewTop, 58)
})
