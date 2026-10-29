import "../server/title-filter/test-alias.ts"
import assert from "node:assert/strict"
import { test } from "node:test"
import crewFixture from "./__fixtures__/show-1399-crew.json" with {
	type: "json",
}
import castFixture from "./__fixtures__/show-1416-cast.json" with {
	type: "json",
}
import type { CastRaw, CrewRaw } from "./title-people"
const { buildCast, buildCrew, parsePeopleParams, peoplePage } = await import(
	"./title-people.ts"
)

const params = (query = "") =>
	parsePeopleParams(new URLSearchParams(`type=show&id=1416&kind=cast&${query}`))
const cast = (id: number, overrides: Partial<CastRaw> = {}): CastRaw => ({
	id,
	name: `Person ${id}`,
	profile_path: null,
	popularity: null,
	character: null,
	order_default: id,
	episode_count_character: null,
	episode_count_total: null,
	...overrides,
})
const crew = (id: number, overrides: Partial<CrewRaw> = {}): CrewRaw => ({
	id,
	name: `Person ${id}`,
	profile_path: null,
	popularity: null,
	job: "Writer",
	department: null,
	episode_count_job: null,
	episode_count_total: null,
	...overrides,
})

test("validates required fields, integer syntax, safe ids, offsets, and limit bounds", () => {
	assert.equal(params().limit, 60)
	assert.equal(params().offset, 0)
	assert.equal(params("limit=200&offset=3257").limit, 200)
	for (const query of [
		"",
		"type=tv&id=1&kind=cast",
		"type=movie&id=1&kind=other",
		"type=movie&id=1",
		"type=movie&kind=cast",
		...[
			"id=0",
			"id=-1",
			"id=1.2",
			"id=1e3",
			"id=1%20OR%201=1",
			"id=9007199254740992",
			"id=",
			"offset=-1",
			"offset=1.5",
			"offset=Infinity",
			"offset=",
			"limit=0",
			"limit=201",
			"limit=1.5",
			"limit=",
		].map((value) =>
			`type=movie&id=1&kind=cast&${value}`.replace(
				"id=1&kind=cast&id=",
				"kind=cast&id=",
			),
		),
	]) {
		assert.throws(
			() => parsePeopleParams(new URLSearchParams(query)),
			(error: unknown) => error instanceof Response && error.status === 400,
			query,
		)
	}
})

test("merges saved cast characters and uses show episode tiers before filtering", () => {
	const data = buildCast("show", castFixture, 466)
	assert.equal(data.all.length, 5)
	assert.deepEqual(
		data.all.map((r) => r.group),
		["main", "main", "recurring", "guest", "guest"],
	)
	assert.deepEqual(data.all[2].roles, ["Joe", "Anesthesiologist Jeremy"])
	assert.equal(data.all[2].episodes, 33)
	assert.equal(data.all[2].name, "Steven W. Bailey")
	const page = peoplePage(data, params("q=JEREMY&group=guest"))
	assert.equal(page.total, 5)
	assert.equal(page.matched, 0)
	assert.deepEqual(
		page.groups.map((g) => g.count),
		[0, 1, 0],
	)
	assert.equal(page.showEpisodes, 466)
})

test("show tier thresholds use the percentage, minimum, and maximum boundaries", () => {
	for (const [episodes, main, recurring] of [
		[10, 4, 2],
		[100, 40, 5],
		[466, 60, 10],
	]) {
		const data = buildCast(
			"show",
			[main, main - 1, recurring, recurring - 1].map((count, i) =>
				cast(i, { episode_count_character: count }),
			),
			episodes,
		)
		assert.deepEqual(
			data.all.map((r) => r.group),
			["main", "recurring", "recurring", "guest"],
		)
	}
	assert.equal(buildCast("show", [cast(1)], null).all[0].group, "main")
	const merged = buildCast(
		"show",
		[
			cast(1, { character: "A", episode_count_character: 3 }),
			cast(1, { character: "B", episode_count_character: 4 }),
		],
		100,
	)
	assert.equal(merged.all[0].episodes, 7)
})

test("movie tiers count people, order by billing then id, and keep missing portraits", () => {
	const data = buildCast(
		"movie",
		[
			...Array.from({ length: 14 }, (_, i) => cast(14 - i)),
			cast(1, { character: "Other role", order_default: 50 }),
		],
		null,
	)
	assert.equal(data.all.length, 14)
	assert.deepEqual(
		data.all.map((r) => r.id),
		Array.from({ length: 14 }, (_, i) => i + 1),
	)
	assert.equal(data.all.filter((r) => r.group === "top").length, 12)
	assert.equal(data.all[12].group, "more")
	assert.ok(data.all.every((r) => r.episodes === null))
	assert.equal(data.all[0].profilePath, null)
	assert.equal(
		buildCast("movie", [cast(1, { name: null })], null).all[0].name,
		"Unknown",
	)
})

