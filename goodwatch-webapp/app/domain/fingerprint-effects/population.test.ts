import "../../server/title-filter/test-alias.ts"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, test } from "node:test"
import type { CoreScores } from "../../server/utils/fingerprint.ts"
import type { PopulationTitle } from "./population.ts"

const { VALID_FINGERPRINT_KEYS } = await import(
	"../../server/utils/fingerprint.ts"
)
const { EFFECTS, readEffect, readEffects } = await import("./effects.ts")
const saved: {
	count: number
	signatures: Record<string, number>
	subjects: { tmdbId: number; scores: CoreScores }[]
} = JSON.parse(
	readFileSync(new URL("./fixtures/movie-pairs.json", import.meta.url), "utf8"),
)
const { POPULATION_MEDIANS } = await import("./population-medians.ts")
const {
	buildPopulation,
	franchise,
	ingredientKeys,
	parseEffects,
	parseMediaType,
	parseTitleId,
	pickTitles,
	populationMedians,
	rarestPairs,
} = await import("./population.ts")

const scores = (
	value: number,
	overrides: Partial<CoreScores> = {},
): CoreScores =>
	({
		...Object.fromEntries(VALID_FINGERPRINT_KEYS.map((k) => [k, value])),
		...overrides,
	}) as CoreScores
const title = (tmdbId: number, name: string, value = 8): PopulationTitle => ({
	tmdbId,
	title: name,
	year: 2024,
	poster: "/poster.jpg",
	goodwatch: 85,
	scores: scores(value),
})
const effect = (id: string) => {
	const found = EFFECTS.find((e) => e.id === id)
	if (!found) throw new Error(id)
	return found
}

describe("population effects", () => {
	test("precomputes strengths and threshold sets in popularity order", () => {
		const titles = [title(1, "First", 6.4), title(2, "Second", 6.5)]
		const population = buildPopulation(titles)
		for (const e of EFFECTS) {
			assert.deepEqual(
				population.strengths.get(e.id),
				titles.map((t) => readEffect(e, t.scores).strength),
			)
			assert.deepEqual(
				population.countedSets.map((s) => s.has(e.id)),
				titles.map((t) => readEffect(e, t.scores).counts),
			)
		}
		assert.equal(population.countedSets[0].has("real"), false)
		assert.equal(population.countedSets[1].has("real"), true)
	})
	test("matches the saved movie population's rarest pairs", () => {
		// Only signatures for these titles' strongest effects are needed from the saved population.
		const countedSets = Object.entries(saved.signatures).flatMap(
			([ids, count]) =>
				Array.from({ length: count }, () => new Set(ids ? ids.split(",") : [])),
		)
		const population = {
			...buildPopulation([]),
			titles: Array.from({ length: saved.count }, () => title(0, "")),
			countedSets,
		}
		assert.equal(countedSets.length, 2991)
		for (const [id, a, b, both] of [
			[693134, "elsewhere", "schemes", 40],
			[666277, "real", "longing", 79],
		] as const) {
			const subject = saved.subjects.find((t) => t.tmdbId === id)
			assert.ok(subject)
			const result = rarestPairs(population, subject.scores)
			assert.equal(result.of, 2991)
			assert.deepEqual(result.pairs[0], { a, b, both })
			assert.equal(result.pairs.length, 20)
			const top = readEffects(subject.scores)
				.filter((r) => r.counts)
				.slice(0, 8)
				.map((r) => r.effect.id)
			assert.equal(
				result.pairs.every((p) => top.includes(p.a) && top.includes(p.b)),
				true,
			)
		}
	})
	test("returns no pairs when fewer than two effects count", () => {
		assert.deepEqual(rarestPairs(buildPopulation([]), scores(0)), {
			of: 0,
			pairs: [],
		})
	})
	test("breaks equal pair counts by mean strength", () => {
		const s = scores(7, { political: 10, intrigue: 10, complexity: 10 })
		const result = rarestPairs(buildPopulation([]), s)
		const strengths = new Map(
			readEffects(s).map((r) => [r.effect.id, r.strength]),
		)
		const means = result.pairs.map(
			(p) => ((strengths.get(p.a) ?? 0) + (strengths.get(p.b) ?? 0)) / 2,
		)
		assert.deepEqual(
			means,
			[...means].sort((a, b) => b - a),
		)
	})
})

describe("franchise keys", () => {
	for (const [a, b, key] of [
		["Dune", "Dune: Part Two", "dune"],
		[
			"The Lord of the Rings: The Fellowship of the Ring",
			"The Lord of the Rings: The Two Towers",
			"lord rings",
		],
		["Rocky", "Rocky II", "rocky"],
		["Toy Story", "Toy Story 3", "toy story"],
		[
			"Harry Potter and the Sorcerer's Stone",
			"Harry Potter and the Chamber of Secrets",
			"harry potter",
		],
		["Dune Part One", "Dune - Part Two", "dune"],
	]) {
		test(`groups ${a} and ${b}`, () => {
			assert.equal(franchise(a), key)
			assert.equal(franchise(b), key)
		})
	}
	test("preserves the reference punctuation and numeral rules", () => {
		assert.equal(franchise("Ocean's Eleven"), "ocean's eleven")
		assert.equal(franchise("Rocky VII"), "rocky vii")
		assert.equal(franchise("The And Of"), "")
	})
})

