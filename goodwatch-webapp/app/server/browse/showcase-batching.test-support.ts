import assert from "node:assert/strict"
import { Places } from "./places.server"
import type { Base, Catalog } from "./rows.server"
import type { TitleCard } from "../title-cards.server"
import { guestContext, type ViewerContext } from "../viewer.server"

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

const setup = (failOnce = false, missing = true) => {
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
			if (missing && i === 0) return []
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
const loaded = setup(false, false)
await loaded.atlas.readShowcaseCandidates(groups, 3, "popular")
for (const group of groups)
	assert.equal((await loaded.atlas.showcase(group, 3, { by: "popular" })).length, 3)
assert.equal(
	loaded.reads.length,
	1,
	"an unread tail cannot matter once the loaded prefix fills the row",
)

const retry = setup(true)
await assert.rejects(
	retry.atlas.readShowcaseCandidates(groups, 3, "popular"),
	/interrupted card read/,
)
await retry.atlas.readShowcaseCandidates(groups, 3, "popular")
assert.deepEqual(retry.reads[0], retry.reads[1])

// The room and its dials request the same bands at different sizes and offsets. The lead
// mood widens to the whole cohort, while a secondary genre still restricts membership.
const values = [0, 3, 4, 6, 7, 8, 9, 10, 255]
let scoresRead = 0
const bandBase: Base = {
	...base,
	snap: {
		...base.snap,
		version: "request-bands",
		columns: {
			...base.snap.columns,
			releaseDays: Int32Array.from(rows, (r) => (r === 2 ? base.today + 1 : base.today)),
			moods: new Uint32Array(count),
			genreNames: ["Comedy"],
			genres: Uint32Array.from(rows, (i) => (i % 2 === 0 ? 1 : 0)),
		},
		fingerprintAt(i) {
			scoresRead++
			return new Uint8Array(100).fill(values[i % values.length])
		},
	},
}
const tense = { family: "mood", slug: "tense" } as const
const comedy = { family: "genre", slug: "comedy" } as const
const bandCatalog = {
	mood: [{ ...tense, id: "tense", label: "Tense" }],
	genre: [{ ...comedy, id: "Comedy", label: "Comedy" }],
} as Catalog
const bandViewer = { ...guestContext(undefined, "US"), seen: new Set([keys[2]]) }
const bandAtlas = () =>
	new Places(bandBase, bandCatalog, bandViewer, "us", new Map(), async (ids) =>
		ids.map(
			(key) => ({ key, tmdb_id: key - 1e12, media_type: "movie", title: String(key) }) as TitleCard,
		),
	)
const atlas = bandAtlas()
const titleKeys = (list: Awaited<ReturnType<Places["list"]>>) => list.titles.map((t) => t.card.key)
const expected = (lo: number, hi: number, source = rows) =>
	source
		.filter((i) => values[i % values.length] >= lo && values[i % values.length] <= hi)
		.map((i) => keys[i])
const touch = expected(4, 6)
assert.deepEqual(
	titleKeys(await atlas.list([tense], { level: "touch", size: 2, page: 2 })),
	touch.slice(2, 4),
)
assert.deepEqual(titleKeys(await atlas.list([tense], { level: "plenty" })), expected(7, 8))
assert.deepEqual(titleKeys(await atlas.list([tense], { level: "full" })), expected(9, 10))
assert.deepEqual(
	titleKeys(await atlas.list([tense], { level: "touch", unseen: true })),
	touch.filter((key) => key !== keys[2]),
)
assert.equal(scoresRead, count, "each fingerprint is read once for the three bands")
const evens = rows.filter((r) => r % 2 === 0)
assert.deepEqual(
	titleKeys(await atlas.list([tense, comedy], { level: "full" })),
	expected(9, 10, evens),
)
assert.equal(scoresRead, count + evens.length)
const repeatAtlas = bandAtlas()
assert.deepEqual(titleKeys(await repeatAtlas.list([tense], { level: "touch" })), touch)
const firstBand = atlas["bandRows"]([tense], "touch")
const repeatBand = repeatAtlas["bandRows"]([tense], "touch")
assert.equal(firstBand, repeatBand)
assert.equal(atlas["releasedByVotes"](firstBand), repeatAtlas["releasedByVotes"](repeatBand))
assert.equal(scoresRead, count + evens.length, "a new mood request reuses the public bands")
await bandAtlas().list([tense, comedy], { level: "touch" })
assert.equal(scoresRead, count + 2 * evens.length, "blends keep their partitions per request")
const tomorrowBase = { ...bandBase, today: bandBase.today + 1 }
const tomorrowAtlas = new Places(tomorrowBase, bandCatalog, bandViewer, "us", new Map())
const tomorrowBand = tomorrowAtlas["bandRows"]([tense], "touch")
assert.deepEqual(tomorrowBand, firstBand)
assert.ok(!atlas["releasedByVotes"](firstBand).includes(2))
assert.ok(tomorrowAtlas["releasedByVotes"](tomorrowBand).includes(2))
assert.equal(scoresRead, 2 * count + 2 * evens.length, "the next release day gets fresh groups")

const nextBase = { ...bandBase, snap: { ...bandBase.snap, version: "replacement-bands" } }
const nextAtlas = new Places(nextBase, bandCatalog, bandViewer, "us", new Map(), async () => [])
await nextAtlas.list([tense], { level: "full" })
assert.equal(scoresRead, 3 * count + 2 * evens.length, "the next snapshot rebuilds the bands")

// Reusing vote order must promote eligible titles past the original 240-row shortlist.
const wide = Array.from({ length: 320 }, (_, i) => i)
const wideKeys = wide.map((i) => 1e12 + 1 + i)
const wideBase: Base = {
	...base,
	rows: wide,
	rank: Int32Array.from(wide, (i) => wide.length - i),
	snap: {
		...base.snap,
		columns: {
			...base.snap.columns,
			pointIds: Float64Array.from(wideKeys),
			votes: new Uint32Array(wide.length).fill(100),
			releaseDays: Int32Array.from(wide, (i) => (i === 239 ? base.today + 1 : base.today)),
		},
	},
}
const wideAtlas = new Places(wideBase, bandCatalog, bandViewer, "us", new Map(), async (ids) =>
	ids.map(
		(key) => ({ key, tmdb_id: key - 1e12, media_type: "movie", title: String(key) }) as TitleCard,
	),
)
const first = await wideAtlas.showcase([], 1, { rows: wide, by: "popular" })
assert.equal(first[0].card.key, wideKeys[240])
const reserved = new Set(wideKeys.slice(0, 200))
const promoted = await wideAtlas.showcase([], 1, { rows: wide, by: "popular", used: reserved })
assert.equal(promoted[0].card.key, wideKeys[319])
const home = new Map(wide.slice(285, 315).map((i) => [i, 0]))
assert.equal(wideAtlas["rank"](wide, [], "popular", new Set(), home).length, 30)
const fallback = wideAtlas["rank"](wide, [], "popular", new Set([wideKeys[285]]), home)
assert.equal(fallback.length, 240)
assert.deepEqual(fallback.slice(0, 29), wide.slice(286, 315).reverse())
assert.ok(!fallback.includes(285) && !fallback.includes(239))
assert.deepEqual(
	wide,
	Array.from({ length: 320 }, (_, i) => i),
)
console.log("showcase selection preserved")
