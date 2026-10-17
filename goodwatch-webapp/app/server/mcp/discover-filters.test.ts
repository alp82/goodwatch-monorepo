import "../title-filter/test-alias.ts"
import assert from "node:assert/strict"
import { test } from "node:test"
import * as z from "zod4"
const {
	discoverFilters,
	discoverParams,
	discoverView,
	discoverViewKey,
	filterArgs,
	validDiscoverRanges,
} = await import("./discover-filters.ts")
const { filterStateFromParams } = await import("../../domain/filter-state.ts")
const { withPageLink } = await import("./links.ts")
const schema = z.object(discoverFilters).strict().refine(validDiscoverRanges)

test("every Discover parameter uses the site's URL codec and preserves its meaning", () => {
	const args = {
		type: "show" as const,
		genres: ["Drama", "Science Fiction"],
		min_year: 2011,
		max_year: 2025,
		min_runtime: 20,
		max_runtime: 60,
		minimum_score: 75,
		providers: [8, 9],
		anime: "none" as const,
		moods: ["funny" as const],
		themes: ["war" as const],
		styles: ["animated" as const],
		minimum_match: 80 as const,
		released: "recent" as const,
		age_limit: 12,
		hide_content: ["drugs" as const],
		show_content: ["violence" as const],
		order: "newest" as const,
		for_you: false,
		exclude_seen: true,
	}
	assert.ok(
		schema.safeParse(
			filterArgs({ ...args, for_you: undefined, exclude_seen: undefined }),
		).success,
	)
	const view = discoverView(args, false)
	const params = discoverParams(args, false)
	assert.deepEqual(
		filterStateFromParams(params, { onMyServices: true, notSeenYet: true }),
		view.state,
	)
	assert.equal(params.get("sort"), "newest")
	assert.equal(params.get("foryou"), "0")
	assert.equal(view.state.legacy?.minRuntime, "20")
	assert.equal(view.state.minScore, 75)
	const result = withPageLink(
		"https://goodwatch.app",
		"discover_titles",
		args,
		{},
	)
	const url = new URL(String(result.page_url))
	assert.equal(url.pathname, "/discover")
	assert.equal(url.searchParams.get("layout"), "grid")
	assert.equal(url.searchParams.get("services"), "8,9")
	assert.equal(result.page_note, undefined)
	url.searchParams.delete("layout")
	assert.deepEqual(url.searchParams, params)
})
test("default discovery and every ordering use site semantics", () => {
	const defaultView = discoverView({}, false)
	assert.equal(defaultView.sort, "popular")
	assert.equal(defaultView.forYou, true)
	assert.equal(defaultView.state.onMyServices, false)
	assert.equal(defaultView.state.notSeenYet, false)
	for (const [order, sort] of [
		["popularity", "popular"],
		["newest", "newest"],
		["score", "top"],
		["match", "match"],
	] as const) {
		assert.equal(discoverView({ order }, false).sort, sort)
		assert.equal(discoverView({ order }, false).forYou, order === "match")
		assert.equal(discoverView({ order, for_you: true }, false).forYou, true)
	}
	assert.equal(discoverView({}, true).sort, "relevance")
	assert.equal(
		discoverParams({ on_my_services: true }, false).get("services"),
		"mine",
	)
})
test("every new parameter rejects invalid input, ranges and conflicting services", () => {
	for (const [key, value] of Object.entries({
		type: "tv",
		genres: [1],
		min_year: 1700,
		max_year: 2200,
		min_runtime: -1,
		max_runtime: 10001,
		minimum_score: 101,
		on_my_services: "yes",
		providers: [-8],
		anime: "yes",
		moods: ["bogus"],
		themes: ["bogus"],
		styles: ["bogus"],
		minimum_match: 75,
		released: "yesterday",
		age_limit: 19,
		hide_content: ["bogus"],
		show_content: ["bogus"],
		order: "alphabetical",
	}))
		assert.equal(schema.safeParse({ [key]: value }).success, false, key)
	for (const args of [
		{ min_year: 2025, max_year: 2020 },
		{ min_runtime: 90, max_runtime: 40 },
		{ on_my_services: true, providers: [8] },
		{ unknown_filter: true },
	])
		assert.equal(schema.safeParse(args).success, false)
})
test("cache keys cover every filter and contain no query or paging selectors", () => {
	const key = discoverViewKey({})
	for (const args of [
		{ type: "movie" as const },
		{ genres: ["Drama"] },
		{ min_year: 2020 },
		{ max_year: 2020 },
		{ min_runtime: 60 },
		{ max_runtime: 120 },
		{ minimum_score: 75 },
		{ on_my_services: true },
		{ providers: [8] },
		{ anime: "only" as const },
		{ moods: ["funny" as const] },
		{ themes: ["war" as const] },
		{ styles: ["animated" as const] },
		{ minimum_match: 90 as const },
		{ released: "recent" as const },
		{ age_limit: 12 },
		{ hide_content: ["drugs" as const] },
		{ show_content: ["violence" as const] },
		{ order: "newest" as const },
		{ for_you: false },
		{ exclude_seen: true },
	])
		assert.notEqual(discoverViewKey(args), key, JSON.stringify(args))
	assert.deepEqual(
		filterArgs({
			query: "private query",
			cursor: "offset:40",
			type: "movie",
		} as never),
		{ type: "movie" },
	)
})

test("blank search dispatches discovery while ranked cursors inherit their query", async () => {
	const { isDiscoverySearch } = await import("./discover-filters.ts")
	const { readToolDefinitions } = await import("./tools.server.ts")
	const search = readToolDefinitions.find(
		(tool) => tool.name === "search_titles",
	)!.schema
	for (const args of [
		{},
		{ query: "" },
		{ query: " \t " },
		{ ranked: true },
		{ ranked: true, cursor: "offset:40" },
	]) {
		const parsed = search.parse(args)
		assert.equal(isDiscoverySearch(parsed), true)
	}
	for (const args of [
		{ query: "Arrival" },
		{ ranked: true, cursor: `ranked:${"a".repeat(32)}:40` },
	]) {
		assert.equal(isDiscoverySearch(search.parse(args)), false)
	}
	assert.equal(
		search.safeParse({ query: "Arrival", ranked: true, cursor: "offset:40" })
			.success,
		false,
	)
	assert.equal(
		search.safeParse({ cursor: `ranked:${"a".repeat(32)}:40` }).success,
		false,
	)
})

test("single genre names normalize to the same filter model as arrays", () => {
	assert.deepEqual(
		schema.parse({ genres: " Comedy " }),
		schema.parse({ genres: ["Comedy"] }),
	)
	for (const genres of ["", "  ", 3])
		assert.equal(schema.safeParse({ genres }).success, false)
})
