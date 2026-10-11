// New episodes for the shows a member tracks (#442): when a waiting show's next episode airs and how that reads,
// which shows are new since the member last opened My shows, and what the signal outside My shows says. Expected
// values are worked out by hand from the decisions on #437.
import assert from "node:assert/strict"
import { test } from "node:test"
import "../server/title-filter/test-alias.ts"

const { whenWords, upcomingWords, firstUpcoming, soonestFirst, sinceOf, newShowsOf, summaryOf, signalWords, arrivalWords } =
	await import("./new-episodes.ts")

test("the day an episode airs reads as tomorrow, in some days, and from a week out as the date", () => {
	const today = "2026-10-11"
	assert.equal(whenWords("2026-10-12", today), "tomorrow")
	assert.equal(whenWords("2026-10-13", today), "in 2 days")
	assert.equal(whenWords("2026-10-17", today), "in 6 days")
	assert.equal(whenWords("2026-10-18", today), "18 Oct")
	assert.equal(whenWords("2026-11-20", today), "20 Nov")
	// Another year is said.
	assert.equal(whenWords("2027-01-14", today), "14 Jan 2027")
})

test("an episode that airs on the member's day, or aired the day before it, reads as today", () => {
	// The list goes by the UTC date, the words by the member's: a member ahead of UTC waits for today's episode.
	assert.equal(whenWords("2026-10-11", "2026-10-11"), "today")
	assert.equal(whenWords("2026-10-11", "2026-10-12"), "today")
})

// ---------------------------------------------------------------------------------------------------------

const ep = (season: number, number: number, airDate: string) => ({ season, number, name: `S${season}E${number}`, airDate })

test("a waiting show's next episode is the one that airs first; on one day, the lowest number", () => {
	// A season dropped on one day, listed out of order, and the season after it.
	const listed = [ep(4, 1, "2027-03-01"), ep(3, 2, "2026-12-03"), ep(3, 1, "2026-12-03"), ep(3, 3, "2026-12-03")]
	assert.equal(firstUpcoming(listed)?.name, "S3E1")
	assert.equal(firstUpcoming([]), null)
})

test("waiting shows come soonest first, and the ones without a date after them in the order they had", () => {
	const row = (id: number, airDate: string | null) => ({ id, upcoming: airDate ? ep(1, 1, airDate) : null })
	const rows = [row(1, null), row(2, "2026-11-20"), row(3, null), row(4, "2026-10-12"), row(5, "2026-10-14")]
	assert.deepEqual(soonestFirst(rows).map((r) => r.id), [4, 5, 2, 1, 3])
})

test("a waiting row says the day in a column of its own, and under it the date or how far it is", () => {
	const today = "2026-10-11"
	assert.deepEqual(upcomingWords(ep(3, 6, "2026-10-12"), today), { when: "Tomorrow", detail: "Mon 12 Oct" })
	assert.deepEqual(upcomingWords(ep(6, 3, "2026-10-14"), today), { when: "In 3 days", detail: "Wed 14 Oct" })
	assert.deepEqual(upcomingWords(ep(3, 1, "2026-10-18"), today), { when: "18 Oct", detail: "in 1 week" })
	assert.deepEqual(upcomingWords(ep(3, 1, "2026-11-20"), today), { when: "20 Nov", detail: "in 6 weeks" })
	assert.deepEqual(upcomingWords(ep(3, 1, "2027-01-14"), today), { when: "14 Jan 2027", detail: "in 14 weeks" })
	// For a member ahead of UTC, on the day itself.
	assert.deepEqual(upcomingWords(ep(3, 6, "2026-10-11"), today), { when: "Today", detail: "Sun 11 Oct" })
	// The catalog has no dated episode to come.
	assert.deepEqual(upcomingWords(null, today), { when: null, detail: "No date yet" })
})

// ---------------------------------------------------------------------------------------------------------
// New since the last visit

const VISIT = Date.parse("2026-10-06T19:30:00Z")
const NOW = Date.parse("2026-10-11T20:00:00Z")

