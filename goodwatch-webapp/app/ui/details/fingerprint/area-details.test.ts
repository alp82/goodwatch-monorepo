// Loaded before the alias hook, which rewrites relative imports.
import "react"
import assert from "node:assert/strict"
import { test } from "node:test"
import "../../../server/title-filter/test-alias.ts"

const { areaLinks, areaTraits, goodFor } = await import("./area-details.ts")
const { areaStripes, segmentGrow } = await import("./band.ts")
const { pickContrasts } = await import("./contrasts.ts")
const { breakingBad, matrix, toyStory } = await import(
	"./titles.test-support.ts"
)

test("'Good for' names specific occasions before generic audiences", () => {
	assert.deepEqual(goodFor(matrix), [
		"date night",
		"friends night",
		"party vibe",
	])
	assert.deepEqual(goodFor(breakingBad), [
		"friends night",
		"party vibe",
		"binge-friendly",
	])
	const generic = {
		...matrix,
		fingerprint: {
			...matrix.fingerprint,
			socialSuitability: [{ name: "Adults" }, { name: "Solo Watch" }],
			viewingContext: [],
		},
	}
	assert.deepEqual(goodFor(generic), ["adults", "solo watch"])
	const none = {
		...matrix,
		fingerprint: {
			...matrix.fingerprint,
			socialSuitability: [],
			viewingContext: [],
		},
	}
	assert.deepEqual(goodFor(none), [])
})

test("an area's traits are its four strongest, then up to two strong related ones", () => {
	const traits = areaTraits(matrix, "Energy")
	assert.deepEqual(traits.filter((x) => x.own).length, 4)
	assert.ok(traits.length <= 6)
	assert.ok(traits.filter((x) => !x.own).every((x) => x.score >= 7))
	const own = traits.filter((x) => x.own).map((x) => x.score)
	assert.deepEqual(
		own,
		[...own].sort((a, b) => b - a),
	)
})

test("more like this filters Discover at the title's tier, capped at high, then two mood pages", () => {
	const links = areaLinks(matrix, "Energy")
	assert.deepEqual(links[0], {
		label: "More movies with high energy",
		url: "/discover/movies?fingerprintPillars=Energy&fingerprintPillarMinTier=3",
		primary: true,
	})
	assert.ok(links.length <= 3)
	assert.ok(
		links.slice(1).every((x) => !x.primary && x.label.endsWith(" movies")),
	)
	assert.equal(
		areaLinks(breakingBad, "Heart")[0].label,
		"More shows with low heart",
	)
	// A tier-0 area has nothing to filter by.
	const flat = {
		...toyStory,
		fingerprint: {
			...toyStory.fingerprint,
			pillars: { ...toyStory.fingerprint.pillars, Humor: 0 as const },
		},
	}
	assert.ok(areaLinks(flat, "Humor").every((x) => !x.primary))
})

test("the band's stripes are the same for a title every time, and differ between titles", () => {
	const a = areaStripes("Energy", matrix.fingerprint.scores, matrix.title)
	assert.deepEqual(
		a,
		areaStripes("Energy", matrix.fingerprint.scores, matrix.title),
	)
	assert.notDeepEqual(
		a.map((x) => x.id),
		areaStripes("Energy", matrix.fingerprint.scores, "Another title").map(
			(x) => x.id,
		),
	)
	assert.ok(
		a.every((x) => x.brightness >= 0 && x.brightness <= 10 && x.width > 0),
	)
	// A stronger area gets a wider segment; an empty one still gets a sliver.
	assert.ok(segmentGrow(4) > segmentGrow(1))
	assert.ok(segmentGrow(0) > 0)
})

test("contrasts never share a trait", () => {
	for (const t of [matrix, breakingBad, toyStory]) {
		const keys = pickContrasts(t.fingerprint.scores, 12).flatMap((x) => [
			x.leadKey,
			x.otherKey,
		])
		assert.equal(new Set(keys).size, keys.length)
	}
})
