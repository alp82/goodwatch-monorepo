import assert from "node:assert/strict"
import { test } from "node:test"
import {
	PROFILE_CARD_TABS,
	mediumWord,
	peakDecade,
	pickAttributes,
	pullWords,
	scoresLine,
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
