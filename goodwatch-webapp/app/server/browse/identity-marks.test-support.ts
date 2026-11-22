import assert from "node:assert/strict"
import type { Family, Ingredient } from "~/domain/browse/address"
import type { PlaceRef } from "~/domain/browse/types"
import { loadMarks } from "./card-marks.server"
import type { Places } from "./places.server"

const country: PlaceRef = { family: "country", slug: "japan", label: "Japan", code: "JP" }
const genre: PlaceRef = { family: "genre", slug: "drama", label: "Drama" }
const members = new Map<Family, number>()
const atlas = {
	kind: "movie",
	country: "us",
	members: (family: Family) => {
		members.set(family, (members.get(family) ?? 0) + 1)
		if (family === "country") return [country]
		if (family === "genre") return [genre]
		throw new Error(`unrequested family ${family}`)
	},
	traits: ([part]: Ingredient[]) => ({
		more: [{ key: part.slug, word: part.slug, color: "white" }],
	}),
	print: () => [{ key: "tone", label: "Tone", family: "story", color: "white", value: 3, base: 1 }],
	kinds: async () => [{ id: "drama-kind", name: "Kind of drama" }],
} as unknown as Places

assert.equal(await loadMarks(atlas, []), null)
const [countryMarks, concurrent] = await Promise.all([
	loadMarks(atlas, [{ place: country }]),
	loadMarks(atlas, [{ place: country }]),
])
assert.deepEqual(countryMarks, concurrent)
assert.deepEqual([...members], [["country", 1]])
assert.deepEqual(countryMarks?.words["country:japan"], [
	{ key: "japan", word: "japan", color: "white" },
])
assert.deepEqual(countryMarks?.bars, [])

const both = await loadMarks(atlas, [{ place: country }, { place: genre }])
assert.deepEqual(
	[...members],
	[
		["country", 1],
		["genre", 1],
	],
)
assert.deepEqual(both?.words["country:japan"], countryMarks?.words["country:japan"])
assert.deepEqual(both?.genres.drama, [20])
assert.deepEqual(both?.kinds.drama, [{ id: "drama-kind", name: "Kind of drama" }])
assert.equal(both?.bars.length, 1)
assert.deepEqual(await loadMarks(atlas, [{ place: country }]), countryMarks)
console.log("independent mark families preserved")
