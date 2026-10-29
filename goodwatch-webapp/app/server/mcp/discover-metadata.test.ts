import "../title-filter/test-alias.ts"
import assert from "node:assert/strict"
import { test } from "node:test"
import * as z from "zod4"
const { discoverMetadata } = await import("./discover-metadata.ts")
const { discoverFilters, validDiscoverRanges } = await import(
	"./discover-filters.ts"
)
const scales = await import("../../domain/title-scales.ts")
const { MOODS } = await import("../../domain/moods.ts")
const { BIG_EIGHT, INDUSTRIES, REGIONS } = await import(
	"../../domain/film-industries.ts"
)
const schema = z.object(discoverFilters).strict().refine(validDiscoverRanges)

test("every advertised preset uses accepted existing MCP arguments, in a compact payload", () => {
	const metadata = JSON.parse(JSON.stringify(discoverMetadata(true, 2026)))
	let presets = 0
	function visit(value: unknown) {
		if (!value || typeof value !== "object") return
		if ("args" in value) {
			assert.equal(
				schema.safeParse(value.args).success,
				true,
				JSON.stringify(value),
			)
			presets++
		}
		for (const child of Object.values(value)) visit(child)
	}
	visit(metadata)
	assert.ok(presets > 40)
	assert.ok(JSON.stringify(metadata).length < 16000)
})

test("range guidance preserves shared stops, inclusive seams, units and argument names", () => {
	const m = discoverMetadata(true, 2026)
	for (const [actual, stops, presets, min, max] of [
		[
			m.votes,
			scales.VOTES_STEPS,
			scales.VOTES_PRESETS,
			"min_votes",
			"max_votes",
		],
		[
			m.popularity_rank,
			scales.POPULARITY_RANK_STEPS,
			scales.RANK_PRESETS,
			"min_popularity_rank",
			"max_popularity_rank",
		],
		[
			m.budget,
			scales.BUDGET_STEPS,
			scales.BUDGET_PRESETS,
			"min_budget_musd",
			"max_budget_musd",
		],
		[
			m.box_office,
			scales.BOX_OFFICE_STEPS,
			scales.BOX_OFFICE_PRESETS,
			"min_box_office_musd",
			"max_box_office_musd",
		],
		[
			m.seasons,
			scales.SEASONS_STEPS,
			scales.SEASONS_PRESETS,
			"min_seasons",
			"max_seasons",
		],
		[
			m.time_to_finish,
			scales.HOURS_STEPS,
			scales.HOURS_PRESETS,
			"min_hours",
			"max_hours",
		],
		[
			m.length.movies,
			[],
			scales.MOVIE_LENGTH_PRESETS,
			"min_runtime",
			"max_runtime",
		],
		[
			m.length.episodes,
			[],
			scales.EPISODE_LENGTH_PRESETS,
			"min_episode_runtime",
			"max_episode_runtime",
		],
	] as const) {
		assert.deepEqual(actual.steps, stops)
		assert.deepEqual(
			actual.presets,
			presets.map((preset) => ({
				key: preset.key,
				label: preset.label,
				args: Object.fromEntries(
					Object.entries(preset.range).map(([bound, value]) => [
						bound === "min" ? min : max,
						value,
					]),
				),
			})),
		)
	}
	assert.equal(m.budget.unit, "nominal USD millions")
	assert.equal(m.box_office.unit, "nominal USD millions")
	assert.equal(m.votes.eligibility_min, 1000)
	assert.equal(m.length.step, scales.LENGTH_STEP)
	assert.equal(m.length.slider_max, scales.LENGTH_MAX)
	assert.deepEqual(m.returns, scales.RETURNS_LABELS)
	assert.deepEqual(m.show_status, scales.SHOW_STATUS_LABELS)
})

test("source scores keep normalized arguments and native display notation", () => {
	const m = discoverMetadata(true)
	assert.deepEqual(m.scores.minimum_score.steps, scales.GOODWATCH_SCORE_STEPS)
	assert.deepEqual(
		m.scores.source_scores.sources.map(({ key, name, notation }) => ({
			key,
			name,
			notation,
		})),
		scales.SCORE_SOURCES.map(({ key, name, notation }) => ({
			key,
			name,
			notation,
		})),
	)
	for (const source of m.scores.source_scores.sources) {
		assert.deepEqual(
			source.steps.map(({ value }) => value),
			[60, 70, 80, 90],
		)
		assert.equal(
			source.steps[1].label,
			source.notation === "ten"
				? "7.0+"
				: source.notation === "percent"
					? "70%+"
					: "70+",
		)
	}
})

test("Released presets follow the clock, including Last 2 years at year minus 2", () => {
	for (const year of [2026, 2030]) {
		const m = discoverMetadata(false, year)
		assert.equal(m.released.current_year, year)
		const presets = m.released.presets
		assert.deepEqual(presets.find((p) => p.key === "last-1")?.args, {
			min_year: year,
		})
		assert.deepEqual(presets.find((p) => p.key === "last-2")?.args, {
			released: "recent",
		})
		assert.deepEqual(scales.releasedYears("recent", year), { min: year - 2 })
		for (const n of [3, 5])
			assert.deepEqual(presets.find((p) => p.key === `last-${n}`)?.args, {
				min_year: year - n,
			})
		assert.deepEqual(presets.find((p) => p.key === "2010s")?.args, {
			min_year: 2010,
			max_year: 2019,
		})
		assert.deepEqual(presets.find((p) => p.key === "1920s")?.args, {
			max_year: 1929,
		})
		assert.deepEqual(presets.find((p) => p.key === "after-1950")?.args, {
			min_year: 1950,
		})
	}
})

test("origin references and all 16 stable mood keys retain shared names and aliases", () => {
	const m = discoverMetadata(true)
	assert.deepEqual(m.origin.industries, INDUSTRIES)
	assert.deepEqual(m.origin.regions, REGIONS)
	assert.deepEqual(m.origin.rest_of_world.excluded_codes, BIG_EIGHT)
	assert.deepEqual(m.origin.rest_of_world.args, { rest_of_world: true })
	assert.match(m.origin.note, /no production-country argument/)
	assert.deepEqual(
		m.moods,
		MOODS.map(({ key, name, aliases }) => ({ key, name, aliases })),
	)
	assert.equal(m.moods.length, 16)
	assert.deepEqual(
		m.moods.slice(-5).map(({ key }) => key),
		["tense", "dark", "deep", "magical", "quirky"],
	)
	assert.deepEqual(
		m.moods.find(({ key }) => key === "feelgood"),
		{ key: "feelgood", name: "Cozy", aliases: ["Feel-good"] },
	)
})

test("facts presence and taste, list, all-of and rating-country semantics are discoverable", () => {
	assert.equal(discoverMetadata(false).facts_available, false)
	const m = discoverMetadata(true)
	assert.equal(m.facts_available, true)
	assert.match(m.facts_note, /do not narrow/)
	assert.deepEqual(m.match.minimum_match, [0, 60, 70, 80, 90])
	assert.deepEqual(m.match.outside_usual, {
		label: "Outside your usual",
		args: { outside_usual: true },
		min: 50,
		max: 59,
	})
	assert.match(m.match.note, /supersedes minimum_match/)
	assert.deepEqual(Object.keys(m.list_filters), ["seen_only", "wishlist_only"])
	assert.match(
		m.list_filters.seen_only,
		/mutually exclusive with exclude_seen=true/,
	)
	assert.deepEqual(m.match_all.groups, ["moods", "themes", "styles", "genres"])
	assert.match(m.rating_country.note, /independent of streaming/)
	assert.match(m.rating_country.note, /fall back to the saved country/)
})
