import assert from "node:assert/strict"
import { test } from "node:test"
import "../server/title-filter/test-alias.ts"
const { interpret } = await import("./discover-query.ts")

for (const query of ["scary", "scary dark", "scary horror"]) {
	test(`${query}: descriptive filters also retain text for the fingerprint read`, () => {
		const result = interpret(query)
		assert.match(result.semanticQuery, /scary/)
		if (query.includes("dark")) assert.match(result.semanticQuery, /dark/)
		if (query.includes("horror")) assert.match(result.semanticQuery, /horror/)
		assert(result.filters.moods.split(",").includes("scary"))
	})
}
test("hard filters alone do not become semantic searches", () => {
	assert.equal(interpret("netflix 80 under 90 minutes").semanticQuery, "")
})
test("existing moods win conflicts without reintroducing the rejected description", () => {
	const result = interpret("scary", "moods=funny")
	assert.equal(result.semanticQuery, "")
	assert.equal(result.filters.moods, "funny")
})
test("negative descriptive wording stays negative", () => {
	assert.match(interpret("not scary").semanticQuery, /not scary/)
})

for (const query of ["100", "100+", "100%", "100 scary"]) {
	test(`${query}: a bare perfect score is not inferred`, () => {
		const result = interpret(query)
		assert(!result.filters.score)
		assert(result.residual.includes("100"))
	})
}
test("explicit perfect score and source thresholds remain explicit", () => {
	assert.equal(interpret("score 100").filters.score, "100")
	assert.equal(interpret("IMDb 100%").filters.sources, "imdb:100")
})

for (const query of [
	"hostel 3",
	"toy story 2",
	"ocean's 11",
	"12 angry men",
	"21 jump street",
	"28 days later",
	"district 9",
	"the 39 steps",
]) {
	test(`${query}: an unmarked title number stays in the search text`, () => {
		const result = interpret(query)
		assert.equal(result.semanticQuery, query)
		assert.equal(result.filters.score, undefined)
	})
}

test("a title number survives beside independent filters and an existing score", () => {
	for (const query of ["hostel 3 on Netflix", "on Netflix hostel 3"]) {
		const result = interpret(query, "score=70")
		assert.equal(result.semanticQuery, "hostel 3")
		assert.equal(result.filters.services, "8")
		assert.equal(result.filters.score, "70")
	}
})

test("explicit score cues still work beside title text", () => {
	for (const cue of ["score 80", "rated 80", "80+", "80%", "at least 80"]) {
		for (const query of [`hostel 3 ${cue}`, `${cue} hostel 3`]) {
			const result = interpret(query)
			assert.equal(result.semanticQuery, "hostel 3", query)
			assert.equal(result.filters.score, "80", query)
		}
	}
})

test("bare score shorthand still works alone or beside filter words in either order", () => {
	for (const query of [
		"80",
		"80 scary Netflix",
		"scary Netflix 80",
		"Netflix 80 scary",
	]) {
		const result = interpret(query)
		assert.equal(result.filters.score, "80", query)
		assert(!result.residual.includes("80"), query)
	}
})

test("a year cited after a title's words stays in the search text; a year after a genre filters", () => {
	const now = new Date("2026-11-03")
	const cited = interpret("dune 1984", "", now)
	assert.equal(cited.semanticQuery, "dune 1984")
	assert.equal(new URLSearchParams(cited.filters).get("minYear"), null)
	const genre = new URLSearchParams(interpret("horror 1999", "", now).filters)
	assert.equal(genre.get("minYear"), "1999")
	assert.equal(genre.get("maxYear"), "1999")
	// The words before the year were filters: the year filters too.
	for (const q of ["netflix 1999", "scary 1999"]) {
		const view = interpret(q, "", now)
		assert.equal(new URLSearchParams(view.filters).get("minYear"), "1999", q)
		assert.equal(view.residual.includes("1999"), false, q)
	}
	const phrase = new URLSearchParams(
		interpret("time travel movies from 2011", "", now).filters,
	)
	assert.equal(phrase.get("minYear"), "2011")
})

test("a negation ends with the filter it went to: the next words are a new request", () => {
	const pirates = interpret("pirates 2020 no anime funny")
	assert.equal(pirates.filters.anime, "none")
	assert.equal(pirates.filters.moods, "funny")
	assert.equal(pirates.residual, "pirates")
	assert.equal(interpret("netflix no anime scary").filters.moods, "scary")
	assert.equal(
		interpret("no anime funny or romantic").filters.moods,
		"funny,romance",
	)
	assert.equal(interpret("no anime and no gore funny").filters.moods, "funny")
})
test("a negation still reaches words joined to its phrase, and descriptive wording", () => {
	for (const query of [
		"no comedy or horror",
		"nothing scary or sad",
		"not very scary",
	])
		assert(!interpret(query).filters.moods, query)
	assert.match(interpret("no comedy or horror").residual, /no comedy or horror/)
	const both = interpret("no anime, no gore")
	assert.equal(both.filters.anime, "none")
	assert.equal(both.filters.hide, "violence")
})
test("quoted text after a negated filter keeps the negation's end in place", () => {
	assert.equal(
		interpret('no anime "a very long title" scary').filters.moods,
		"scary",
	)
	assert.equal(interpret('no anime "x" scary').filters.moods, "scary")
})
