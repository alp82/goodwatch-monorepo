import assert from "node:assert/strict"
import { Places, MIN_PAGE } from "./places.server"
import { K, KEY_AT, type Base, type Catalog } from "./rows.server"
import type { ViewerContext } from "../viewer.server"

function compare(groups: number[], name: string) {
	const names = groups.map((_, i) => `genre-${i}`)
	const genres = Uint32Array.from(groups.flatMap((count, index) => Array(count).fill(1 << index)))
	const fingerprints = groups.flatMap((count, group) => {
		const values = new Uint8Array(K).fill(50)
		// Two groups share a position, a third differs. Axes with no variation stay centered.
		values[KEY_AT.get("bleakness")!] = group < 2 ? 1 : 90
		return Array<Uint8Array>(count).fill(values)
	})
	const base = {
		kind: "movie",
		rows: Array.from(genres.keys()),
		snap: {
			version: `dial-positions-test-${name}`,
			columns: { genres, genreNames: names },
			fingerprintAt: (row: number) => fingerprints[row],
		},
	} as unknown as Base
	const catalog = {
		genre: names.map((slug) => ({ family: "genre", id: slug, slug, label: slug })),
	} as Catalog
	const atlas = new Places(base, catalog, {} as ViewerContext, "us", new Map())
	const actual = atlas.dialPositions("genre")
	assert.equal(actual.size, groups.filter((n) => n >= MIN_PAGE).length)
	for (const part of atlas.members("genre")) {
		const expected = Object.fromEntries(atlas.dials(part).map((d) => [d.key, d.at]))
		assert.deepEqual(actual.get(part.slug), expected)
		assert.equal(actual.get(part.slug)?.pace, 0.5)
	}
}

compare([], "empty")
compare([MIN_PAGE - 1, MIN_PAGE], "singleton")
compare([MIN_PAGE, MIN_PAGE, MIN_PAGE + 5, MIN_PAGE - 1], "ties")
console.log("family positions match individual dials")
process.exit(0)
