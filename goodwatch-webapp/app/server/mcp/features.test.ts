import "../title-filter/test-alias.ts"
import assert from "node:assert/strict"
import { test } from "node:test"
const { readToolDefinitions } = await import("./tools.server.ts")
const { writeToolDefinitions } = await import("./write-tools.server.ts")
import { editListKeys } from "./lists.ts"
import { filmographyView } from "./people.ts"
import { titleKey } from "../../utils/title-key.ts"
import { isWriteCall } from "./write-names.ts"

const parse = (name: string, args: object) =>
	[...readToolDefinitions, ...writeToolDefinitions]
		.find((tool) => tool.name === name)!
		.schema.safeParse(args)

test("people, list and settings schemas enforce selectors, defaults and strict boundaries", () => {
	assert.equal(
		parse("search_people", { query: "  Greta Gerwig " }).success,
		true,
	)
	assert.equal(parse("search_people", { query: "g" }).success, false)
	assert.equal(
		parse("search_people", { query: "Greta", cursor: "ranked:123:0" }).success,
		false,
	)
	assert.deepEqual(parse("get_person", { person_id: 516 }).data, {
		person_id: 516,
		role: "all",
		sort: "for_you",
		exclude_seen: false,
		limit: 20,
	})
	for (const sort of ["for_you", "newest", "score"])
		for (const role of ["acting", "directing", "writing"])
			assert.equal(
				parse("get_person", {
					person_id: 516,
					sort,
					role,
					exclude_seen: true,
					cursor: "offset:20",
				}).success,
				true,
			)
	for (const args of [
		{},
		{ person_id: 0 },
		{ person_id: 1, role: "producer" },
		{ person_id: 1, sort: "added" },
	])
		assert.equal(parse("get_person", args).success, false)
	assert.equal(parse("get_my_lists", { limit: 20 }).success, true)
	assert.equal(parse("get_my_lists", { user_id: "other" }).success, false)
	assert.equal(parse("get_list", { list_id: "abcdefghij" }).success, true)
	assert.equal(parse("get_list", { list_id: "../someone" }).success, false)
	assert.equal(parse("get_settings", {}).success, true)
	assert.equal(parse("get_settings", { user_id: "other" }).success, false)
})

test("every new mutation is write scoped and requires a durable action ID", () => {
	const titles = [1, 2, 3, 4, 5].map((id) => ({
		title_id: `movie:${id}`,
		title_name: "Ignored",
		year: 2000,
	}))
	for (const [name, args] of [
		["create_list", { list_name: "Favorites", titles }],
		[
			"update_list_titles",
			{
				list_id: "abcdefghij",
				add_titles: titles.slice(0, 1),
				remove_title_ids: ["movie:9"],
			},
		],
		["set_settings", { country: "de", language: "de" }],
	] as const) {
		assert.equal(isWriteCall({ method: "tools/call", params: { name } }), true)
		assert.equal(parse(name, args).success, false)
		assert.equal(parse(name, { ...args, action_id: "stable-id" }).success, true)
	}
	assert.equal(
		parse("create_list", {
			action_id: "x",
			list_name: "List",
			titles: titles.slice(0, 4),
		}).success,
		false,
	)
	assert.equal(
		parse("update_list_titles", {
			action_id: "x",
			list_id: "abcdefghij",
			add_titles: titles,
			remove_title_ids: ["movie:9"],
		}).success,
		false,
	)
	for (const args of [
		{},
		{ language: "xx" },
		{ country: "Germany" },
		{ language: "de", service_ids: [8] },
	])
		assert.equal(
			parse("set_settings", { ...args, action_id: "x" }).success,
			false,
		)
	assert.equal(
		parse("set_settings", { action_id: "x", language: "browser" }).success,
		true,
	)
	assert.equal(
		writeToolDefinitions
			.find((tool) => tool.name === "set_settings")!
			.schema.parse({ action_id: "x", country: " de " }).country,
		"DE",
	)
})

