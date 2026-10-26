import assert from "node:assert/strict"
import { test } from "node:test"
import { rankTropes, tropesLine } from "../../ui/profile/tropes/model.ts"
import { buildTropePool } from "./tropes-model.ts"
import { tropesPreview, withPreviewDescriptions } from "./tropes-preview.ts"

test("first view preserves ranking and defining titles without shipping the filtering matrix", () => {
	const pool = buildTropePool(
		Array.from({ length: 100 }, (_, i) => ({
			title: {
				key: `movie-${i + 1}`,
				mediaType: "movie" as const,
				tmdbId: i + 1,
				title: `Title ${i}`,
				year: 2000,
				poster: null,
				backdrop: null,
				score: 8,
				gw: 70,
				href: `/movie/${i + 1}`,
				date: null,
			},
			genres: ["Drama"],
			names: Array.from({ length: 100 }, (_, j) => `Trope ${j}`),
		})),
		[],
		{},
	)
	const data = { ...pool, seen: ["movie-1"] }
	const preview = tropesPreview(data)
	assert.equal(tropesLine("viewer", preview), tropesLine("viewer", data))
	assert.equal(preview.total, 100)
	assert.equal(preview.carrying, 100)
	assert.deepEqual(
		preview.ranked,
		rankTropes(data, data.pool).ranked.slice(0, 30),
	)
	assert.equal(preview.ranked.length, 30)
	assert.deepEqual(preview.data.pool, [])
	assert.equal(Object.keys(preview.data.titles).length, 12)
	assert.equal(preview.choices.all.count, 100)
	assert.ok(JSON.stringify(preview).length < JSON.stringify(data).length / 3)
	for (const band of preview.ranked)
		for (const key of band.top) assert.ok(preview.data.titles[key])
})

test("preview enriches visible bands from the current catalog without mutating the stored ranking", () => {
	const original = {
		data: {
			genres: [],
			years: [0, 0] as [number, number],
			tropes: ["Known", "Missing"],
			descriptions: {},
			urls: {},
			pool: [],
			titles: {},
			seen: [],
		},
		ranked: ["Known", "Missing"].map((name) => ({
			name,
			count: 10,
			loved: 8,
			z: 1,
			average: 8,
			top: [],
			description: "Legacy text",
			url: "https://tvtropes.org/old",
		})),
		usual: 7,
		total: 2,
		carrying: 10,
		eras: [],
		choices: {},
	}
	const result = withPreviewDescriptions(original, {
		Known: {
			text: "From the shared catalog.",
			url: "https://tvtropes.org/canonical",
		},
	})
	assert.equal(result.ranked[0].description, "From the shared catalog.")
	assert.equal(result.ranked[0].url, "https://tvtropes.org/canonical")
	assert.equal(result.ranked[1].description, null)
	assert.equal(result.ranked[1].url, "https://tvtropes.org/old")
	assert.equal(original.ranked[0].description, "Legacy text")
	assert.equal(result.data.pool.length, 0)
})

test("URI previews keep only thirty visible identities and show fresh canonical headings without changing their IDs", () => {
	const ids = Array.from(
		{ length: 45 },
		(_, i) => `https://tvtropes.org/pmwiki/pmwiki.php/Main/Page${i}`,
	)
	const full = {
		schema: 2,
		genres: [],
		years: [2000, 2000] as [number, number],
		tropes: ids,
		names: Object.fromEntries(ids.map((id, i) => [id, `Actual title ${i}`])),
		labels: Object.fromEntries(ids.map((id) => [id, ["Contextual label"]])),
		urls: Object.fromEntries(ids.map((id) => [id, id])),
		descriptions: {},
		titles: {},
		seen: [],
		pool: Array.from({ length: 3 }, (_, i) => ({
			k: `movie-${i + 1}`,
			m: 0 as const,
			y: 2000,
			s: 8,
			g: [],
			r: ids.map((_, r) => r),
			d: ids.map(() => 100),
		})),
	}
	const preview = tropesPreview(full)
	assert.equal(preview.ranked.length, 30)
	assert.ok(
		preview.ranked.every(
			(tag) =>
				tag.id &&
				tag.name.startsWith("Actual title") &&
				tag.labels?.[0] === "Contextual label",
		),
	)
	assert.equal(preview.data.pool.length, 0)
	const first = preview.ranked[0]
	assert.ok(first.id)
	const enriched = withPreviewDescriptions(preview, {
		[first.id]: {
			url: first.id,
			title: "Corrected primary heading",
			text: "The linked page general definition.",
		},
	})
	assert.equal(enriched.ranked[0].id, first.id)
	assert.equal(enriched.ranked[0].name, "Corrected primary heading")
	assert.deepEqual(enriched.ranked[0].labels, ["Contextual label"])
	assert.equal(first.name, preview.ranked[0].name)
})