test("crew uses saved job departments, merges jobs, and puts key jobs first", () => {
	const data = buildCrew("show", crewFixture, 73)
	assert.deepEqual(
		data.all.map((r) => r.id),
		[237053, 1223796, 56746],
	)
	assert.deepEqual(data.all[0].roles, [
		"Novel",
		"Co-Executive Producer",
		"Writer",
	])
	assert.equal(data.all[0].group, "Writing")
	assert.ok(data.all.every((r) => r.key))
	assert.equal(data.all[1].profilePath, null)
	assert.equal(data.all[1].episodes, 73)
	const filtered = peoplePage(data, {
		...params("q=writer&group=Production"),
		kind: "crew",
	})
	assert.deepEqual(filtered.groups, [
		{ key: "Writing", label: "Writing", count: 1 },
		{ key: "Production", label: "Production", count: 0 },
	])
	assert.equal(filtered.matched, 0)
})

test("crew department follows the biggest job; key rank, episodes, and popularity break ties", () => {
	const data = buildCrew(
		"show",
		[
			crew(1, { job: "Director", episode_count_job: 1 }),
			crew(1, { job: "Writer", episode_count_job: 20 }),
			crew(2, { job: "New job", episode_count_job: 100 }),
			crew(3, { job: "Staff Writer", episode_count_job: 80 }),
			crew(4, { episode_count_job: 5, popularity: 2 }),
			crew(5, { episode_count_job: 5, popularity: 4 }),
			crew(6, { episode_count_job: 10 }),
			crew(7, { job: "New job", department: "Camera" }),
		],
		100,
	)
	assert.deepEqual(
		data.all.map((r) => r.id),
		[1, 6, 5, 4, 3, 7, 2],
	)
	assert.equal(data.all[0].group, "Writing")
	assert.equal(data.all.at(-1)?.key, false)
	assert.equal(data.all.at(-1)?.group, "Crew")
	assert.ok(data.all.every((r) => !("_pop" in r)))
	assert.equal(buildCrew("movie", [crew(1)], null).all[0].episodes, null)
})

test("search folds accents and case in names, characters, and jobs", () => {
	const data = buildCast(
		"movie",
		[cast(1, { name: "Élodie", character: "Héroïne" })],
		null,
	)
	assert.equal(peoplePage(data, params("q=%20ELODIE%20")).matched, 1)
	assert.equal(peoplePage(data, params("q=heroine")).matched, 1)
	const jobs = buildCrew("movie", [crew(1, { job: "Décorateur" })], null)
	assert.equal(
		peoplePage(jobs, { ...params("q=decorateur"), kind: "crew" }).matched,
		1,
	)
})

test("family-name sorting handles particles, suffixes, accents, and non-Latin initials", () => {
	const names = [
		"Vincent van Gogh",
		"Martin Luther King Jr.",
		"Steven W. Bailey",
		"Max von Sydow",
		"Élodie Álvarez",
		"Björk",
		"王 小明",
		"",
	]
	const data = buildCast(
		"movie",
		names.map((name, i) => cast(i, { name })),
		null,
	)
	const page = peoplePage(data, params("sort=name&letter=g"))
	assert.deepEqual(
		page.rows.map((r) => r.name),
		["Vincent van Gogh"],
	)
	assert.deepEqual(page.letters, { A: 1, B: 2, G: 1, K: 1, S: 1, "#": 2 })
	assert.equal(page.matched, 1)
	const alphabetical = peoplePage(data, params("sort=name"))
	assert.deepEqual(
		alphabetical.rows.filter((r) => /[a-z]/i.test(r.name)).map((r) => r.name),
		[
			"Élodie Álvarez",
			"Steven W. Bailey",
			"Björk",
			"Vincent van Gogh",
			"Martin Luther King Jr.",
			"Max von Sydow",
		],
	)
	assert.equal(peoplePage(data, params("sort=name&letter=%23")).matched, 2)
	assert.equal(peoplePage(data, params("letter=g")).matched, 8)
	assert.equal(
		peoplePage(data, params("q=vincent&sort=name&group=top")).letters?.G,
		1,
	)
})

test("paging covers large casts without gaps and never mutates the cached list", () => {
	const data = buildCast(
		"show",
		Array.from({ length: 3257 }, (_, i) => cast(i)),
		466,
	)
	const ids: number[] = []
	let offset: number | null = 0
	while (offset !== null) {
		const page = peoplePage(data, { ...params(), offset })
		assert.ok(page.rows.length <= 60)
		ids.push(...page.rows.map((r) => r.id))
		offset = page.nextOffset
	}
	assert.equal(new Set(ids).size, 3257)
	const before = JSON.stringify(data)
	peoplePage(data, params("sort=name&q=person&letter=p"))
	assert.equal(JSON.stringify(data), before)
	assert.deepEqual(peoplePage(data, params("offset=4000")).rows, [])
	const empty = peoplePage(buildCast("show", [], null), params())
	assert.equal(empty.total, 0)
	assert.equal(empty.nextOffset, null)
	assert.equal(empty.groups.length, 3)
})
