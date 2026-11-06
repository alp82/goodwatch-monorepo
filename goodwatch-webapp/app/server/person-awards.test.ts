import assert from "node:assert/strict"
import { test } from "node:test"
import { type PersonAwardRow, summarizePersonAwards } from "./person-awards.ts"

const row = (win = true): PersonAwardRow => ({
	result_id: "one",
	award_name: "Academy Awards",
	category_name: "Actor in a Leading Role",
	ceremony_year: "2024",
	ceremony_label: "96th Academy Awards",
	has_win: win,
	has_nomination: true,
	source_names: ["Wikidata"],
	reference_urls: ["https://www.wikidata.org/wiki/Q202589"],
	works_json: JSON.stringify([
		{
			name: "Oppenheimer",
			kind: "movie",
			media_type: "movie",
			media_tmdb_id: 872585,
		},
	]),
})
test("a verified person result retains sources, ceremony and awarded work without complete totals", () => {
	const awards = summarizePersonAwards([row()])!
	assert.equal(awards.coverage, "partial")
	assert.equal(awards.results[0].won, true)
	assert.deepEqual(awards.results[0].sources, ["Wikidata"])
	assert.equal(awards.results[0].ceremony, "96th Academy Awards")
	assert.equal(awards.results[0].works[0].name, "Oppenheimer")
	assert.match(awards.note, /incomplete/)
	assert.ok(!("total_wins" in awards))
})
test("missing optional work data does not erase the supported person result", () => {
	for (const works_json of [null, "broken", "{}", '[{"name":"Bad"}]']) {
		const awards = summarizePersonAwards([{ ...row(), works_json }])!
		assert.deepEqual(awards.results[0].works, [])
	}
	assert.equal(summarizePersonAwards([]), undefined)
})
test("only verified exact character credits are exposed with person awards", () => {
	const awards = summarizePersonAwards([
		{
			...row(),
			portrayals_json: JSON.stringify([
				{
					link_status: "unverified",
					character_name: "Guess",
					credit_id: "guess",
					media_type: "movie",
					media_tmdb_id: 872585,
				},
				{
					link_status: "verified",
					character_name: "J. Robert Oppenheimer",
					credit_id: "exact-credit",
					media_type: "movie",
					media_tmdb_id: 872585,
				},
			]),
		},
	])!
	assert.deepEqual(awards.results[0].portrayals, [
		{
			character_name: "J. Robert Oppenheimer",
			credit_id: "exact-credit",
			media_type: "movie",
			media_tmdb_id: 872585,
		},
	])
})
