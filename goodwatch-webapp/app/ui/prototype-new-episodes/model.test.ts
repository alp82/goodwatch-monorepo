// PROTOTYPE - throwaway. The sample members of /prototype/new-episodes give the counts their labels promise, the
// waiting shows come soonest first with the words the note describes, and the signal follows the rule it states.
import assert from "node:assert/strict"
import { test } from "node:test"
import "../../server/title-filter/test-alias.ts"

const {
	MEMBERS,
	START_DAY,
	addDays,
	factsOf,
	planOf,
	showsOf,
	signalOf,
	signalWords,
	sinceOf,
	upcomingOf,
	whenWords,
} = await import("./model.ts")

type Member = keyof typeof MEMBERS
const signal = (
	member: Member,
	today = START_DAY,
	clears: "open" | "watched" = "open",
) =>
	signalOf(
		showsOf(member),
		today,
		sinceOf(clears, today, MEMBERS[member].lastOpened),
	)
const titles = (member: Member, today = START_DAY) =>
	signal(member, today).shows.map((s) => s.show.title)

test("each sample member has the new shows and episodes its label says", () => {
	const counts = (member: Member) => [
		signal(member).shows.length,
		signal(member).episodes,
	]
	assert.deepEqual(counts("none"), [0, 0])
	assert.deepEqual(counts("one"), [1, 1])
	assert.deepEqual(counts("season"), [1, 8])
	assert.deepEqual(counts("mixed"), [4, 12])
	assert.deepEqual(counts("many"), [11, 42])
})

test("a show counts when its Next episode aired after the last visit, the latest to air first", () => {
	assert.deepEqual(titles("mixed"), [
		"The White Lotus",
		"Wednesday",
		"Only Murders in the Building",
		"Slow Horses",
	])
})

test("a show the member is behind on, an On hold show and a watched new episode do not count", () => {
	const shows = showsOf("mixed")
	const since = MEMBERS.mixed.lastOpened
	const fresh = (key: string) => {
		const show = shows.find((s) => s.key === key)
		assert.ok(show)
		return factsOf(show, START_DAY).unwatched.filter(
			(e) => e.airDate !== null && e.airDate > since,
		).length
	}
	// Industry and The Last of Us have an episode that aired after the last visit, and are left out all the same.
	assert.equal(fresh("industry"), 1)
	assert.equal(fresh("lastofus"), 1)
	assert.ok(!titles("mixed").includes("Industry"))
	assert.ok(!titles("mixed").includes("The Last of Us"))
	// Abbott Elementary's episode of 7 Oct is watched.
	assert.equal(fresh("abbott"), 0)
})

test("the words of the signal: one show is named, several are counted", () => {
	assert.equal(signalWords(signal("none"), "shows"), null)
	assert.deepEqual(signalWords(signal("one"), "shows"), {
		badge: "1",
		tile: "New: Slow Horses S6 E4",
		long: "New: Slow Horses S6 E4",
		short: "1 show",
	})
	assert.equal(
		signalWords(signal("season"), "episodes")?.long,
		"New: Wednesday, 8 episodes",
	)
	assert.equal(signalWords(signal("season"), "episodes")?.badge, "8")
	assert.equal(signalWords(signal("season"), "shows")?.badge, "1")
	assert.equal(
		signalWords(signal("mixed"), "shows")?.long,
		"4 shows have new episodes",
	)
	assert.equal(
		signalWords(signal("mixed"), "episodes")?.long,
		"12 new episodes",
	)
	assert.equal(signalWords(signal("mixed"), "dot")?.badge, null)
})

test("waiting shows come soonest first, then the ones without a date", () => {
	const waiting = planOf(showsOf("mixed"), START_DAY).waiting.map((w) => [
		w.show.title,
		upcomingOf(w.facts, START_DAY).sentence,
	])
	assert.deepEqual(waiting, [
		["Shrinking", "S3 E6 airs tomorrow"],
		["Abbott Elementary", "S6 E3 airs in 3 days"],
		["The Pitt", "S3 E2 airs in 4 days"],
		["Severance", "S3 E1 airs on 20 Nov"],
		["The Diplomat", "S4 E1 airs on 3 Dec"],
		["Fallout", "S3 E1 airs on 14 Jan 2027"],
		["House of the Dragon", "S4 E1 has no date yet"],
		["Silo", "No new episodes announced"],
	])
})

test("when an episode airs: tomorrow, in some days, and from a week out the date", () => {
	assert.equal(whenWords("2026-10-12", "2026-10-11"), "tomorrow")
	assert.equal(whenWords("2026-10-17", "2026-10-11"), "in 6 days")
	assert.equal(whenWords("2026-10-18", "2026-10-11"), "18 Oct")
	assert.equal(whenWords("2027-01-14", "2026-10-11"), "14 Jan 2027")
})

test("an episode airs on its date: tomorrow the waiting show is in Continue and the signal counts it", () => {
	const tomorrow = addDays(START_DAY, 1)
	const plan = planOf(showsOf("none"), tomorrow)
	assert.ok(plan.continue.some((c) => c.show.title === "Shrinking"))
	assert.ok(!plan.waiting.some((w) => w.show.title === "Shrinking"))
	assert.deepEqual(titles("none", tomorrow), ["Shrinking"])
})

test("without a remembered visit, the signal holds what aired in the last seven days and is not watched", () => {
	// The member who was away three weeks: Invincible's premiere is older than seven days, so the show is left out.
	const week = signal("many", START_DAY, "watched").shows.map(
		(s) => s.show.title,
	)
	assert.deepEqual(week, [
		"The White Lotus",
		"Wednesday",
		"Only Murders in the Building",
		"Slow Horses",
	])
})
