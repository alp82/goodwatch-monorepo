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
test("member home is Start: Watch next first, the other screens, then the navigation", () => {
	assert.equal(focusedItem(home, member), "start:tonight")
	assert.deepEqual(tvItems(home.screen, member), [
		"start:tonight",
		"start:popular",
		"start:discover",
		"start:search",
		"start:quiz",
		"start:taste",
		"start:shows",
		"start:about",
		"nav:home",
		"nav:tonight",
		"nav:popular",
		"nav:discover",
		"nav:search",
		"nav:quiz",
		"bar:menu",
	])
	const opened = transition(home, { type: "ok" }, member)
	assert.deepEqual(opened.state.screen, { name: "tonight", pick: 0 })
	assert.equal(opened.history, "push")
	assert.deepEqual(opened.effects, [])
	assert.equal(
		transition(opened.state, { type: "back" }, member).history,
		"back",
	)
})
test("Popular opens the wall; My shows its screen; nothing on Start writes watch state", () => {
	const popular = transition(
		home,
		{ type: "choose", item: "start:popular" },
		member,
	)
	assert.deepEqual(popular.state.screen, { name: "popular", pick: 0 })
	assert.deepEqual(popular.effects, [])
	// The wall's poster opens its title.
	assert.deepEqual(
		transition(popular.state, { type: "choose", item: "pick:1" }, member).state
			.screen,
		{ name: "title", title: "movie-2" },
	)
	const shows = transition(home, { type: "choose", item: "start:shows" }, member)
	assert.deepEqual(shows.state.screen, { name: "shows" })
	assert.deepEqual(shows.effects, [])
	// The old home's keys are gone.
	for (const item of ["home:next", "home:movies", "app:shows", "title:movie-2"])
		assert.equal(
			transition(home, { type: "choose", item }, member).history,
			"none",
			item,
		)
})
test("empty members keep Start without Popular, and guests retain their app/service home", () => {
	const empty = { ...member, tonight: [], popular: [] }
	assert.equal(focusedItem(home, empty), "start:tonight")
	const items = tvItems(home.screen, empty)
	assert.ok(!items.includes("start:popular"))
	assert.ok(!items.includes("nav:popular"))
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
