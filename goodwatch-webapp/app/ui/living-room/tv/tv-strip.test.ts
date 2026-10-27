import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { scoreLabels } from "../../../utils/ratings.ts"
import { RATING_LEVELS } from "../../scoring/score-model.ts"
import {
	EMPTY_CONTEXT,
	STRIP_LEVELS,
	STRIP_SCORES,
	tvItems,
} from "./tv-machine.ts"
import { scoreLight, scoreWords, stripFocus, stripSays } from "./tv-strip.ts"

describe("the rating strip's focus", () => {
	it("a level is in itself, with no exact score", () => {
		RATING_LEVELS.forEach((level, at) =>
			assert.deepEqual(stripFocus(`level:${level.score}`), {
				at,
				level,
				exact: null,
			}),
		)
	})

	it("an exact score is in the level that spans it", () => {
		const names = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(
			(score) => stripFocus(`score:${score}`)?.level.name,
		)
		assert.deepEqual(
			names,
			RATING_LEVELS.flatMap((level) =>
				Array.from({ length: level.hi - level.lo + 1 }, () => level.name),
			),
		)
		assert.equal(stripFocus("score:8")?.exact, 8)
	})

	it("is nowhere on the strip for any other key", () => {
		for (const item of [
			"skip",
			"bar:back",
			"bar:menu",
			"watch",
			"level:0",
			"score:11",
			"score:x",
			"",
		])
			assert.equal(stripFocus(item), null, item)
	})

	it("knows every key the machine lists for the strip", () => {
		const desktop = { ...EMPTY_CONTEXT, titles: ["movie-1"] }
		const strip = tvItems({ name: "quiz" }, desktop).filter(
			(item) => item.startsWith("level:") || item.startsWith("score:"),
		)
		assert.equal(strip.length, STRIP_LEVELS.length + STRIP_SCORES.length)
		for (const item of strip) assert.ok(stripFocus(item), item)
	})
})

describe("what the strip says", () => {
	it("on a level: its name and the score OK gives, from the app's rating levels", () => {
		assert.deepEqual(
			RATING_LEVELS.map((level) => stripSays(`level:${level.score}`)),
			RATING_LEVELS.map(
				(level) => `${level.name} · OK gives it ${level.score}`,
			),
		)
		assert.equal(stripSays("level:7"), "Good · OK gives it 7")
		assert.equal(stripSays("level:3"), "Bad · OK gives it 3")
	})

	it("on the phone: one short line", () => {
		assert.equal(stripSays("level:7", true), "Good · gives 7")
		assert.equal(stripSays("level:9", true), "Excellent · gives 9")
	})

	it("on an exact score: the score with the app's name for it", () => {
		assert.equal(stripSays("score:8"), "8 · Great")
		assert.equal(stripSays("score:8", true), "8 · Great")
		for (const score of STRIP_SCORES)
			assert.equal(
				stripSays(`score:${score}`),
				`${score} · ${scoreLabels[score]}`,
			)
		assert.equal(scoreWords(10), "10 · Masterpiece")
	})

	it("nothing while the focus is off the strip", () => {
		assert.equal(stripSays("skip"), null)
		assert.equal(stripSays("bar:back"), null)
	})
})

describe("how the scores are lit", () => {
	it("evenly while the focus is off the strip", () => {
		for (const score of STRIP_SCORES)
			assert.equal(scoreLight(score, null), "even")
	})

	it("a level lights its own scores and dims the others", () => {
		const good = stripFocus("level:7")
		assert.deepEqual(
			STRIP_SCORES.map((score) => scoreLight(score, good)),
			["dim", "dim", "dim", "dim", "dim", "dim", "lit", "lit", "dim", "dim"],
		)
		const bad = stripFocus("level:3")
		assert.deepEqual(
			STRIP_SCORES.map((score) => scoreLight(score, bad)),
			["lit", "lit", "lit", "lit", "dim", "dim", "dim", "dim", "dim", "dim"],
		)
	})

	it("an exact score is on, and its level's other score is lit", () => {
		const eight = stripFocus("score:8")
		assert.equal(scoreLight(8, eight), "on")
		assert.equal(scoreLight(7, eight), "lit")
		assert.equal(scoreLight(9, eight), "dim")
	})
})
