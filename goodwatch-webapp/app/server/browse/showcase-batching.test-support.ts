import assert from "node:assert/strict"
import { Places } from "./places.server"
import type { Base, Catalog } from "./rows.server"
import type { TitleCard } from "../title-cards.server"
import type { ViewerContext } from "../viewer.server"

const count = 30
const rows = Array.from({ length: count }, (_, i) => i)
const keys = rows.map((i) => 1e12 + i + 1)
const base = {
	rows,
	kind: "movie",
	today: 2,
	showVotes: 1,
	rank: Int32Array.from(rows),
	snap: {
		columns: {
			pointIds: Float64Array.from(keys),
			releaseDays: new Int32Array(count).fill(1),
			votes: new Uint32Array(count).fill(1000),
		},
	},
} as Base

const setup = (failOnce = false) => {
	const reads: number[][] = []
	const load = async (ids: number[]) => {
		reads.push(ids)
		if (failOnce) {
			failOnce = false
			throw new Error("interrupted card read")
		}
		return ids.flatMap((key) => {
			const i = keys.indexOf(key)
			// A missing catalog entry and two films from one series occur in the overlapping candidate lists.
			if (i === 0) return []
			return [
				{
					key,
					tmdb_id: i + 1,
					media_type: "movie",
					title: i === 1 ? "Paddington" : i === 2 ? "Paddington 2" : String.fromCharCode(65 + i),
				} as TitleCard,
			]
		})
	}
	return {
		atlas: new Places(base, {} as Catalog, {} as ViewerContext, "us", new Map(), load),
		reads,
	}
}
const normal = setup()
const batch = setup()
const groups = [[], [], [], []]
await batch.atlas.readShowcaseCandidates(groups, 3, "popular")
assert.equal(batch.atlas.used.size, 0)
assert.equal(batch.reads.length, 1)
assert.deepEqual(batch.reads[0], keys.slice(0, 14))
for (const group of groups) {
	const sequential = await normal.atlas.showcase(group, 3, { by: "popular" })
	const bulk = await batch.atlas.showcase(group, 3, { by: "popular" })
	assert.deepEqual(bulk, sequential)
	assert.equal(bulk.length, 3)
}
assert.equal(batch.atlas.used.size, 12)
assert.ok(
	batch.reads.slice(1).some((read) => read.some((key) => key > keys[13])),
	"earlier selections promote candidates beyond the first batch",
)
assert.ok(!batch.atlas.used.has(keys[0]))
const before = batch.reads.length
await batch.atlas.readShowcaseCandidates(groups, 0)
assert.deepEqual(await batch.atlas.showcase([], 0), [])
assert.equal(batch.reads.length, before)
const retry = setup(true)
await assert.rejects(
	retry.atlas.readShowcaseCandidates(groups, 3, "popular"),
	/interrupted card read/,
)
await retry.atlas.readShowcaseCandidates(groups, 3, "popular")
assert.deepEqual(retry.reads[0], retry.reads[1])
console.log("showcase selection preserved")