test("episode ranges and whole seasons require unambiguous ascending regular episode selectors", () => {
	const base = { title_id: "show:1399", action_id: "range" }
	for (const args of [
		{ season: 2, episode: 1, episode_end: 4 },
		{ season: 1, whole_season: true },
		{ season: 1, episode: 1, episode_end: 1, date: "2020-01-01" },
	])
		assert.equal(parse("log_watch", { ...base, ...args }).success, true)
	for (const args of [
		{ episode_end: 4 },
		{ season: 1, episode: 4, episode_end: 1 },
		{ season: 0, episode: 1, episode_end: 2 },
		{ whole_season: true },
		{ season: 1, episode: 1, whole_season: true },
		{ season: 1, whole_season: true, date: "2020-02-31" },
	])
		assert.equal(parse("log_watch", { ...base, ...args }).success, false)
})

test("list edits preserve rank and five distinct titles; invalid changes cannot shrink or duplicate the list", () => {
	const current = ["movie:1", "show:1", "movie:2", "movie:3", "movie:4"]
	assert.deepEqual(
		editListKeys(current, ["movie:5", "movie:6"], ["show:1", "movie:3"]),
		["movie:1", "movie:2", "movie:4", "movie:5", "movie:6"],
	)
	for (const [add, remove] of [
		[["movie:5"], []],
		[[], ["movie:1"]],
		[["movie:2"], ["movie:1"]],
		[["movie:5"], ["movie:9"]],
		[
			["movie:5", "movie:5"],
			["movie:1", "movie:3"],
		],
	])
		assert.throws(() => editListKeys(current, add, remove))
	assert.equal(current.length, 5)
})

test("filmography sorts and filters the full set, preserves missing-score credits and media namespaces", () => {
	const credits = [
		{
			key: "movie:1",
			media_type: "movie" as const,
			tmdb_id: 1,
			roles: ["Acting"],
			release_year: 2020,
			score: 80,
			popularity: 10,
			weight: 1,
		},
		{
			key: "movie:2",
			media_type: "movie" as const,
			tmdb_id: 2,
			roles: ["Directing", "Writing"],
			release_year: 2024,
			score: 70,
			popularity: 9,
			weight: 1,
		},
		{
			key: "show:1",
			media_type: "show" as const,
			tmdb_id: 1,
			roles: ["Writing"],
			release_year: null,
			score: null,
			popularity: 0,
			weight: 0,
		},
	]
	const matches = new Map([
		["movie:1", 0.5],
		["movie:2", 0.9],
	])
	assert.deepEqual(
		filmographyView(credits, {}, [], matches).map((c) => c.key),
		["movie:2", "movie:1", "show:1"],
	)
	assert.deepEqual(
		filmographyView(credits, { sort: "score" }).map((c) => c.key),
		["movie:1", "movie:2", "show:1"],
	)
	assert.deepEqual(
		filmographyView(credits, { sort: "newest" }).map((c) => c.key),
		["movie:2", "movie:1", "show:1"],
	)
	assert.deepEqual(
		filmographyView(credits, { role: "writing", exclude_seen: true }, [
			titleKey("movie", 2),
		]).map((c) => c.key),
		["show:1"],
	)
	assert.equal(filmographyView(credits, { role: "acting" }).length, 1)
	assert.equal(credits[0].key, "movie:1")
})

test("filmography canonicalizes aliases before taste order, seen filtering and paging", () => {
	const original = {
		key: "movie:3635601",
		tmdb_id: 3635601,
		media_type: "movie" as const,
		roles: ["Acting"],
		release_year: 2020,
		score: 80,
		weight: 1,
		popularity: 2,
	}
	const canonical = {
		...original,
		key: "movie:872517",
		tmdb_id: 872517,
		roles: ["Writing"],
	}
	const found = filmographyView(
		[original, canonical],
		{},
		[],
		new Map([["movie:872517", 0.95]]),
	)
	assert.equal(found.length, 1)
	assert.equal(found[0].key, "movie:872517")
	assert.deepEqual(found[0].roles, ["Acting", "Writing"])
	assert.equal(
		filmographyView([original], { exclude_seen: true }, [
			titleKey("movie", 872517),
		]).length,
		0,
	)
})
