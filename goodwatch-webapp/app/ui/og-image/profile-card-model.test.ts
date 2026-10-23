import assert from "node:assert/strict"
import { test } from "node:test"
import {
	PROFILE_CARD_TABS,
	everyoneTakes,
	labelCenters,
	mediumWord,
	peakDecade,
	pickAttributes,
	profileCardPaths,
	pullWords,
	scoresLine,
	sidesPair,
} from "./profile-card-model.ts"

const a = (key: string, family: string, edge: number) => ({
	key,
	label: key,
	family,
	edge,
})

test("picks take the strongest pulls, at most two per family", () => {
	const picks = pickAttributes([
		a("novelty", "story", 1.7),
		a("rewatch", "story", 1.4),
		a("absurd", "humor", 1.3),
		a("eccentric", "story", 1.26),
		a("surreal", "story", 1.24),
		a("satire", "humor", 1.16),
		a("music", "craft", 1.1),
	])
	assert.deepEqual(
		picks.map((p) => p.key),
		["novelty", "rewatch", "absurd", "satire"],
	)
})

test("picks leave out what they avoid", () => {
	assert.deepEqual(
		pickAttributes([
			a("x", "feel", 0.4),
			a("y", "feel", -0.2),
			a("z", "world", 0),
		]).map((p) => p.key),
		["x"],
	)
})

test("the scores line words the spread without counts", () => {
	assert.equal(
		scoresLine([0, 2, 10, 28, 56, 194, 313, 269, 121, 15]),
		"Usually a 7 · 40% get 8 or more",
	)
	assert.equal(scoresLine(Array(10).fill(0)), null)
})

test("the seen line's decade and medium", () => {
	assert.equal(
		peakDecade([
			{ decade: 1990, count: 188 },
			{ decade: 2000, count: 380 },
			{ decade: 2010, count: 228 },
		]),
		"2000s",
	)
	assert.equal(peakDecade([]), null)
	assert.equal(mediumWord(0.88), "Mostly movies")
	assert.equal(mediumWord(0.2), "Mostly shows")
	assert.equal(mediumWord(0.5), "Movies and shows alike")
})

test("the taste line joins the first two pulls in lowercase", () => {
	assert.equal(
		pullWords([
			{ label: "Novelty" },
			{ label: "Absurdist Humor" },
			{ label: "X" },
		]),
		"novelty and absurdist humor",
	)
})

test("every profile tab has a card", () => {
	assert.deepEqual([...PROFILE_CARD_TABS].sort(), [
		"lists",
		"scores",
		"seen",
		"shows",
		"taste",
		"wishlist",
	])
})

const r = (
	title: string,
	mine: number,
	everyone: number,
	poster: string | null = `/${title}.jpg`,
) => ({
	title,
	poster,
	mine,
	everyone,
})
const ready = (
	higher: ReturnType<typeof r>[],
	lower: ReturnType<typeof r>[],
) => ({
	status: "ready" as const,
	higher,
	lower,
})

test("the everyone card takes the strongest title above everyone and the strongest below", () => {
	const takes = everyoneTakes(
		ready(
			[r("Click", 10, 52), r("Yes Man", 10, 56)],
			[r("Star Wars", 1, 89), r("Alien", 2, 85)],
		),
		true,
	)
	assert.deepEqual(takes, [
		{ title: "Click", poster: "/Click.jpg", mine: 10, everyone: 5.2 },
		{ title: "Star Wars", poster: "/Star Wars.jpg", mine: 1, everyone: 8.9 },
	])
})

test("everyone's score is in points out of 10, one decimal", () => {
	const [take] = everyoneTakes(ready([r("A", 9, 73.6)], []), true) ?? []
	assert.equal(take.everyone, 7.4)
	assert.equal(take.mine, 9)
})

test("with one side empty the everyone card takes the two strongest of the other", () => {
	const only = (
		higher: ReturnType<typeof r>[],
		lower: ReturnType<typeof r>[],
	) => everyoneTakes(ready(higher, lower), true)?.map((t) => t.title)
	assert.deepEqual(only([r("A", 10, 50), r("B", 9, 50), r("C", 9, 60)], []), [
		"A",
		"B",
	])
	assert.deepEqual(only([], [r("X", 2, 80), r("Y", 3, 80)]), ["X", "Y"])
	assert.deepEqual(only([r("A", 10, 50)], []), ["A"])
})

test("the everyone card skips titles without a poster", () => {
	const takes = everyoneTakes(
		ready([r("A", 10, 50, null), r("B", 9, 50)], [r("X", 2, 80, null)]),
		true,
	)
	assert.deepEqual(
		takes?.map((t) => t.title),
		["B"],
	)
})

test("no everyone card with scores hidden, too few ratings, or no rows", () => {
	const rows = ready([r("A", 10, 50)], [r("X", 2, 80)])
	assert.equal(everyoneTakes(rows, false), null)
	assert.equal(everyoneTakes({ ...rows, status: "empty" }, true), null)
	assert.equal(everyoneTakes({ ...rows, status: "unavailable" }, true), null)
	assert.equal(everyoneTakes(ready([], []), true), null)
	assert.equal(everyoneTakes(null, true), null)
})

const side = (
	id: string,
	posters: (string | null)[] = ["/a.jpg", null, "/b.jpg", "/c.jpg", "/d.jpg"],
) => ({
	id,
	name: `Group ${id}`,
	family: "story" as const,
	posters,
})

test("the sides card pairs the two groups least alike, three posters each", () => {
	const pair = sidesPair({
		status: "ready",
		headline: { first: "b", second: "d" },
		sides: [side("a"), side("b"), side("c"), side("d")],
	})
	assert.deepEqual(
		pair?.map((s) => s.name),
		["Group b", "Group d"],
	)
	assert.deepEqual(pair?.[0].posters, ["/a.jpg", "/b.jpg", "/c.jpg"])
})

test("without a headline the sides card pairs the first and last groups", () => {
	const pair = sidesPair({
		status: "ready",
		headline: null,
		sides: [side("a"), side("b"), side("c")],
	})
	assert.deepEqual(
		pair?.map((s) => s.name),
		["Group a", "Group c"],
	)
})

test("no sides card with fewer than two groups or a view that isn't ready", () => {
	assert.equal(
		sidesPair({ status: "ready", headline: null, sides: [side("a")] }),
		null,
	)
	assert.equal(sidesPair({ status: "empty", headline: null, sides: [] }), null)
	assert.equal(sidesPair(null), null)
})

test("the two numbers move apart only when they'd overlap, and stay in the box", () => {
	assert.deepEqual(labelCenters(100, 600, 110, 900), [100, 600])
	assert.deepEqual(labelCenters(400, 440, 110, 900), [365, 475])
	assert.deepEqual(labelCenters(440, 400, 110, 900), [475, 365])
	// Near an end the pair shifts together.
	assert.deepEqual(labelCenters(40, 60, 110, 900), [55, 165])
	assert.deepEqual(labelCenters(860, 850, 110, 900), [845, 735])
})

test("a profile's card paths: main, each tab, and the two Taste tab sections", () => {
	const paths = profileCardPaths("film_fan")
	assert.equal(paths[0], "/u/film_fan")
	assert.ok(paths.includes("/u/film_fan/taste"))
	assert.ok(paths.includes("/u/film_fan/taste/everyone"))
	assert.ok(paths.includes("/u/film_fan/taste/sides"))
	assert.equal(paths.length, 1 + PROFILE_CARD_TABS.length + 2)
})
