import assert from "node:assert/strict"
import { test } from "node:test"
import {
	AWARD_BODIES,
	AWARD_CHIPS_ALL_SHOWN_UP_TO,
	awardChipLimit,
	awardLabel,
	awardParam,
	awardTitlesQuery,
	parseAwardParam,
	readAwardWords,
	toggleAwardBody,
} from "./award-filter.ts"

test("the awards parameter parses, drops unknown bodies and writes back in body order", () => {
	assert.equal(parseAwardParam(null), undefined)
	assert.equal(parseAwardParam("maybe:oscars"), undefined)
	assert.deepEqual(parseAwardParam("won"), { outcome: "won", bodies: [] })
	const filter = parseAwardParam("nominated:globes,x,oscars,globes")
	assert.deepEqual(filter, {
		outcome: "nominated",
		bodies: ["oscars", "globes"],
	})
	assert.equal(awardParam(filter), "nominated:oscars,globes")
	assert.equal(
		awardParam({ outcome: "won", bodies: ["globes", "oscars"] }),
		"won:oscars,globes",
	)
	assert.equal(awardParam(undefined), null)
})

test("labels name the outcome and the first two bodies, never a count of awards", () => {
	assert.equal(awardLabel({ outcome: "won", bodies: [] }), "Award winners")
	assert.equal(
		awardLabel({ outcome: "won", bodies: ["oscars"] }),
		"Oscar winners",
	)
	assert.equal(
		awardLabel({ outcome: "nominated", bodies: ["emmys", "oscars"] }),
		"Oscar or Emmy nominees",
	)
	assert.equal(
		awardLabel({ outcome: "won", bodies: ["oscars", "emmys", "bafta", "sag"] }),
		"Oscar, Emmy +2 winners",
	)
})

test("toggling a body turns the filter on as won and keeps body order", () => {
	assert.deepEqual(toggleAwardBody(undefined, "emmys"), {
		outcome: "won",
		bodies: ["emmys"],
	})
	assert.deepEqual(
		toggleAwardBody({ outcome: "nominated", bodies: ["emmys"] }, "oscars"),
		{
			outcome: "nominated",
			bodies: ["oscars", "emmys"],
		},
	)
	assert.deepEqual(
		toggleAwardBody({ outcome: "won", bodies: ["oscars"] }, "oscars"),
		{ outcome: "won", bodies: [] },
	)
})

test("every chip shows up to 30 options; above 30 the limit applies", () => {
	assert.equal(AWARD_CHIPS_ALL_SHOWN_UP_TO, 30)
	// Today: "Any award" and every body, all shown.
	assert.equal(
		awardChipLimit(AWARD_BODIES.length + 1, 4),
		AWARD_BODIES.length + 1,
	)
	assert.equal(awardChipLimit(30, 4), 30)
	assert.equal(awardChipLimit(31, 4), 4)
})

test("the view query: wins need has_win, nominations need nothing, bodies bind their award names", () => {
	assert.deepEqual(awardTitlesQuery({ outcome: "won", bodies: [] }, 10), {
		sql: "SELECT media_type, media_tmdb_id FROM doc.award_title_display WHERE has_win GROUP BY media_type, media_tmdb_id LIMIT 10",
		params: [],
	})
	assert.deepEqual(
		awardTitlesQuery(
			{ outcome: "nominated", bodies: ["globes", "cesars"] },
			10,
		),
		{
			sql: "SELECT media_type, media_tmdb_id FROM doc.award_title_display WHERE award_name IN (?, ?) GROUP BY media_type, media_tmdb_id LIMIT 10",
			params: ["Golden Globe Awards", "César Awards"],
		},
	)
})

test("award words in a search read as the filter and leave the rest to search", () => {
	assert.deepEqual(readAwardWords("oscar winners"), {
		filter: { outcome: "won", bodies: ["oscars"] },
		rest: "",
	})
	assert.deepEqual(readAwardWords("emmy winning comedies"), {
		filter: { outcome: "won", bodies: ["emmys"] },
		rest: "comedies",
	})
	assert.deepEqual(readAwardWords("golden globe nominated 2024"), {
		filter: { outcome: "nominated", bodies: ["globes"] },
		rest: "2024",
	})
	assert.deepEqual(readAwardWords("daytime emmy winning shows"), {
		filter: { outcome: "won", bodies: ["daytime"] },
		rest: "shows",
	})
	assert.deepEqual(readAwardWords("academy awards dramas"), {
		filter: { outcome: "won", bodies: ["oscars"] },
		rest: "dramas",
	})
	assert.deepEqual(readAwardWords("emmy award comedies"), {
		filter: { outcome: "won", bodies: ["emmys"] },
		rest: "comedies",
	})
	assert.deepEqual(readAwardWords("bafta and cesar nominees"), {
		filter: { outcome: "nominated", bodies: ["bafta", "cesars"] },
		rest: "",
	})
	assert.deepEqual(readAwardWords("award-winning thrillers")?.filter, {
		outcome: "won",
		bodies: [],
	})
	assert.equal(readAwardWords("winning streak"), null)
	assert.equal(readAwardWords("space westerns"), null)
	// A body's name alone is a search: people, places and the film "Oscar".
	assert.equal(readAwardWords("oscar isaac"), null)
	assert.equal(readAwardWords("emmy rossum movies"), null)
	assert.equal(readAwardWords("pga tour"), null)
	assert.equal(readAwardWords("sag harbor"), null)
	assert.equal(readAwardWords("oscar"), null)
})
