import assert from "node:assert/strict"
import { test } from "node:test"
import {
	nameTier,
	sameName,
	squash,
	startsTitle,
} from "./title-prefix.server.ts"

test("a squashed name drops its spaces and keeps where each word starts", () => {
	assert.deepEqual(squash("the lord of war"), {
		text: "thelordofwar",
		starts: [0, 3, 7, 9],
	})
	assert.deepEqual(squash(""), { text: "", starts: [] })
})

test("names are the same with or without spaces", () => {
	assert.equal(sameName("spider man", "spiderman"), true)
	assert.equal(sameName("wall e", "walle"), true)
	assert.equal(sameName("spider man", "spider"), false)
	assert.equal(sameName("", ""), false)
})

test("the palette's tiers: the name's start, then a later word's start, spaces aside", () => {
	const name = squash("the amazing spider man")
	assert.equal(nameTier(name, "theamaz"), 0)
	assert.equal(nameTier(name, "spiderm"), 1)
	assert.equal(nameTier(name, "amazingspider"), 1)
	assert.equal(nameTier(name, "pider"), -1, "not inside a word")
	assert.equal(nameTier(name, ""), -1)
})

test("a query starts a title, after an article, across word breaks, but one word must run past the first", () => {
	assert.equal(startsTitle("lord of war", "lord of"), true)
	assert.equal(startsTitle("the lord of the rings", "lord of"), true)
	assert.equal(startsTitle("star wars", "star w"), true)
	assert.equal(startsTitle("spider man homecoming", "spiderman"), true)
	assert.equal(startsTitle("spider man homecoming", "spiderm"), true)
	assert.equal(startsTitle("the dark knight", "dark"), false)
	assert.equal(startsTitle("spider man homecoming", "spider"), false)
	assert.equal(startsTitle("warlord of mars", "lord of"), false)
})