test("what counts is what aired after the day of the last visit; without a visit, in the last seven days", () => {
	// An episode dated the day of the visit had aired when the member looked.
	assert.deepEqual(sinceOf(VISIT, NOW), { day: "2026-10-06", visited: true })
	assert.deepEqual(sinceOf(null, NOW), { day: "2026-10-04", visited: false })
})

const candidate = (id: number, title: string, state: string, nextAir: string | null, newEpisodes = 1) => ({
	id,
	title,
	state,
	next: nextAir === null ? null : { season: 6, number: id, name: null, airDate: nextAir },
	unwatched: newEpisodes,
})

test("a show is new when its Next episode aired after the last visit, the latest to air first", () => {
	const fresh = newShowsOf(
		[
			// Watching, and its Next episode aired the day after the visit.
			candidate(1, "Slow Horses", "watching", "2026-10-07"),
			// Seen, a season dropped: its Next episode is the first of eight.
			candidate(2, "Wednesday", "seen", "2026-10-09", 8),
			// Nine behind: an episode aired since, but the Next episode is an old one.
			candidate(3, "Industry", "watching", "2026-08-14", 9),
			// Its Next episode aired on the day of the visit: the member saw it then.
			candidate(4, "Hacks", "seen", "2026-10-06"),
			// No episode list, so no Next episode to date.
			candidate(5, "Silo", "watching", null),
		],
		"2026-10-06",
	)
	assert.deepEqual(fresh, [
		{ id: 2, title: "Wednesday", season: 6, number: 2, episodes: 8, airDate: "2026-10-09" },
		{ id: 1, title: "Slow Horses", season: 6, number: 1, episodes: 1, airDate: "2026-10-07" },
	])
})

test("an On hold show and a Dropped show are never new", () => {
	const fresh = newShowsOf(
		[candidate(1, "The Last of Us", "on_hold", "2026-10-09"), candidate(2, "The Idol", "dropped", "2026-10-09")],
		"2026-10-06",
	)
	assert.deepEqual(fresh, [])
})

// ---------------------------------------------------------------------------------------------------------
// What the signal says

const fresh = (id: number, title: string, episodes = 1) => ({ id, title, season: 6, number: 4, episodes, airDate: "2026-10-07" })

test("the signal counts shows, and names the show when there is one", () => {
	assert.equal(signalWords(summaryOf([])), null)
	assert.deepEqual(signalWords(summaryOf([fresh(1, "Slow Horses")])), {
		badge: "1",
		tile: "New: Slow Horses S6 E4",
		door: "New: Slow Horses S6 E4",
		doorShort: "1 show",
	})
	// A season dropped at once is one show.
	assert.deepEqual(signalWords(summaryOf([fresh(2, "Wednesday", 8)])), {
		badge: "1",
		tile: "New: Wednesday, 8 episodes",
		door: "New: Wednesday, 8 episodes",
		doorShort: "1 show",
	})
	assert.deepEqual(signalWords(summaryOf([fresh(1, "A"), fresh(2, "B", 8), fresh(3, "C"), fresh(4, "D", 2)])), {
		badge: "4",
		tile: "New in 4 shows",
		door: "4 shows have new episodes",
		doorShort: "4 shows",
	})
	assert.equal(signalWords({ shows: 120, only: null })?.badge, "99+")
})

test("My shows says once what was new on arrival: three names, then how many more", () => {
	const today = "2026-10-11"
	assert.equal(arrivalWords({ day: "2026-10-06", visited: true }, [], today), null)
	assert.deepEqual(arrivalWords({ day: "2026-10-06", visited: true }, ["The White Lotus"], today), {
		lead: "New since 6 Oct:",
		names: "The White Lotus",
	})
	assert.deepEqual(arrivalWords({ day: "2026-10-06", visited: true }, ["A", "B", "C", "D", "E"], today), {
		lead: "New since 6 Oct:",
		names: "A, B, C and 2 more",
	})
	// A member who has not opened My shows since the signal exists.
	assert.deepEqual(arrivalWords({ day: "2026-10-04", visited: false }, ["A", "B"], today), {
		lead: "New in the last 7 days:",
		names: "A, B",
	})
})
