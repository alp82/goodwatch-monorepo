import assert from "node:assert/strict"
import { createRequire } from "node:module"
import { test } from "node:test"
import "./test-alias.ts"
const { rangeScoreConditions } = await import(
	"./range-score-conditions.server.ts"
)
const { defaultFilterState } = await import("~/domain/filter-state")
import type { FilterState } from "~/domain/filter-state"
// Execute the portable predicates against SQL NULLs, rather than duplicate their logic in a test evaluator.
const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite")
const db = new DatabaseSync(":memory:")
db.exec(`CREATE TABLE titles (id INTEGER, release_year INTEGER, runtime INTEGER,
 imdb_user_score_normalized_percent REAL, rotten_tomatoes_tomato_score_normalized_percent REAL,
 rotten_tomatoes_audience_score_normalized_percent REAL, metacritic_meta_score_normalized_percent REAL, metacritic_user_score_normalized_percent REAL);
 INSERT INTO titles VALUES
 (1, 1990, 90, 80, 80, 95, 30, 70),
 (2, 2005, 120, 70, 85, NULL, 10, 69),
 (3, 2006, 121, 90, 75, NULL, 99, 80),
 (4, NULL, NULL, NULL, NULL, 80, 75, NULL),
 (5, 1989, 0, NULL, 90, NULL, 90, 0),
 (6, 2000, 100, 80, NULL, 90, NULL, 90),
 (7, 2000, 100, 65, 70, NULL, NULL, NULL),
 (8, 2000, 100, 69, 69, NULL, NULL, 65);`)
function selected(
	fields: Partial<FilterState>,
	group: Parameters<typeof rangeScoreConditions>[1],
) {
	const sql = rangeScoreConditions(
		{
			...defaultFilterState({ onMyServices: false, notSeenYet: false }),
			...fields,
		},
		group,
		"movie",
	)
	return db
		.prepare(
			`SELECT id FROM titles WHERE ${sql.conditions.join(" AND ")} ORDER BY id`,
		)
		.all(...sql.params)
		.map((r: { id: number }) => r.id)
}
test("inclusive year and runtime bounds preserve zero and reject missing facts", () => {
	assert.deepEqual(
		selected({ years: { min: 1990, max: 2005 } }, "years"),
		[1, 2, 6, 7, 8],
	)
	assert.deepEqual(
		selected({ runtime: { min: 0, max: 90 } }, "runtime"),
		[1, 5],
	)
	assert.deepEqual(selected({ runtime: { min: 120 } }, "runtime"), [2, 3])
	const state = {
		...defaultFilterState({ onMyServices: false, notSeenYet: false }),
		runtime: { max: 90 },
	}
	assert.deepEqual(rangeScoreConditions(state, "runtime", "show"), {
		conditions: ["episode_runtime[1] <= ?"],
		params: [90],
	})
})
test("source minimums AND together and missing scores fail even a zero minimum", () => {
	assert.deepEqual(
		selected({ sourceScores: { imdb: 80, rtCritics: 80 } }, "sourceScores"),
		[1],
	)
	assert.deepEqual(
		selected({ sourceScores: { imdb: 0 } }, "sourceScores"),
		[1, 2, 3, 6, 7, 8],
	)
	assert.deepEqual(
		selected(
			{ sourceScores: { rtAudience: 85, metacritic: 30 } },
			"sourceScores",
		),
		[1],
	)
})
test("gap boundaries, preferred sources, fallbacks and missing sides", () => {
	assert.deepEqual(selected({ scoreGap: "agree" }, "scoreGap"), [1, 4, 7])
	assert.deepEqual(selected({ scoreGap: "critics" }, "scoreGap"), [2])
	assert.deepEqual(selected({ scoreGap: "audience" }, "scoreGap"), [3])
})

test("Metacritic users use normalized inclusive minimums and combine with other sources", () => {
	assert.deepEqual(
		selected({ sourceScores: { metacriticUsers: 70 } }, "sourceScores"),
		[1, 3, 6],
	)
	assert.deepEqual(
		selected({ sourceScores: { metacriticUsers: 0 } }, "sourceScores"),
		[1, 2, 3, 5, 6, 8],
	)
	assert.deepEqual(
		selected(
			{ sourceScores: { metacriticUsers: 70, rtCritics: 80 } },
			"sourceScores",
		),
		[1],
	)
	for (const type of ["movie", "show"] as const)
		assert.deepEqual(
			rangeScoreConditions(
				{
					...defaultFilterState({ onMyServices: false, notSeenYet: false }),
					sourceScores: { metacriticUsers: 70 },
				},
				"sourceScores",
				type,
			),
			{
				conditions: ["metacritic_user_score_normalized_percent >= ?"],
				params: [70],
			},
		)
})

test("episodeRuntime splits movie and show bounds, including explicitly unlimited episodes", () => {
	const base = defaultFilterState({ onMyServices: false, notSeenYet: false })
	const state = {
		...base,
		runtime: { max: 120 },
		episodeRuntime: { min: 20, max: 35 },
	}
	assert.deepEqual(rangeScoreConditions(state, "runtime", "movie"), {
		conditions: ["runtime <= ?"],
		params: [120],
	})
	assert.deepEqual(rangeScoreConditions(state, "runtime", "show"), {
		conditions: ["episode_runtime[1] >= ?", "episode_runtime[1] <= ?"],
		params: [20, 35],
	})
	assert.deepEqual(
		rangeScoreConditions({ ...state, episodeRuntime: null }, "runtime", "show"),
		{ conditions: [], params: [] },
	)
	assert.deepEqual(
		rangeScoreConditions(
			{ ...base, episodeRuntime: { max: 35 } },
			"runtime",
			"movie",
		),
		{ conditions: [], params: [] },
	)
})
