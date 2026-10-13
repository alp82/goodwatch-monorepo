import assert from "node:assert/strict"
import { test } from "node:test"
import {
	type PickedIsland,
	combinationSentence,
	sharedLine,
	sharedNote,
} from "./combination-words.ts"

const island = (id: string, name: string): PickedIsland => ({
	id,
	name,
	color: "#fff",
	group: "",
	total: 0,
	posters: [],
})

test("islands of different groupings read as one sentence, adjectives first", () => {
	assert.equal(
		combinationSentence(15, [
			island("decade:1990s", "1990s"),
			island("country:us", "United States"),
			island("theme:crime", "Crime"),
			island("style:talky", "Talky"),
			island("mood:funny", "Funny"),
		]),
		"15 titles that are Funny, Talky, about crime, from the 1990s, from the United States",
	)
})

test("two decades or two countries read as either", () => {
	assert.equal(
		combinationSentence(269, [
			island("mood:dark", "Dark"),
			island("decade:1980s", "1980s"),
			island("decade:1990s", "1990s"),
		]),
		"269 titles that are Dark, from the 1980s or the 1990s",
	)
	assert.equal(
		combinationSentence(1, [
			island("country:jp", "Japan"),
			island("country:fr", "France"),
			island("occasion:party", "Party"),
		]),
		"1 title that is for a party, from Japan or France",
	)
})

test("two moods and a third island read as both moods", () => {
	assert.equal(
		combinationSentence(40, [
			island("mood:funny", "Funny"),
			island("mood:sad", "Sad"),
			island("decade:2010s", "2010s"),
		]),
		"40 titles that are Funny and Sad, from the 2010s",
	)
})

test("a bridge keeps its words", () => {
	assert.equal(sharedLine(130, "both"), "130 titles in both")
	assert.equal(sharedLine(1, "between"), "1 title between them")
	assert.equal(sharedNote(12, "both", true), "12 in both")
	assert.equal(sharedNote(12, "between", true), "12 between")
})

test("an island says what it would leave", () => {
	assert.equal(sharedNote(1234, "all", false), "1,234 left")
	assert.equal(sharedNote(9, "both", false), "9 left")
})
