// The start page mood picker's data, wording, counts request, and panel placement (start-picker.ts, mood-counts.ts).
import assert from "node:assert/strict"
import { test } from "node:test"
import "../../../server/title-filter/test-alias.ts"

const { panelBox, resizedBox, startPicker, startShelfLines } = await import(
	"./start-picker.ts"
)
const { countScopeOf, countText, countsQuery, readCounts } = await import(
	"./mood-counts.ts"
)
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

test("the scope and its wording follow the guest's saved services", () => {
	assert.equal(countScopeOf(null), null)
	assert.equal(countScopeOf({ services: null }), "any")
	assert.equal(countScopeOf({ services: " " }), "any")
	assert.equal(countScopeOf({ services: "8,337" }), "mine")
	assert.equal(countText(1, "any"), "1 title")
	assert.equal(countText(12, null), "12 titles")
	assert.equal(countText(12, "mine"), "12 on your services")
})

test("one counts request: the picks by kind, the scope, and the search's ranked list", () => {
	const q = new URLSearchParams(
		countsQuery(["m:funny", "t:war", "m:scary", "s:slow"], "any", null),
	)
	assert.equal(q.get("moods"), "funny,scary")
	assert.equal(q.get("themes"), "war")
	assert.equal(q.get("styles"), "slow")
	assert.equal(q.get("services"), "any")
	assert.equal(q.has("ranked"), false)
	assert.equal(q.get("page"), "1")
	const searched = new URLSearchParams(
		countsQuery([], null, [1000000000603, 2000000001399]),
	)
	assert.equal(searched.get("ranked"), "1000000000603,2000000001399")
	assert.equal(searched.has("services"), false)
	assert.equal(searched.has("moods"), false)
	// A search that found nothing still searches.
	assert.equal(
		new URLSearchParams(countsQuery([], "mine", [])).get("ranked"),
		"",
	)
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

test("a resize keeps the panel's place and top, its height following the new bottom; nothing scrolls", () => {
	const phone = panelBox({
		column: { left: 0, width: 375 },
		row: { bottom: 480 },
		bottom: 668,
		scrollY: 0,
		room: 2000,
	})
	// The phone's bars hide: the window grows by 56 px.
	const grown = resizedBox(phone, {
		column: { left: 0, width: 375 },
		bottom: 724,
	})
	assert.equal(grown.top, phone.top)
	assert.equal(grown.viewTop, 72)
	assert.equal(grown.maxHeight, 724 - 16 - 72)
	assert.equal(grown.scrollBy, 0)
	// A keyboard takes most of the window: never below 200 px.
	assert.equal(
		resizedBox(phone, { column: { left: 0, width: 375 }, bottom: 200 })
			.maxHeight,
		200,
	)
})
