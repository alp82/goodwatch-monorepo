// "New on your services" (#489 Part C) on the server: what the reader asks availability_history, and how it turns
// the rows into a page's arrivals. The statements run against a fake that answers like Crate's `execute`.

import assert from "node:assert/strict"
import { test } from "node:test"
import "./title-filter/test-alias.ts"

const { readArrivalStays, readArrivals } = await import(
	"./new-on-services-read.server.ts"
)
const { titleKey } = await import("../utils/title-key.ts")

const DAY = 86_400_000
const NOW = Date.parse("2026-10-25T15:00:00Z")
const TODAY = Date.parse("2026-10-25T00:00:00Z")
const ago = (days: number) => TODAY - days * DAY

interface Statement {
	sql: string
	params: (string | number)[]
}

/** Answers the candidate statement with `candidates` and each stays statement with the stays of its titles. */
function fakeCrate(
	candidates: [string, number][],
	stays: Record<string, unknown[][]>,
) {
	const statements: Statement[] = []
	const run = async (sql: string, params: (string | number)[]) => {
		statements.push({ sql, params })
		if (sql.includes("SELECT DISTINCT media_type, media_tmdb_id"))
			return { rows: candidates }
		const type = params.find((p) => p === "movie" || p === "show") as string
		const ids = new Set(params.slice(params.indexOf(type) + 1))
		return {
			rows: (stays[type] ?? []).filter((row) => ids.has(row[0] as number)),
		}
	}
	return { run, statements }
}

test("candidates are live open stays first seen in the window on the page's services; backfill never is one", async () => {
	const { run, statements } = fakeCrate([], {})
	await readArrivalStays(
		{ country: "US", services: [8], since: ago(13) },
		run,
	)
	assert.equal(statements.length, 1)
	const [{ sql, params }] = statements
	assert.match(sql, /appeared_source <> 'backfill'/)
	assert.match(sql, /dropped_on IS NULL/)
	assert.match(
		sql,
		/CASE WHEN appeared_precision = 'exact' THEN appeared_on ELSE date_trunc\('day', observed_at\) END/,
	)
	assert.deepEqual(params, ["US", "flatrate", "free", "ads", 8, 1796, ago(13)])
})

test("the stays of the candidates are read per kind, with stays that closed since the day before the window", async () => {
	const { run, statements } = fakeCrate(
		[
			["movie", 10],
			["show", 20],
		],
		{
			movie: [[10, 1796, "title", "exact", ago(1), null, ago(1) + 3600]],
			show: [
				[20, 8, "backfill", "unknown", ago(40), null, ago(40)],
				[20, 1796, "title", "exact", ago(2), null, ago(2)],
			],
		},
	)
	const stays = await readArrivalStays(
		{ country: "US", services: [8], since: ago(13) },
		run,
	)
	assert.equal(statements.length, 3)
	for (const { sql, params } of statements.slice(1)) {
		assert.match(sql, /dropped_on IS NULL OR dropped_on >= \?/)
		assert.ok(params.includes(ago(14)))
		// Backfilled stays are read here: they prove the title was there before.
		assert.doesNotMatch(sql, /backfill'/)
	}
	assert.deepEqual(stays, [
		{
			key: titleKey("movie", 10),
			service: 1796,
			landedOn: ago(1),
			exact: true,
			backfill: false,
			droppedOn: null,
			createdAt: ago(1) + 3600,
		},
		{
			key: titleKey("show", 20),
			service: 8,
			landedOn: ago(40),
			exact: false,
			backfill: true,
			droppedOn: null,
			createdAt: ago(40),
		},
		{
			key: titleKey("show", 20),
			service: 1796,
			landedOn: ago(2),
			exact: true,
			backfill: false,
			droppedOn: null,
			createdAt: ago(2),
		},
	])
})

test("a page's arrivals: the window from the launch, backfill as old catalog, newest first", async () => {
	const { run } = fakeCrate(
		[
			["movie", 10],
			["movie", 11],
			["show", 20],
		],
		{
			movie: [
				[10, 8, "title", "exact", ago(1), null, ago(1)],
				[11, 8, "title", "unknown", ago(15), null, ago(15)],
			],
			show: [
				[20, 8, "backfill", "unknown", ago(40), null, ago(40)],
				[20, 1796, "title", "exact", ago(2), null, ago(2)],
			],
		},
	)
	const arrivals = await readArrivals(
		{
			country: "US",
			services: [8],
			now: NOW,
			launch: Date.parse("2026-10-01T00:00:00Z"),
		},
		run,
	)
	assert.deepEqual(arrivals, [
		{ key: titleKey("movie", 10), service: 8, at: ago(1), exact: true },
	])
})
