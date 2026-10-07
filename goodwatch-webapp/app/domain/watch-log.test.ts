// A movie's watch log in the browser: its order, how a watch's date reads, and what the log is expected to be right
// after an action (docs/implementation/tracking/data-model.md, "Watch dates" and "The browser").
import assert from "node:assert/strict"
import { test } from "node:test"

const {
	countLabel,
	dayBefore,
	localDay,
	memberWatches,
	newWatch,
	orderWatches,
	scoredOnly,
	sourceName,
	summaryOf,
	watchLabel,
	whenText,
	withDate,
	withRestored,
	withWatch,
	withoutWatch,
} = await import("./watch-log.ts")
type WatchLogEntry = import("./watch-log.ts").WatchLogEntry

const BERLIN = "Europe/Berlin"
// Wednesday evening in Berlin (UTC+2).
const NOW = new Date("2026-10-07T20:00:00Z")
const at = (iso: string) => Date.parse(iso)

const watch = (id: string, parts: Partial<WatchLogEntry> = {}): WatchLogEntry => ({
	id,
	at: at("2026-10-06T19:40:00Z"),
	precision: "moment",
	origin: "single",
	importId: null,
	source: null,
	createdAt: at("2026-10-06T19:40:00Z"),
	...parts,
})
const day = (id: string, date: string, parts: Partial<WatchLogEntry> = {}) =>
	watch(id, { at: at(`${date}T00:00:00Z`), precision: "day", ...parts })
const undated = (id: string, parts: Partial<WatchLogEntry> = {}) =>
	watch(id, { at: null, precision: "unknown", ...parts })
const scoreRow = (movieId: number) =>
	undated(`score-${movieId}`, { origin: "score", createdAt: 5 })
const ids = (log: WatchLogEntry[]) => log.map((entry) => entry.id)

test("the log lists dated watches newest first and the undated ones below, last recorded first", () => {
	const log = [
		undated("old-import", { createdAt: 10 }),
		day("a-day", "2019-03-12"),
		undated("new-undated", { createdAt: 20 }),
		watch("a-moment", { at: at("2026-09-28T19:40:00Z") }),
		day("same-day", "2026-09-28"),
	]
	assert.deepEqual(ids(orderWatches(log)), [
		"a-moment",
		// A day-precise watch sorts at the start of its UTC day, after a watch with a time on that day.
		"same-day",
		"a-day",
		"new-undated",
		"old-import",
	])
})

test("a watch with a time shows the day and the time in the viewer's zone; today and yesterday are named", () => {
	// 23:30 UTC on the 6th is 01:30 on the 7th in Berlin: today.
	assert.deepEqual(
		watchLabel(watch("w", { at: at("2026-10-06T23:30:00Z") }), NOW, BERLIN),
		{ day: "Today", time: "01:30" },
	)
	assert.deepEqual(
		watchLabel(watch("w", { at: at("2026-10-06T19:40:00Z") }), NOW, BERLIN),
		{ day: "Yesterday", time: "21:40" },
	)
	assert.deepEqual(
		watchLabel(watch("w", { at: at("2026-09-28T19:40:00Z") }), NOW, BERLIN),
		{ day: "28 Sept 2026", time: "21:40" },
	)
})

test("a watch with a day shows that calendar day wherever the viewer is, and never a time", () => {
	const march = day("w", "2019-03-12")
	assert.deepEqual(watchLabel(march, NOW, BERLIN), { day: "12 Mar 2019" })
	assert.deepEqual(watchLabel(march, NOW, "Pacific/Honolulu"), {
		day: "12 Mar 2019",
	})
	assert.deepEqual(watchLabel(day("w", "2026-10-07"), NOW, BERLIN), {
		day: "Today",
	})
	assert.deepEqual(watchLabel(day("w", "2026-10-06"), NOW, BERLIN), {
		day: "Yesterday",
	})
})

test("a watch without a date says so", () => {
	assert.deepEqual(watchLabel(undated("w"), NOW, BERLIN), {
		day: "Date unknown",
	})
	assert.equal(whenText(undated("w"), NOW, BERLIN), "date unknown")
	assert.equal(
		whenText(day("w", "2019-03-12"), NOW, BERLIN),
		"on 12 Mar 2019",
	)
	assert.equal(
		whenText(watch("w", { at: at("2026-10-06T23:30:00Z") }), NOW, BERLIN),
		"today, 01:30",
	)
})

test("the device's day, and the day before it", () => {
	assert.equal(localDay(new Date("2026-10-06T23:30:00Z"), BERLIN), "2026-10-07")
	assert.equal(localDay(new Date("2026-10-06T23:30:00Z"), "UTC"), "2026-10-06")
	assert.equal(dayBefore("2026-03-01"), "2026-02-28")
})

test("an import names its platform", () => {
	assert.equal(sourceName("imdb"), "IMDb")
	assert.equal(sourceName("letterboxd"), "Letterboxd")
	assert.equal(sourceName("trakt"), "Trakt")
	assert.equal(sourceName("somewhere"), "Somewhere")
	assert.equal(sourceName(null), null)
})

