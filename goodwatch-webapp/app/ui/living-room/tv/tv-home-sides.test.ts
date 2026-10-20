// The former home guide is intentionally absent. Existing taste payloads cannot bring it back.
import assert from "node:assert/strict"
import { test } from "node:test"
import {
	EMPTY_CONTEXT,
	readTvState,
	focusedItem,
	tvItems,
	transition,
	menuItems,
} from "./tv-machine.ts"
const member = {
	...EMPTY_CONTEXT,
	member: true,
	tonight: [{ title: "show-10", href: "/my-shows" }],
	popular: ["movie-1", "movie-2"],
	services: [8],
	homeSides: [{ id: "old", picks: ["movie-99"], watchNext: "/watch-next" }],
}
const home = readTvState(new URLSearchParams(), member)
test("member home leads with the existing Next pick, then library navigation and popular titles", () => {
	assert.equal(focusedItem(home, member), "home:next")
	assert.deepEqual(tvItems(home.screen, member), [
		"home:next",
		"home:movies",
		"app:shows",
		"app:tonight",
		"app:discover",
		"app:taste",
		"title:movie-1",
		"title:movie-2",
		"bar:search",
		"bar:menu",
	])
	const opened = transition(home, { type: "ok" }, member)
	assert.deepEqual(opened.state.screen, { name: "title", title: "show-10" })
	assert.equal(opened.history, "push")
	assert.deepEqual(opened.effects, [])
	assert.equal(
		transition(opened.state, { type: "back" }, member).history,
		"back",
	)
})
test("popular opens details; My movies leaves for its existing page without writing watch state", () => {
	assert.deepEqual(
		transition(home, { type: "choose", item: "title:movie-2" }, member).state
			.screen,
		{ name: "title", title: "movie-2" },
	)
	assert.deepEqual(
		transition(home, { type: "choose", item: "home:movies" }, member).effects,
		[{ type: "expand", href: "/my-movies" }],
	)
	assert.deepEqual(
		transition(home, { type: "choose", item: "app:shows" }, member).state
			.screen,
		{ name: "shows" },
	)
})
test("empty members retain useful navigation and guests retain their app/service home", () => {
	const empty = { ...member, tonight: [], popular: [] }
	assert.equal(focusedItem(home, empty), "home:movies")
	assert.deepEqual(tvItems(home.screen, { ...EMPTY_CONTEXT, services: [8] }), [
		"app:tonight",
		"app:discover",
		"app:taste",
		"service:8",
		"bar:search",
		"bar:menu",
	])
})
test("no TV home/menu offers Explorer or taste-group entries; bookmarks still open Explorer", () => {
	for (const ctx of [EMPTY_CONTEXT, member]) {
		assert.ok(
			![...tvItems(home.screen, ctx), ...menuItems(ctx)].some((id) =>
				/explorer|home-side|watch-next:/.test(id),
			),
		)
	}
	assert.deepEqual(
		readTvState(new URLSearchParams("tv=explorer&island=crime"), member).screen,
		{ name: "explorer", island: "crime" },
	)
	assert.equal(
		transition(home, { type: "choose", item: "app:explorer" }, member).history,
		"none",
	)
})
