import assert from "node:assert/strict"
import { test } from "node:test"
import {
	type AwardIndexRow,
	buildAwardIndex,
	createAwardIndexCache,
} from "./award-marks.server.ts"

const row = (
	media_type: string,
	media_tmdb_id: number,
	award_name: string,
	has_win = true,
): AwardIndexRow => ({
	media_type,
	media_tmdb_id,
	award_name,
	category_name: "Picture",
	ceremony_year: "2024",
	has_win,
	has_nomination: true,
})

test("the index marks only titles with a win and keeps results for nominated ones", () => {
	const index = buildAwardIndex([
		row("movie", 1, "BAFTA Awards"),
		row("movie", 1, "Academy Awards"),
		row("show", 1, "Primetime Emmy Awards", false),
		row("person", 9, "Academy Awards"),
	])
	assert.equal(index.marks.get("movie:1"), "Oscar")
	assert.equal(index.marks.has("show:1"), false)
	assert.equal(index.notable.get("show:1")?.[0]?.won, false)
	assert.equal(index.marks.size, 1)
	assert.deepEqual(JSON.parse(index.payload), {
		movie: { Oscar: [1] },
		show: {},
	})
})

test("the cache reads once, keeps answering through a failed refresh, and reads again after its lifetime", async () => {
	let clock = 0
	let reads = 0
	let fail = false
	const awardIndex = createAwardIndexCache(
		async () => {
			reads++
			if (fail) throw new Error("down")
			return [row("movie", reads, "Academy Awards")]
		},
		() => clock,
	)
	const first = await awardIndex()
	assert.equal(first?.marks.get("movie:1"), "Oscar")
	await awardIndex()
	assert.equal(reads, 1)
	clock += 7 * 60 * 60 * 1000
	fail = true
	const console_error = console.error
	console.error = () => {}
	try {
		assert.equal(await awardIndex(), first)
		await new Promise((r) => setTimeout(r, 0))
		assert.equal(await awardIndex(), first)
	} finally {
		console.error = console_error
	}
	assert.equal(reads, 2)
	fail = false
	clock += 2 * 60 * 1000
	await awardIndex()
	await new Promise((r) => setTimeout(r, 0))
	assert.equal((await awardIndex())?.marks.get("movie:3"), "Oscar")
})
