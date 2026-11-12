import assert from "node:assert/strict"
import { test } from "node:test"
import {
	chooseExactSearch,
	exactName,
	exactSearchParams,
	type ExactEntity,
} from "./exact-search.ts"

const entities: ExactEntity[] = [
	{
		kind: "trope",
		id: "trope:a",
		label: "Apocalypse Anarchy",
		names: ["Apocalypse Anarchy", "End Of Order"],
	},
	{
		kind: "title",
		id: "1000000329865",
		label: "Arrival",
		names: ["Arrival", "Premier Contact"],
		year: 2016,
	},
	{
		kind: "title",
		id: "1000000000841",
		label: "Dune",
		names: ["Dune"],
		year: 1984,
	},
	{
		kind: "title",
		id: "1000000431969",
		label: "Dune",
		names: ["Dune"],
		year: 2021,
	},
	{
		kind: "title",
		id: "2000000070555",
		label: "Dark",
		names: ["Dark"],
		year: 2017,
	},
	{
		kind: "title",
		id: "1000000060494",
		label: "Like Crazy",
		names: ["Like Crazy"],
		year: 2011,
	},
]
const lookup = (name: string) =>
	entities.filter((e) => e.names.some((n) => exactName(n) === name))
const resolve = (text: string) =>
	chooseExactSearch(text, lookup, new Set(["dark"]))

test("a bare movie title must not become a Like filter", () => {
	const coneheads: ExactEntity = {
		kind: "title",
		id: "1000000009612",
		label: "Coneheads",
		names: ["Coneheads"],
		year: 1993,
	}
	const lookup = (name: string) => (name === "coneheads" ? [coneheads] : [])
	for (const query of ["coneheads", "Coneheads (1993)", '"Coneheads"'])
		assert.equal(chooseExactSearch(query, lookup), null, query)
	assert.equal(chooseExactSearch("like Coneheads", lookup)?.id, coneheads.id)
})

test("whole trope names and explicit title references resolve without guessing", () => {
	for (const q of [
		"Apocalypse Anarchy",
		" apocalypse   anarchy ",
		"End Of Order",
	])
		assert.equal(resolve(q)?.kind, "trope")
	for (const q of [
		"like Arrival",
		"movies similar to Arrival",
		"like Premier Contact",
		"like arrival (2016)",
		"shows like Arrival",
		"series similar to Arrival",
	])
		assert.equal(resolve(q)?.id, "1000000329865", q)
	assert.equal(resolve("like Dune 2021")?.id, "1000000431969")
	assert.equal(resolve("similar to Dune (1984)")?.id, "1000000000841")
	assert.equal(resolve("like Like Crazy")?.id, "1000000060494")
})

test("ambiguity, prefixes, negation and unresolved intent remain ordinary searches", () => {
	for (const q of [
		"Arrival",
		"arrival (2016)",
		"Premier Contact",
		'"Arrival"',
		"Dune 2021",
		"Dune (1984)",
		'"Dark"',
		"Like Crazy",
		"Dune",
		"like Dune",
		"Dark",
		"Arriv",
		"Apocalypse",
		"without Apocalypse Anarchy",
		"Arrival but funnier",
		"Apocalypse Anarchy with a moving ending",
		"Compelling Leads",
		"Arrival 1990",
	])
		assert.equal(resolve(q), null, q)
	const collision = { ...entities[0], names: ["Arrival"] }
	assert.equal(
		chooseExactSearch("Arrival", (name) => [...lookup(name), collision]),
		null,
	)
})

test("confirmed readings become shareable filters while own choices and unrelated settings survive", () => {
	const params = exactSearchParams(
		new URLSearchParams(
			"q=Arrival&asked=Arrival&off=Arrival&page=3&sort=top&services=8",
		),
		resolve("like Arrival")!,
	)
	assert.equal(params.get("similar"), "1000000329865")
	assert.equal(params.get("services"), "8")
	assert.equal(params.get("sort"), "top")
	for (const key of ["q", "asked", "off", "page"])
		assert.equal(params.has(key), false)
	const own = exactSearchParams(
		new URLSearchParams("similar=1000000000550&q=Arrival"),
		resolve("like Arrival")!,
	)
	assert.equal(own.get("similar"), "1000000000550")
})
