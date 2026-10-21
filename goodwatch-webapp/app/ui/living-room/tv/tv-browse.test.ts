import assert from "node:assert/strict"
import { test } from "node:test"
import {
	BROWSE_OPTIONS,
	KEY_ITEMS,
	KEY_ROWS,
	browseIdentity,
	bestMatchActive,
	pageInfo,
} from "./tv-browse.ts"
import {
	EMPTY_CONTEXT,
	readTvState,
	writeTvParams,
	transition,
	tvItems,
	focusedItem,
	destinationHref,
	searchIdeas,
} from "./tv-machine.ts"
import { tvSearchFilters, tvSearchKey, tvSearchBody } from "./tv-search.ts"
const ctx = {
	...EMPTY_CONTEXT,
	member: true,
	services: [8],
	browseReady: true,
	browseNext: true,
	browseTaste: true,
	titles: Array.from({ length: 40 }, (_, i) => `movie-${i + 1}`),
}
const at = (q: string) => readTvState(new URLSearchParams(q), ctx)
const choose = (q: string, item: string) =>
	transition(at(q), { type: "choose", item }, ctx)
for (const [screen, plain] of [
	["tv=discover&all=1", "popular"],
	["tv=search&q=2001", "relevance"],
]) {
	test(`${screen}: Best match preserves an Off preference but displays On, and Off leaves taste ordering`, () => {
		// Search cycles through Relevance between Newest and Best match.
		let entered = choose(
			`${screen}&filters=1&sort=newest&foryou=0&page=2`,
			"filter:sort",
		).state
		if (plain === "relevance")
			entered = transition(
				entered,
				{ type: "choose", item: "filter:sort" },
				ctx,
			).state
		const params = writeTvParams(entered.screen)
		assert.equal(params.get("sort"), "match")
		assert.equal(params.get("foryou"), "0")
		assert.equal(params.has("page"), false)
		assert.equal(bestMatchActive(params, undefined, true), true)
		// Choosing a plain sort directly restores the underlying Off preference.
		const nextSort = transition(
			entered,
			{ type: "choose", item: "filter:sort" },
			ctx,
		).state
		assert.equal(writeTvParams(nextSort.screen).get("foryou"), "0")
		assert.equal(writeTvParams(nextSort.screen).get("sort"), "popular")
		for (const preference of ["0", "1"]) {
			const deep = at(`${screen}&filters=1&sort=match&foryou=${preference}`)
			assert.equal(
				bestMatchActive(writeTvParams(deep.screen), undefined, true),
				true,
			)
			const off = transition(
				deep,
				{ type: "choose", item: "filter:foryou" },
				ctx,
			).state
			assert.equal(writeTvParams(off.screen).get("sort"), plain)
			assert.equal(writeTvParams(off.screen).get("foryou"), "0")
			assert.equal(off.focus, "filter:foryou")
			const done = transition(
				off,
				{ type: "choose", item: "browse:done" },
				ctx,
			).state
			assert.equal(done.focus, "browse:filters")
			assert.equal(writeTvParams(done.screen).get("sort"), plain)
		}
	})
}
test("Malformed URL state is bounded and old Discover links remain compatible", () => {
	for (const page of ["0", "-1", "1.5", "NaN", "Infinity", "abc", "0x10", " 2"])
		assert.equal(
			(
				at(`tv=discover&mood=funny&page=${encodeURIComponent(page)}`)
					.screen as any
			).page,
			undefined,
		)
	assert.equal(
		(at("tv=discover&mood=funny&page=99999").screen as any).page,
		250,
	)
	const s = at(
		"tv=search&q=2001&type=evil&sort=bad&services=bad&unseen=.5&moods=unknown&foryou=2",
	).screen
	assert.equal((s as any).browse, undefined)
	assert.equal(
		destinationHref(at("tv=discover&mood=funny").screen, ctx),
		"/discover?moods=funny",
	)
	assert.equal((at("tv=search&q=x").screen as any).query, null)
	assert.equal(
		(at(`tv=search&q=${"a".repeat(600)}`).screen as any).query.length,
		512,
	)
})
test("Filter changes reset page, use real parameter values, and Close returns to Filters", () => {
	for (const key of Object.keys(BROWSE_OPTIONS)) {
		const t = choose("tv=search&q=2001&page=3&filters=1", `filter:${key}`)
		const p = writeTvParams(t.state.screen)
		assert.equal(p.get("page"), null)
		assert.ok(p.has(key))
		assert.equal(t.state.focus, `filter:${key}`)
	}
	const t = choose(
		"tv=discover&mood=funny&filters=1&type=movie&sort=top",
		"browse:done",
	)
	assert.equal(t.state.focus, "browse:filters")
	assert.equal(writeTvParams(t.state.screen).has("filters"), false)
	assert.match(destinationHref(t.state.screen, ctx)!, /type=movie/)
	assert.equal(
		transition(at("tv=discover&all=1&filters=1"), { type: "back" }, ctx).state
			.focus,
		"browse:filters",
	)
})
test("Paging uses server totals, exposes all 40 cards, and hides Next until current results arrive", () => {
	assert.deepEqual(pageInfo({ total: 81, page: 2, pageSize: 40 }), {
		total: 81,
		pages: 3,
		next: true,
	})
	assert.equal(pageInfo({ total: 81, page: 3, pageSize: 40 }).next, false)
	const s = at("tv=search&q=2001&page=2").screen
	const items = tvItems(s, ctx)
	assert.equal(items.filter((k) => k.startsWith("title:")).length, 40)
	assert.ok(items.includes("browse:prev") && items.includes("browse:next"))
	assert.ok(!tvItems(s, { ...ctx, browseReady: false }).includes("browse:next"))
	assert.ok(!tvItems(s, { ...ctx, browseNext: false }).includes("browse:next"))
	assert.equal(
		writeTvParams(
			choose("tv=search&q=2001&page=2", "browse:next").state.screen,
		).get("page"),
		"3",
	)
})
test("Title and filter navigation keep the full result identity and Expand context", () => {
	const q =
		"tv=discover&mood=funny&type=movie&services=all&unseen=1&sort=newest&foryou=0&page=2"
	const s = at(q).screen
	assert.deepEqual(at(writeTvParams(s).toString()).screen, s)
	assert.match(
		destinationHref(s, ctx)!,
		/moods=funny&type=movie&services=all&unseen=1&sort=newest&foryou=0&page=2/,
	)
	assert.equal(choose(q, "title:movie-2").history, "push")
	assert.notEqual(
		browseIdentity(s),
		browseIdentity(at(q.replace("page=2", "page=3")).screen),
	)
	assert.equal(
		choose("tv=search&q=2001&type=show&page=2", "browse:edit").state.screen
			.name,
		"search",
	)
})
test("Search eligibility narrows ranking only for supported type/services; mood and sort do not rerank", () => {
	const scope = { country: "DE", services: [8, 337] }
	const filters = tvSearchFilters(
		scope,
		"type=movie&services=all&moods=funny&sort=top",
	)
	assert.deepEqual(filters, { type: "movie" })
	assert.deepEqual(tvSearchBody("2001", filters), {
		q: "2001",
		filters: { type: "movie" },
		allTitles: false,
		discover: true,
	})
	assert.deepEqual(tvSearchFilters(scope, "type=show"), {
		type: "show",
		streaming: { country: "DE", providerIds: [8, 337] },
	})
	assert.deepEqual(
		tvSearchKey("2001", tvSearchFilters(scope, "moods=funny")),
		tvSearchKey("2001", tvSearchFilters(scope, "sort=top")),
	)
})
test("Recovered QWERTY rows include digits, editing controls and explicit Search", () => {
	assert.deepEqual(KEY_ROWS.slice(0, 3), ["qwertyuiop", "asdfghjkl", "zxcvbnm"])
	const s = at("tv=search")
	assert.deepEqual(tvItems(s.screen, ctx), [
		...searchIdeas(),
		...KEY_ITEMS,
		"nav:home",
		"nav:tonight",
		"nav:discover",
		"nav:search",
		"nav:quiz",
		"bar:menu",
	])
	for (const key of [..."qz09", "delete", "space", "clear"])
		assert.deepEqual(choose("tv=search", `key:${key}`).effects, [
			{ type: "draft-key", key },
		])
	assert.equal(
		transition(s, { type: "submit-search", query: " " }, ctx).history,
		"none",
	)
	assert.equal(
		transition(s, { type: "submit-search", query: "2001" }, ctx).history,
		"replace",
	)
})
test("Remote Down follows scrollable keyboard rows, not the fixed footer, and edges are bounded", () => {
	const state = { ...at("tv=search"), focus: "key:q" }
	const boxes = [
		{ id: "key:q", left: 0, top: 0, width: 44, height: 44 },
		{ id: "key:y", left: 0, top: 50, width: 44, height: 44 },
		{ id: "go", left: 0, top: 45, width: 44, height: 44 },
	]
	const t = transition(state, { type: "move", dir: "down", boxes }, ctx)
	assert.equal(focusedItem(t.state, ctx), "key:y")
	assert.equal(
		focusedItem(
			transition(state, { type: "move", dir: "left", boxes }, ctx).state,
			ctx,
		),
		"key:q",
	)
})
test("Up from the keys reaches the ideas under the line, then the navigation; Down comes back", () => {
	const box = (id: string, left: number, top: number) => ({
		id,
		left,
		top,
		width: 44,
		height: 44,
	})
	const ideas = searchIdeas()
	const boxes = [
		box("nav:home", 0, 0),
		box("nav:search", 300, 0),
		box("bar:menu", 600, 0),
		...ideas.map((id, n) => box(id, n * 160, 80)),
		...[..."qwertyuiop"].map((c, n) => box(`key:${c}`, n * 64, 160)),
		...[..."asdfghjkl"].map((c, n) => box(`key:${c}`, n * 64, 220)),
	]
	const move = (focus: string, dir: "up" | "down" | "left" | "right") =>
		focusedItem(
			transition(
				{ ...at("tv=search"), focus },
				{ type: "move", dir, boxes },
				ctx,
			).state,
			ctx,
		)
	assert.equal(move("key:q", "up"), ideas[0])
	assert.equal(move("key:p", "up"), ideas[3])
	assert.equal(move(ideas[0], "up"), "nav:home")
	assert.equal(move(ideas[3], "up"), "bar:menu")
	// Down from an idea: the key under its middle.
	assert.equal(move(ideas[0], "down"), "key:w")
	assert.equal(move("nav:home", "down"), ideas[0])
	assert.equal(move(ideas[1], "right"), ideas[2])
	assert.equal(move(ideas[0], "left"), ideas[0])
})
