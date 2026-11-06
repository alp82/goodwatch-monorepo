import assert from "node:assert/strict"
import { test } from "node:test"
import {
	type AwardMarkRow,
	decodeAwardMarks,
	encodeAwardMarks,
	notableAwards,
	topWin,
	winnerLabel,
} from "./award-marks.ts"

const row = (
	award: string,
	category = "Cinematography",
	year = "2024",
	win = true,
): AwardMarkRow => ({
	award_name: award,
	category_name: category,
	ceremony_year: year,
	has_win: win,
	has_nomination: true,
})

test("the most prestigious body won is the mark, whatever the order or year", () => {
	assert.equal(
		topWin([
			row("BAFTA Awards", "Film", "2025"),
			row("Golden Globe Awards"),
			row("Academy Awards", "Sound", "1999"),
		]),
		"Oscar",
	)
	assert.equal(
		topWin([row("Critics' Choice Awards"), row("Primetime Emmy Awards")]),
		"Emmy",
	)
})

test("a nomination never makes the mark: a nominated Oscar loses to a won BAFTA", () => {
	assert.equal(
		topWin([
			row("Academy Awards", "Picture", "2024", false),
			row("BAFTA Awards"),
		]),
		"BAFTA",
	)
})

test("no mark without a win, and none without rows", () => {
	assert.equal(topWin([row("Academy Awards", "Picture", "2024", false)]), null)
	assert.equal(topWin([]), null)
})

test("an unknown body ranks after the known ones and keeps its own name", () => {
	assert.equal(topWin([row("Some Festival"), row("Genie Awards")]), "Genie")
	assert.equal(topWin([row("Some Festival")]), "Some Festival")
	assert.equal(winnerLabel("Oscar"), "Oscar winner")
})

test("notable results: wins only when there are wins, one per body first, headline categories ahead", () => {
	const results = notableAwards([
		row("Academy Awards", "Sound", "2024"),
		row("Academy Awards", "Best Picture", "2020"),
		row("Golden Globe Awards", "Score", "2024"),
		row("Academy Awards", "Editing", "2024", false),
		row("BAFTA Awards", "Film", "2024"),
	])
	assert.deepEqual(
		results.map((r) => `${r.award}/${r.category}/${r.won}`),
		["Oscar/Best Picture/true", "Golden Globe/Score/true", "BAFTA/Film/true"],
	)
})

test("notable results fall back to nominations when nothing was won, and are empty without rows", () => {
	assert.deepEqual(
		notableAwards([
			row("Primetime Emmy Awards", "Drama Series", "2023", false),
		]),
		[{ award: "Emmy", category: "Drama Series", year: "2023", won: false }],
	)
	assert.deepEqual(notableAwards([]), [])
})

test("the browser payload round-trips, ids ascending per body", () => {
	const payload = encodeAwardMarks([
		["movie", 872585, "Oscar"],
		["movie", 496243, "Oscar"],
		["show", 136315, "Emmy"],
	])
	assert.deepEqual(payload, {
		movie: { Oscar: [496243, 872585] },
		show: { Emmy: [136315] },
	})
	const marks = decodeAwardMarks(JSON.parse(JSON.stringify(payload)))
	assert.equal(marks.get("movie:496243"), "Oscar")
	assert.equal(marks.get("show:136315"), "Emmy")
	assert.equal(marks.get("show:496243"), undefined)
	assert.equal(decodeAwardMarks(null).size, 0)
	assert.equal(decodeAwardMarks({ movie: { Oscar: ["x", 1.5] } }).size, 0)
})
