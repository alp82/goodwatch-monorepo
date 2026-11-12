import assert from "node:assert/strict"
import { test } from "node:test"
import { stubModules } from "../rating-onboarding.test-support.ts"
import type { TitleSnapshot } from "../title-snapshot/snapshot.server"

// The base ranking a room's deck starts from, built slice by slice over the loaded title snapshot.
const boundary = globalThis as typeof globalThis & {
	rankingSnapshot: () => TitleSnapshot | null
	rankingSlice: () => void
}
boundary.rankingSlice = () => {}
const snapshotModule = `export * from '${new URL("../title-snapshot/format.server.ts", import.meta.url).href}'; export const getTitleSnapshot = () => globalThis.rankingSnapshot()`
stubModules({
	"~/server/title-snapshot/index.server": snapshotModule,
	"../title-snapshot/index.server": snapshotModule,
	// Read once per filterTitles call, i.e. once per slice: the hook a test reloads the snapshot from.
	"~/server/availability-index.server":
		"export const countryServices = () => { globalThis.rankingSlice(); return null }; export const availabilityLoadedAt = () => 1",
	"~/server/taste/index.server": "export const loadTaste = async () => ({ signal: 'none' })",
	"./id-sets.server": `const none = async () => new Set(); export const rangeScoreTitles = async () => null;
		export const similarTitles = none, personTitles = none, legacyTitles = none, awardTitles = none, tropeTitles = none,
		productionCountryTitles = none, titlesOnAnyService = none, titlesOnServicesByColumn = none;`,
	"../personal-order/reader.server.ts":
		"export const loadPersonalOrder = () => {}; export const logPersonalOrder = () => {}; export const orderPersonalOrder = () => {}; export const personalOrderExposure = () => {}",
})
const { goodwatchReads } = await import("./goodwatch.server.ts")

const COUNT = 20_000 // More than two slices.
let built = 0
function fixture(version: string, popularity: (i: number) => number, onCount?: () => void): TitleSnapshot {
	const keys = Float64Array.from({ length: COUNT }, (_, i) => (i % 2 ? 2e12 : 1e12) + i + 1)
	const rows = new Map(Array.from(keys, (key, row) => [key, row]))
	const columns = {
		pointIds: keys,
		genres: new Uint32Array(COUNT),
		genreNames: ["Drama"],
		releaseDays: new Int32Array(COUNT).fill(19000),
		votes: new Uint32Array(COUNT).fill(100_000),
		popularity: Float32Array.from(keys, (_, i) => popularity(i)),
		scores: new Uint8Array(COUNT).fill(80),
		flags: new Uint8Array(COUNT).fill(1),
		moods: new Uint16Array(COUNT),
		themes: new Uint16Array(COUNT),
		styles: new Uint16Array(COUNT),
		ratings: null,
		facts: null,
	}
	return {
		version: `${version}-${built++}`,
		get count() {
			onCount?.()
			return COUNT
		},
		columns,
		rowOf: (key: number) => rows.get(key) ?? -1,
		factsAt: () => ({ adult: false }),
	} as unknown as TitleSnapshot
}
const room = (country: string) =>
	({
		roundVersion: 0,
		constraints: { kinds: ["movie", "show_start"], moods: [] },
		screens: [{ id: "s", country }],
		participants: [{ screenId: "s" }],
	}) as unknown as Parameters<typeof goodwatchReads.rankedKeys>[0]
const byPopularity = (snapshot: TitleSnapshot) => {
	const { pointIds, popularity } = snapshot.columns
	return Array.from(pointIds).sort((a, b) => popularity[snapshot.rowOf(b)] - popularity[snapshot.rowOf(a)])
}

test("a snapshot reload between slices doesn't mix two snapshots into one ranking", async () => {
	// Hash-like popularity so every slice holds titles from all over the order.
	const loaded = fixture("loaded", (i) => ((i * 7919) % COUNT) + 1)
	const reloaded = fixture("reloaded", (i) => COUNT - ((i * 7919) % COUNT)) // The opposite order.
	let current = loaded
	let slices = 0
	boundary.rankingSnapshot = () => current
	boundary.rankingSlice = () => {
		if (++slices === 1) current = reloaded
	}
	const keys = await goodwatchReads.rankedKeys(room("DE"))
	boundary.rankingSlice = () => {}
	assert.ok(slices >= 3, "built in slices")
	assert.deepEqual([...keys], byPopularity(loaded), "the whole ranking is the snapshot it started with")
})

test("the base ranking doesn't build the catalog's popularity ranks it never filters by", async () => {
	let scans = 0
	const snapshot = fixture("ranks", (i) => COUNT - i, () => scans++)
	boundary.rankingSnapshot = () => snapshot
	const keys = await goodwatchReads.rankedKeys(room("FR"))
	assert.equal(keys.length, COUNT)
	// The catalog scan behind popularity ranks reads the count once per title; the filter itself a few times per slice.
	assert.ok(scans < 100, `no full catalog scan for popularity ranks (count read ${scans} times)`)
})
