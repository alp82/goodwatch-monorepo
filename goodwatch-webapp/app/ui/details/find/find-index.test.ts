import "react"
import assert from "node:assert/strict"
import { test } from "node:test"
import "../../../server/title-filter/test-alias.ts"

const { buildFindIndex, findIn, normalize } = await import("./find-index.ts")

const media = {
	mediaType: "show",
	details: {
		title: "Severance",
		genres: [],
		keywords: [],
		tropes: ["Corporate Dystopia"],
	},
	fingerprint: null,
} as never
const grid = {
	seasons: [
		{
			number: 1,
			episodes: [
				{ number: 9, name: "The We We Are", score: 9.7, unrated: false },
				{ number: 3, name: "In Perpetuity", score: 8.1, unrated: false },
			],
		},
	],
} as never
const sections = [
	{
		id: "watch",
		label: "Where to watch",
		peek: "Stream on Apple TV",
		aliases: "watch stream",
	},
	{
		id: "episodes",
		label: "Episodes",
		peek: 'best: S1E9 "The We We Are"',
		aliases: "seasons",
	},
	{ id: "tropes", label: "Tropes", peek: "Corporate Dystopia" },
]
const index = buildFindIndex({
	media,
	country: "DE",
	sections,
	questions: [],
	grid,
	stream: [],
	rentBuy: [],
})

test("accents and case don't matter", () => {
	assert.equal(normalize("Ólafur Arnalds"), "olafur arnalds")
})

test("an episode is found by its code, with leading zeros or without", () => {
	assert.equal(findIn(index, "s1e9")[0]?.entry.title, "S1E9 · The We We Are")
	assert.equal(findIn(index, "S01E03")[0]?.entry.title, "S1E3 · In Perpetuity")
})

test("short words count only at a word's start", () => {
	const hits = findIn(index, "we")
	assert.ok(hits.some((h) => h.entry.title === "S1E9 · The We We Are"))
	assert.ok(!hits.some((h) => h.entry.title.includes("Perpetuity")))
})

test("a direct match ranks over a match in a section's gist", () => {
	const hits = findIn(index, "the we we are")
	assert.equal(hits[0].entry.section, "episodes")
	assert.equal(hits[0].entry.needle, "The We We Are")
})

test("sections without a place on the page get no entries", () => {
	assert.ok(!index.some((e) => e.section === "faq" || e.section === "facts"))
	assert.ok(
		index.some(
			(e) => e.section === "tropes" && e.title === "Corporate Dystopia",
		),
	)
})
