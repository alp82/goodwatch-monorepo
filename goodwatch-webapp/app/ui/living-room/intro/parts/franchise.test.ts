// One title per franchise in a row (franchise.ts): no three Star Wars in the search, no three Lord of the Rings in
// the Explorer.
import assert from "node:assert/strict"
import { test } from "node:test"
import type { IntroData } from "../scene.ts"
import { onePerFranchise } from "./franchise.ts"

const movie = (id: number, title: string) => ({
	key: 1_000_000_000_000 + id,
	title,
})
const show = (id: number, title: string) => ({
	key: 2_000_000_000_000 + id,
	title,
})
const data = {
	pool: [],
	extra: {
		franchise: {
			series: {
				"11": 10,
				"1891": 10,
				"140607": 10,
				"120": 119,
				"121": 119,
				"122": 119,
			},
		},
	},
} as IntroData

test("keeps the first title of each TMDB collection, in order", () => {
	const row = [
		movie(157336, "Interstellar"),
		movie(11, "Star Wars"),
		movie(1891, "The Empire Strikes Back"),
		movie(286217, "The Martian"),
		movie(140607, "Star Wars: The Force Awakens"),
	]
	assert.deepEqual(
		onePerFranchise(data, row, 6).map((t) => t.title),
		["Interstellar", "Star Wars", "The Martian"],
	)
})

test("keeps one Lord of the Rings, and stops at n", () => {
	const row = [
		movie(122, "The Lord of the Rings: The Return of the King"),
		movie(120, "The Lord of the Rings: The Fellowship of the Ring"),
		show(1399, "Game of Thrones"),
		movie(27205, "Inception"),
		movie(121, "The Lord of the Rings: The Two Towers"),
	]
	assert.deepEqual(
		onePerFranchise(data, row, 2).map((t) => t.title),
		["The Lord of the Rings: The Return of the King", "Game of Thrones"],
	)
})

test("tells a franchise without a collection by its name", () => {
	const row = [
		show(1, "Star Trek: Discovery"),
		movie(2, "Star Trek Beyond"),
		movie(3, "Arrival"),
	]
	assert.deepEqual(
		onePerFranchise({ pool: [], extra: {} } as IntroData, row, 5).map(
			(t) => t.title,
		),
		["Star Trek: Discovery", "Arrival"],
	)
})