describe("selected titles", () => {
	test("orders by weakest selected strength, keeps popularity ties, and filters after counting", () => {
		const titles = [
			title(1, "Dune"),
			title(2, "Dune: Part Two", 9),
			title(3, "Missing", 9),
			title(4, "Alpha", 8),
			title(5, "Beta", 8),
			title(6, "Alpha: Sequel", 8),
			title(7, "Low", 5),
			title(8, "Strong", 9),
		]
		titles[2].poster = null
		titles[7].scores = scores(9, { romance: 7 })
		const result = pickTitles(
			buildPopulation(titles),
			[effect("real"), effect("longing")],
			1,
		)
		assert.equal(result.total, 6)
		assert.deepEqual(
			result.titles.map((t) => t.tmdbId),
			[4, 5, 8],
		)
		assert.deepEqual(
			{
				year: result.titles[0].year,
				poster: result.titles[0].poster,
				goodwatch: result.titles[0].goodwatch,
			},
			{
				year: 2024,
				poster: "/poster.jpg",
				goodwatch: 85,
			},
		)
	})
	test("excludes the franchise of a title outside the population", () => {
		assert.deepEqual(
			pickTitles(
				buildPopulation([title(1, "Dune"), title(2, "Other")]),
				[effect("real")],
				99,
				"Dune: Part Two",
			).titles.map((t) => t.tmdbId),
			[2],
		)
	})
	test("caps at 64 without capping total and permits empty franchise keys", () => {
		const titles = Array.from({ length: 70 }, (_, i) =>
			title(i + 1, `Unique${i}`),
		)
		const result = pickTitles(buildPopulation(titles), [effect("real")], 99)
		assert.equal(result.total, 70)
		assert.equal(result.titles.length, 64)
		assert.equal(
			pickTitles(
				buildPopulation([title(1, "The"), title(2, "Of")]),
				[effect("real")],
				99,
			).titles.length,
			2,
		)
	})
	test("returns nothing for an empty selection", () => {
		assert.deepEqual(pickTitles(buildPopulation([title(1, "Alpha")]), [], 99), {
			total: 0,
			titles: [],
		})
	})
	test("chooses three distinct ingredient keys, including group members, at six or higher", () => {
		const s = scores(0, {
			fantasy: 9,
			futuristic: 8,
			historical: 5,
			world_immersion: 10,
			novelty: 6,
		})
		assert.deepEqual(ingredientKeys(s, [effect("elsewhere"), effect("awe")]), [
			"world_immersion",
			"fantasy",
			"futuristic",
		])
		assert.deepEqual(
			ingredientKeys(scores(0, { romance: 6, melancholy: 5.9 }), [
				effect("longing"),
			]),
			["romance"],
		)
	})
})

test("computes upper middle medians, with zero for missing scores", () => {
	const titles = [
		title(1, "One", 1),
		title(2, "Two", 4),
		title(3, "Three", 9),
		title(4, "Four", 7),
	]
	assert.deepEqual(populationMedians(titles), scores(7))
	assert.throws(() => populationMedians([]))
	assert.deepEqual(
		Object.keys(POPULATION_MEDIANS.movie).sort(),
		[...VALID_FINGERPRINT_KEYS].sort(),
	)
	assert.deepEqual(
		Object.keys(POPULATION_MEDIANS.show).sort(),
		[...VALID_FINGERPRINT_KEYS].sort(),
	)
})

test("validates types, positive safe TMDB ids, and one to three known effects", () => {
	assert.equal(parseMediaType(new URLSearchParams("type=show")), "show")
	assert.equal(parseTitleId(new URLSearchParams("id=693134"), "id"), 693134)
	assert.deepEqual(
		parseEffects(new URLSearchParams("effects=elsewhere,schemes")).map(
			(e) => e.id,
		),
		["elsewhere", "schemes"],
	)
	for (const invalid of ["", "tv", "MOVIE"])
		assert.throws(() => parseMediaType(new URLSearchParams({ type: invalid })))
	for (const invalid of ["", "0", "-1", "2.5", "1e3", "9007199254740992"])
		assert.throws(() =>
			parseTitleId(new URLSearchParams({ id: invalid }), "id"),
		)
	for (const invalid of [
		"",
		"unknown",
		"real,unknown",
		"real,real",
		"real,longing,schemes,awe",
		"real,",
	]) {
		try {
			parseEffects(new URLSearchParams({ effects: invalid }))
			throw new Error("Expected rejection")
		} catch (error) {
			assert.ok(error instanceof Response)
			assert.equal(error.status, 400)
		}
	}
})