test("the score's watch is not a watch the member logged", () => {
	assert.equal(scoredOnly([scoreRow(603)]), true)
	assert.equal(scoredOnly([]), false)
	assert.equal(scoredOnly([watch("w")]), false)
	assert.deepEqual(memberWatches([scoreRow(603)]), [])
	assert.deepEqual(ids(memberWatches([watch("w"), undated("u")])), ["w", "u"])
})

test("the count shows from two watches on", () => {
	assert.equal(countLabel(0), null)
	assert.equal(countLabel(1), null)
	assert.equal(countLabel(2), "2×")
	assert.equal(countLabel(3), "3×")
})

test("what the member data says about a log: the count and the latest dated watch", () => {
	assert.equal(summaryOf([]), null)
	assert.deepEqual(summaryOf([scoreRow(603)]), {
		count: 1,
		watchedAt: null,
		precision: "unknown",
	})
	assert.deepEqual(
		summaryOf([
			undated("u"),
			day("d", "2026-10-01"),
			watch("m", { at: at("2026-09-28T19:40:00Z") }),
		]),
		{ count: 3, watchedAt: new Date("2026-10-01T00:00:00Z"), precision: "day" },
	)
	assert.deepEqual(summaryOf([day("d", "2026-09-01"), watch("m")]), {
		count: 2,
		watchedAt: new Date("2026-10-06T19:40:00Z"),
		precision: "moment",
	})
})

test("a new watch is the member's own: now, a day at midnight UTC, or no date", () => {
	assert.deepEqual(newWatch("id-1", { precision: "moment" }, NOW), {
		id: "id-1",
		at: NOW.getTime(),
		precision: "moment",
		origin: "single",
		importId: null,
		source: null,
		createdAt: NOW.getTime(),
	})
	assert.equal(
		newWatch("id-2", { precision: "day", day: "2026-10-01" }, NOW).at,
		at("2026-10-01T00:00:00Z"),
	)
	assert.equal(newWatch("id-3", { precision: "unknown" }, NOW).at, null)
})

test("a watch the member logs replaces the score's watch and takes its place in the order", () => {
	const added = withWatch(
		[scoreRow(603)],
		newWatch("mine", { precision: "moment" }, NOW),
	)
	assert.deepEqual(ids(added), ["mine"])
	const second = withWatch(
		added,
		newWatch("older", { precision: "day", day: "2020-01-01" }, NOW),
	)
	assert.deepEqual(ids(second), ["mine", "older"])
	// The same watch sent again is in the log once.
	assert.deepEqual(ids(withWatch(second, second[0])), ["mine", "older"])
})

test("editing a date sets a day or no date, and a day makes the score's watch the member's own", () => {
	const log = [watch("m"), day("d", "2026-09-01")]
	const edited = withDate(log, "d", { precision: "day", day: "2026-10-07" })
	assert.deepEqual(ids(edited), ["d", "m"])
	assert.deepEqual(
		[edited[0].at, edited[0].precision],
		[at("2026-10-07T00:00:00Z"), "day"],
	)
	const unknown = withDate(log, "m", { precision: "unknown" })
	assert.deepEqual(ids(unknown), ["d", "m"])
	assert.deepEqual([unknown[1].at, unknown[1].precision], [null, "unknown"])

	const own = withDate([scoreRow(603)], "score-603", {
		precision: "day",
		day: "2026-10-01",
	})
	assert.equal(own[0].origin, "single")
	const still = withDate([scoreRow(603)], "score-603", { precision: "unknown" })
	assert.equal(still[0].origin, "score")
})

test("deleting the last watch of a rated movie brings the score's watch back", () => {
	const log = [watch("a"), undated("b")]
	assert.deepEqual(ids(withoutWatch(log, "a", { movieId: 603, scored: true, now: NOW })), ["b"])
	assert.deepEqual(
		withoutWatch([watch("a")], "a", { movieId: 603, scored: true, now: NOW }),
		[
			{
				id: "score-603",
				at: null,
				precision: "unknown",
				origin: "score",
				importId: null,
				source: null,
				createdAt: NOW.getTime(),
			},
		],
	)
	assert.deepEqual(
		withoutWatch([watch("a")], "a", { movieId: 603, scored: false, now: NOW }),
		[],
	)
	// Without an id, every watch the member logged goes.
	assert.deepEqual(
		ids(withoutWatch(log, null, { movieId: 603, scored: true, now: NOW })),
		["score-603"],
	)
})

test("Undo puts the same rows back, once, in their place", () => {
	const gone = [day("d", "2026-09-01"), undated("u")]
	const restored = withRestored([scoreRow(603), watch("m")], gone)
	assert.deepEqual(ids(restored), ["m", "d", "u"])
	assert.deepEqual(ids(withRestored(restored, gone)), ["m", "d", "u"])
	assert.deepEqual(restored[1], gone[0])
})
