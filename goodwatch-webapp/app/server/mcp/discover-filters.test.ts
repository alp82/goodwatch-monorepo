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
		rating_country: "DE",
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
	assert.equal(view.state.runtime?.min, 20)
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
	assert.equal(url.searchParams.get("ratingCountry"), "DE")
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

test("MCP exposes source scores, gap and any-service through the shared codec", () => {
	const args = schema.parse({
		source_scores: { imdb: 80, rtCritics: 90 },
		score_gap: "critics",
		any_service: true,
	})
	const view = discoverView(args, false)
	assert.deepEqual(view.state.sourceScores, { imdb: 80, rtCritics: 90 })
	assert.equal(view.state.scoreGap, "critics")
	assert.equal(view.state.anyService, true)
	assert.equal(view.state.onMyServices, false)
	assert.equal(
		schema.safeParse({ any_service: true, on_my_services: true }).success,
		false,
	)
	assert.equal(
		schema.safeParse({ source_scores: { imdb: 101 } }).success,
		false,
	)
	assert.notEqual(discoverViewKey(args), discoverViewKey({}))
})

test("match_all round trips through page_url and separates cache identities", () => {
	const args = schema.parse({
		moods: ["funny", "feelgood"],
		genres: ["Drama", "Comedy"],
		match_all: ["genres", "moods", "styles", "moods"],
	})
	const params = discoverParams(args, false)
	assert.equal(params.get("all"), "moods,genres")
	assert.deepEqual(
		filterStateFromParams(params, { onMyServices: false, notSeenYet: false }),
		discoverView(args, false).state,
	)
	const result = withPageLink(
		"https://goodwatch.app",
		"discover_titles",
		args,
		{},
	)
	assert.equal(
		new URL(String(result.page_url)).searchParams.get("all"),
		"moods,genres",
	)
	assert.notEqual(
		discoverViewKey(args),
		discoverViewKey({ ...args, match_all: undefined }),
	)
	assert.equal(
		discoverViewKey(args),
		discoverViewKey({ ...args, match_all: ["moods", "genres"] }),
	)
	assert.equal(
		discoverViewKey({ moods: ["funny"], match_all: ["moods"] }),
		discoverViewKey({ moods: ["funny"] }),
	)
	assert.deepEqual(filterArgs(args).match_all, args.match_all)
	assert.equal(schema.safeParse({ match_all: ["unknown"] }).success, false)
})

test("MCP mood descriptions publish shared names beside the stable keys", () => {
	for (const [key, name] of [
		["feelgood", "Cozy"],
		["romance", "Romantic"],
		["action", "Thrilling"],
		["heavy", "Sad"],
		["mind", "Trippy"],
	])
		assert.ok(discoverFilters.moods.description?.includes(`${key} = ${name}`))
})

test("list and taste steps validate and round trip through both tools' page URLs", async () => {
	const { readToolDefinitions } = await import("./tools.server.ts")
	for (const name of ["search_titles", "discover_titles"] as const) {
		const toolSchema = readToolDefinitions.find(
			(tool) => tool.name === name,
		)!.schema
		assert.equal(
			toolSchema.safeParse({ seen_only: true, exclude_seen: true }).success,
			false,
		)
		for (const args of [
			{ seen_only: true, wishlist_only: true },
			{ wishlist_only: true, exclude_seen: true },
			{ minimum_match: 60 as const },
			{ outside_usual: true, minimum_match: 90 as const },
		]) {
			assert.ok(toolSchema.safeParse(args).success)
			const result = withPageLink("https://goodwatch.app", name, args, {})
			const params = new URL(String(result.page_url)).searchParams
			assert.deepEqual(
				filterStateFromParams(params, { onMyServices: true, notSeenYet: true }),
				discoverView(args, false).state,
			)
			assert.equal(params.get("seen"), "seen_only" in args ? "1" : null)
			assert.equal(params.get("wishlist"), "wishlist_only" in args ? "1" : null)
			assert.equal(
				params.get("match"),
				"outside_usual" in args
					? "outside"
					: "minimum_match" in args
						? "60"
						: null,
			)
		}
	}
	for (const args of [
		{ seen_only: true },
		{ wishlist_only: true },
		{ outside_usual: true },
		{ minimum_match: 60 as const },
	]) {
		assert.notEqual(discoverViewKey(args), discoverViewKey({}))
		assert.deepEqual(filterArgs(args), args)
	}
	for (const key of ["seen_only", "wishlist_only", "outside_usual"])
		assert.equal(schema.safeParse({ [key]: "true" }).success, false)
})

test("MCP mood enum includes all 16 keys and round trips the five additions", async () => {
	const { MOOD_KEYS } = await import("../../domain/moods.ts")
	assert.deepEqual(discoverFilters.moods.unwrap().element.options, MOOD_KEYS)
	for (const mood of ["tense", "dark", "deep", "magical", "quirky"] as const) {
		assert.ok(schema.safeParse({ moods: [mood] }).success)
		assert.equal(discoverParams({ moods: [mood] }, false).get("moods"), mood)
	}
})

