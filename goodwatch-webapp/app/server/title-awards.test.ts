import assert from "node:assert/strict"
import { test } from "node:test"
import { pageAwards, summarizeTitleAwards, type AwardDisplayRow } from "./title-awards.ts"
import { readTitleAwards } from "./title-awards-read.ts"

const row = (
	award = "Academy Awards",
	category = "Cinematography",
	year = "2024",
	win = true,
): AwardDisplayRow => ({
	award_name: award,
	category_name: category,
	ceremony_year: year,
	has_win: win,
	has_nomination: true,
})

test("reported results sort by year, prestige, remaining award name, then category", () => {
	const rows = [
		row("Z Awards"),
		row("Golden Globe Awards"),
		row("BAFTA Awards"),
		row("Academy Awards", "Writing"),
		row("Primetime Emmy Awards"),
		row("Academy Awards", "Acting"),
		row("A Awards"),
		row("Academy Awards", "Older", "2023"),
		row("Z Awards", "Newer", "2025"),
	]
	const before = structuredClone(rows)
	assert.deepEqual(
		summarizeTitleAwards(rows)?.wins.map(
			(r) => `${r.year}/${r.award}/${r.category}`,
		),
		[
			"2025/Z Awards/Newer",
			"2024/Academy Awards/Acting",
			"2024/Academy Awards/Writing",
			"2024/Primetime Emmy Awards/Cinematography",
			"2024/Golden Globe Awards/Cinematography",
			"2024/BAFTA Awards/Cinematography",
			"2024/A Awards/Cinematography",
			"2024/Z Awards/Cinematography",
			"2023/Academy Awards/Older",
		],
	)
	assert.deepEqual(rows, before)
})

test("a win takes precedence over a nomination; no rows omit the summary", () => {
	assert.equal(summarizeTitleAwards([]), undefined)
	const result = summarizeTitleAwards([
		row(),
		row("BAFTA Awards", "Sound", "2024", false),
	])
	assert.deepEqual(result?.wins, [
		{ award: "Academy Awards", category: "Cinematography", year: "2024" },
	])
	assert.deepEqual(result?.nominations, [
		{ award: "BAFTA Awards", category: "Sound", year: "2024" },
	])
	assert.equal(result?.coverage, "partial")
	assert.equal(result?.source, "TVDB")
	assert.match(result?.note ?? "", /incomplete.*don.t establish award totals/)
	assert.ok(!("truncated" in (result ?? {})))
})

test("each result list is capped independently, with a boolean and no omitted counts", () => {
	const entries = (length: number, win: boolean) =>
		Array.from({ length }, (_, i) =>
			row("Academy Awards", String(i).padStart(2, "0"), "2024", win),
		)
	for (const [wins, nominations] of [
		[26, 2],
		[2, 26],
		[26, 26],
		[25, 25],
	]) {
		const result = summarizeTitleAwards([
			...entries(wins, true),
			...entries(nominations, false),
		])!
		assert.equal(result.wins.length, Math.min(25, wins))
		assert.equal(result.nominations.length, Math.min(25, nominations))
		assert.equal(
			result.truncated,
			wins > 25 || nominations > 25 ? true : undefined,
		)
		assert.deepEqual(
			Object.keys(result).sort(),
			[
				"coverage",
				"note",
				"source",
				"wins",
				"nominations",
				...(result.truncated ? ["truncated"] : []),
			].sort(),
		)
	}
})

test("reader scopes one display-view query by type and TMDB id and forwards cancellation", async () => {
	let calls = 0
	const result = await readTitleAwards(
		async (sql, args, signal) => {
			calls++
			assert.match(
				sql,
				/FROM doc\.tvdb_award_display WHERE media_type = \? AND media_tmdb_id = \?/,
			)
			assert.doesNotMatch(
				sql,
				/tvdb_nomination|source_row_count|recipient|details/,
			)
			assert.deepEqual(args, ["movie", 872585])
			assert.equal(signal.aborted, false)
			return [row()]
		},
		"movie",
		872585,
	)
	assert.equal(calls, 1)
	assert.equal(result?.wins[0]?.category, "Cinematography")
	assert.equal(await readTitleAwards(async () => [], "show", 1), undefined)
})

test("failed and stalled reads degrade to no awards", async () => {
	assert.equal(
		await readTitleAwards(
			async () => {
				throw new Error("unavailable")
			},
			"movie",
			1,
		),
		undefined,
	)
	let signal: AbortSignal | undefined
	assert.equal(
		await readTitleAwards(
			async (_sql, _args, current) => {
				signal = current
				return new Promise(() => {})
			},
			"show",
			1,
			10,
		),
		undefined,
	)
	assert.equal(signal?.aborted, true)
})

test("missing text fields neither throw while reading nor escape as a rejection", async () => {
	const broken = {
		...row(),
		award_name: null,
		category_name: null,
	} as unknown as AwardDisplayRow
	assert.doesNotThrow(() => summarizeTitleAwards([broken, row()]))
	const read = await readTitleAwards(async () => [broken], "movie", 1)
	assert.equal(read?.wins.length, 1)
	const failing = await readTitleAwards(
		async () => {
			throw new Error("down")
		},
		"movie",
		1,
	)
	assert.equal(failing, undefined)
})

test("title page data keeps only the wins its JSON-LD lists", () => {
	const wins = Array.from({ length: 30 }, (_, i) => row("Academy Awards", `C${i}`))
	const page = pageAwards(summarizeTitleAwards([...wins, row("BAFTA Awards", "X", "2024", false)]))
	assert.equal(page?.wins.length, 20)
	assert.deepEqual(page?.nominations, [])
	assert.equal(pageAwards(summarizeTitleAwards([row("BAFTA Awards", "X", "2024", false)])), undefined)
	assert.equal(pageAwards(undefined), undefined)
})
