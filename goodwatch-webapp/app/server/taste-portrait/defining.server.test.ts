// The defining titles per attribute and the scores against everyone, on made-up fingerprints of four attributes.
import assert from "node:assert/strict"
import { test } from "node:test"
import {
	type DefiningAttribute,
	type DefiningCandidate,
	definingTitles,
	fingerprintMean,
	kindOffsets,
	scoresVsEveryone,
} from "./defining.server.ts"

const title = (
	key: number,
	score: number,
	fingerprint: number[],
): DefiningCandidate => ({ key, score, fingerprint })

test("a title's mean leaves out the scores its analysis missed", () => {
	assert.equal(fingerprintMean([2, 4, 255, 6]), 4)
	assert.equal(fingerprintMean([255]), 0)
})

test("titles rank by how much the attribute stands out within them, not by its raw score", () => {
	// Title 1 is high on everything; title 2 is high on attribute 0 only.
	const broad = title(1, 9, [9, 9, 9, 9])
	const pointed = title(2, 8, [8, 1, 1, 1])
	const picks = definingTitles([
		{ k: 0, family: "feel", edge: 1, carriers: [broad, pointed] },
	])
	assert.deepEqual(picks.get(0), [2, 1])
})

test("only titles scored 7 or more define an attribute, and never by a missing score", () => {
	const loved = title(1, 7, [8, 2, 2, 2])
	const disliked = title(2, 4, [10, 1, 1, 1])
	const unread = title(3, 10, [255, 1, 1, 1])
	const picks = definingTitles([
		{ k: 0, family: "feel", edge: 1, carriers: [loved, disliked, unread] },
	])
	assert.deepEqual(picks.get(0), [1])
})

test("within a family a title fills at most two lists, the strongest pulls first, and short lists top up", () => {
	const star = title(1, 10, [9, 9, 9, 1])
	const second = title(2, 8, [5, 5, 5, 1])
	const all = [star, second]
	const feel = (k: number, edge: number): DefiningAttribute => ({
		k,
		family: "feel",
		edge,
		carriers: all,
	})
	const picks = definingTitles([feel(0, 0.2), feel(1, 0.9), feel(2, 0.5)], {
		n: 1,
	})
	// Attribute 1 pulls hardest and 2 next: they take the star; attribute 0 gets the next title.
	assert.deepEqual(picks.get(1), [1])
	assert.deepEqual(picks.get(2), [1])
	assert.deepEqual(picks.get(0), [2])

	// With only the star to pick from, the third list still gets it.
	const alone = definingTitles(
		[0, 1, 2].map((k) => ({ k, family: "feel", edge: k, carriers: [star] })),
		{ n: 1 },
	)
	assert.deepEqual(alone.get(0), [1])
})

test("the cap counts per family: another family's lists start fresh", () => {
	const star = title(1, 10, [9, 9, 9, 9])
	const picks = definingTitles(
		[
			{ k: 0, family: "feel", edge: 3, carriers: [star] },
			{ k: 1, family: "feel", edge: 2, carriers: [star] },
			{ k: 2, family: "world", edge: 1, carriers: [star] },
			{ k: 3, family: "world", edge: 0, carriers: [star] },
		],
		{ n: 1, perFamily: 1 },
	)
	assert.deepEqual(picks.get(0), [1])
	// Topped up, since nothing else carries it.
	assert.deepEqual(picks.get(1), [1])
	assert.deepEqual(picks.get(2), [1])
})

test("scores against everyone allow for the person's generosity with movies and with shows apart", () => {
	const titles = [
		{ key: 1, kind: "movie" as const, score: 8, everyone: 70 },
		{ key: 2, kind: "movie" as const, score: 6, everyone: 70 },
		{ key: 3, kind: "show" as const, score: 8, everyone: 90 },
		{ key: 4, kind: "show" as const, score: 9, everyone: 90 },
	]
	const offsets = kindOffsets(titles)
	assert.equal(offsets.movie, 0)
	assert.equal(offsets.show, -5)
	// After the offsets, movie 1 reads +10 points and show 4 +5: on average +7.5, or +0.8 out of 10.
	assert.equal(scoresVsEveryone([titles[0], titles[3]], offsets, 2), 0.8)
	assert.equal(scoresVsEveryone(titles, offsets, 5), null)
	assert.equal(kindOffsets([]).show, 0)
})