test("MCP Metacritic users share normalized bounds, page URLs and cache identity", () => {
	const args = schema.parse({
		source_scores: { imdb: 65, metacriticUsers: 70 },
	})
	const params = discoverParams(args, false)
	assert.equal(params.get("sources"), "imdb:65,metacriticUsers:70")
	assert.deepEqual(
		filterStateFromParams(params, { onMyServices: false, notSeenYet: false }),
		discoverView(args, false).state,
	)
	assert.notEqual(
		discoverViewKey(args),
		discoverViewKey({ source_scores: { imdb: 65 } }),
	)
	for (const value of [0, 60, 70, 80, 90, 100])
		assert.equal(
			schema.safeParse({ source_scores: { metacriticUsers: value } }).success,
			true,
		)
	for (const value of [-1, 101, 7.5])
		assert.equal(
			schema.safeParse({ source_scores: { metacriticUsers: value } }).success,
			false,
		)
})

test("rating_country is normalized, carried in links, and separates view identities", () => {
	assert.equal(schema.parse({ rating_country: " de " }).rating_country, "DE")
	assert.equal(
		discoverView({ rating_country: "DE" }, false).state.ratingCountry,
		"DE",
	)
	assert.equal(discoverView({}, false).state.ratingCountry, undefined)
	for (const code of ["D", "DEU", "12"])
		assert.equal(schema.safeParse({ rating_country: code }).success, false)
	// Snapshot membership is resolved by the engine; the transport accepts an unknown two-letter code.
	assert.equal(schema.safeParse({ rating_country: "ZZ" }).success, true)
	assert.notEqual(
		discoverViewKey({ rating_country: "DE" }),
		discoverViewKey({ rating_country: "US" }),
	)
	assert.notEqual(
		discoverViewKey({ rating_country: "DE" }),
		discoverViewKey({}),
	)
})

test("episode bounds and Rest of the world validate and travel in page URLs", () => {
	const args = {
		max_runtime: 120,
		min_episode_runtime: 20,
		max_episode_runtime: 35,
		rest_of_world: true,
	}
	assert.equal(schema.safeParse(args).success, true)
	assert.equal(
		schema.safeParse({ min_episode_runtime: 40, max_episode_runtime: 35 })
			.success,
		false,
	)
	for (const value of [-1, 1.5, 10001])
		assert.equal(
			schema.safeParse({ max_episode_runtime: value }).success,
			false,
		)
	const params = discoverParams(args, false)
	assert.equal(params.get("episodeRuntime"), "20-35")
	const page = withPageLink(
		"https://goodwatch.app",
		"discover_titles",
		args,
		{},
	)
	const pageParams = new URL(String(page.page_url)).searchParams
	assert.equal(pageParams.get("episodeRuntime"), "20-35")
	assert.equal(pageParams.get("restOfWorld"), "1")
	assert.equal(params.get("restOfWorld"), "1")
	const state = filterStateFromParams(params, {
		onMyServices: false,
		notSeenYet: false,
	})
	assert.deepEqual(state.episodeRuntime, { min: 20, max: 35 })
	assert.equal(state.restOfWorld, true)
	assert.notEqual(
		discoverViewKey(args),
		discoverViewKey({ ...args, max_episode_runtime: 45 }),
	)
	assert.notEqual(
		discoverViewKey(args),
		discoverViewKey({ ...args, rest_of_world: false }),
	)
	assert.equal(
		discoverView({ max_runtime: 120 }, false).state.episodeRuntime,
		undefined,
	)
})

test("popularity MCP ranges validate and reach page_url through the shared codec", () => {
	const args = {
		min_votes: 10000,
		max_votes: 100000,
		min_popularity_rank: 1,
		max_popularity_rank: 1000,
	}
	assert.ok(schema.safeParse(args).success)
	const view = discoverView(args, false)
	assert.deepEqual(view.state.votes, { min: 10000, max: 100000 })
	assert.deepEqual(view.state.popularityRank, { min: 1, max: 1000 })
	const page = withPageLink(
		"https://goodwatch.app",
		"discover_titles",
		args,
		{},
	)
	const params = new URL(page.page_url as string).searchParams
	assert.equal(params.get("votes"), "10000-100000")
	assert.equal(params.get("rank"), "1-1000")
	assert.deepEqual(filterArgs(args), args)
	assert.notEqual(
		discoverViewKey(args),
		discoverViewKey({ ...args, max_votes: 99999 }),
	)
	for (const invalid of [
		{ min_votes: 10, max_votes: 9 },
		{ min_popularity_rank: 10, max_popularity_rank: 9 },
		{ min_votes: -1 },
		{ max_popularity_rank: 0 },
		{ min_votes: 1.5 },
	])
		assert.equal(schema.safeParse(invalid).success, false)
})
