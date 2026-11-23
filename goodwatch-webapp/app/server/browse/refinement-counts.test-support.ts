import assert from "node:assert/strict"
import { sortParts, type Ingredient } from "~/domain/browse/address"
import { Places } from "./places.server"
import { rowsOf, type Base, type Catalog } from "./rows.server"
import type { ViewerContext } from "../viewer.server"

const names = ["A", "B", "C", "D", "E"]
const genres = Uint32Array.from([7, 7, 11, 3, 5, 5, 1, 1, 1, 1, 16])
const catalog = {
	genre: names.map((id) => ({
		family: "genre",
		id,
		slug: id.toLowerCase(),
		label: id,
		aliases: id === "A" ? ["alias-a"] : [],
	})),
} as Catalog
const ingredient = (slug: string): Ingredient => ({ family: "genre", slug })
const cases = [
	["a", "b", "c"],
	["b", "c", "a"],
	["c", "a", "b"],
	["b", "a", "d"],
	["b", "e", "a"],
	["e", "a", "b"],
	["b", "c", "alias-a"],
	["c", "a", "a", "b"],
	["a", "b", "missing"],
	["b", "c", "a", "d"],
]

for (const [i, slugs] of cases.entries()) {
	for (const materialize of [true, false]) {
		const base = {
			kind: "movie",
			rows: Array.from(genres.keys()),
			snap: {
				version: `refinement-test-${i}-${materialize}`,
				columns: { genreNames: names, genres, moods: new Uint32Array(genres.length) },
			},
		} as unknown as Base
		const atlas = new Places(base, catalog, {} as ViewerContext, "us", new Map())
		const parts = slugs.map(ingredient)
		const canonical = parts.map((p) => ingredient(atlas.canon(p.family, p.slug)))
		if (materialize) rowsOf(base, catalog, sortParts(canonical.slice(0, -1)), "us")
		const bits = canonical.map((p) => names.indexOf(p.slug.toUpperCase()))
		const expected = genres.filter((g) => bits.every((bit) => bit >= 0 && g & (1 << bit))).length
		assert.equal(atlas.count(parts), expected)
		assert.equal(atlas.count([...parts].reverse()), expected)
	}
}
const atlas = new Places({ kind: "movie" } as Base, catalog, {} as ViewerContext, "us", new Map())
const handoff = new URL(
	atlas.discoverHref([ingredient("a"), ingredient("b")], "top", { mine: true, unseen: true })!,
	"https://goodwatch.test",
)
assert.equal(handoff.searchParams.get("genres"), "A,B")
assert.equal(handoff.searchParams.get("all"), "genres")
assert.equal(handoff.searchParams.get("services"), "mine")
assert.equal(handoff.searchParams.get("unseen"), "1")
console.log("refinement counts preserved")
process.exit(0)
