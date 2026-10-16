// Home as a guide for a member with Sides of you (#673): its items, the moves the machine names itself (the list
// walked in order, Right into a side, Left back to it, Down to Watch next), and what OK does on it.
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
	EMPTY_CONTEXT,
	HOME_SIDE_PICKS,
	type TvAction,
	type TvContext,
	type TvState,
	focusedItem,
	guideSideOf,
	transition,
	tvItems,
} from "./tv-machine.ts"
import type { TvBox } from "./tv-move.ts"

const HOME = { name: "home" } as const
const APPS = [
	"app:tonight",
	"app:discover",
	"app:explorer",
	"app:taste",
	"app:shows",
]
const picks = (side: string, n: number) =>
	Array.from({ length: n }, (_, at) => `movie-${side}${at + 1}`)

const member: TvContext = {
	...EMPTY_CONTEXT,
	member: true,
	services: [8, 337],
	homeSides: [
		{ id: "a", picks: picks("1", 3), watchNext: "/watch-next?moods=dark" },
		{ id: "b", picks: picks("2", 2), watchNext: "/watch-next" },
		{ id: "c", picks: [], watchNext: "/watch-next?moods=funny,feelgood" },
	],
}

const stateOf = (focus: string | null): TvState => ({
	screen: HOME,
	focus,
	power: "on",
	menuOpen: false,
	menuFocus: null,
	depth: 0,
})

/** A move with no boxes: the machine's own named moves need none, the direction rule finds nothing. */
const move = (dir: "up" | "down" | "left" | "right", boxes: TvBox[] = []) =>
	({ type: "move", dir, boxes }) as const satisfies TvAction

function pressFrom(focus: string, action: TvAction, ctx = member) {
	const t = transition(stateOf(focus), action, ctx)
	return { focus: focusedItem(t.state, ctx), t }
}

describe("home's items with sides", () => {
	it("are the apps, then each side's entry, its picks and its Watch next key; no service tiles", () => {
		assert.deepEqual(tvItems(HOME, member), [
			...APPS,
			"home-side:a",
			"title:movie-11",
			"title:movie-12",
			"title:movie-13",
			"watch-next:a",
			"home-side:b",
			"title:movie-21",
			"title:movie-22",
			"watch-next:b",
			"home-side:c",
			"watch-next:c",
			"bar:search",
			"bar:menu",
		])
	})

	it("stay today's row without sides: the apps, then the services", () => {
		assert.deepEqual(tvItems(HOME, { ...member, homeSides: [] }), [
			...APPS,
			"service:8",
			"service:337",
			"bar:search",
			"bar:menu",
		])
	})

	it("hold a side's first picks only", () => {
		const many = {
			...member,
			homeSides: [{ id: "a", picks: picks("9", 20), watchNext: "/watch-next" }],
		}
		const titles = tvItems(HOME, many).filter((item) =>
			item.startsWith("title:"),
		)
		assert.equal(titles.length, HOME_SIDE_PICKS)
	})

	it("start on the first app", () => {
		assert.equal(focusedItem(stateOf(null), member), "app:tonight")
	})

	it("know which side an item is of", () => {
		assert.equal(guideSideOf("home-side:b", member)?.id, "b")
		assert.equal(guideSideOf("title:movie-22", member)?.id, "b")
		assert.equal(guideSideOf("watch-next:c", member)?.id, "c")
		assert.equal(guideSideOf("app:taste", member), null)
		assert.equal(guideSideOf("title:movie-99", member), null)
	})
})

describe("moving on home's guide", () => {
	it("Up and Down walk the list in order, from the apps into the sides and back", () => {
		assert.equal(pressFrom("app:shows", move("down")).focus, "home-side:a")
		assert.equal(pressFrom("home-side:a", move("down")).focus, "home-side:b")
		assert.equal(pressFrom("home-side:b", move("up")).focus, "home-side:a")
		assert.equal(pressFrom("home-side:a", move("up")).focus, "app:shows")
		assert.equal(pressFrom("app:discover", move("up")).focus, "app:tonight")
	})

	it("Down from the last entry stays", () => {
		const t = pressFrom("home-side:c", move("down"))
		assert.equal(t.focus, "home-side:c")
		assert.equal(t.t.history, "none")
	})

	it("Up from the first app is the direction rule's: the top bar", () => {
		const boxes: TvBox[] = [
			{ id: "app:tonight", left: 40, top: 120, width: 330, height: 56 },
			{ id: "bar:search", left: 1000, top: 20, width: 60, height: 60 },
		]
		assert.equal(
			pressFrom("app:tonight", move("up", boxes)).focus,
			"bar:search",
		)
	})

	it("Right steps into a side: its first pick, or Watch next when it has none", () => {
		assert.equal(
			pressFrom("home-side:a", move("right")).focus,
			"title:movie-11",
		)
		assert.equal(pressFrom("home-side:c", move("right")).focus, "watch-next:c")
	})

	it("Right and Left on an app, and Left on a side's entry, stay", () => {
		assert.equal(pressFrom("app:taste", move("right")).focus, "app:taste")
		assert.equal(pressFrom("app:taste", move("left")).focus, "app:taste")
		assert.equal(pressFrom("home-side:b", move("left")).focus, "home-side:b")
	})

	it("Left from the first pick comes back to the side's entry; along the picks the rule decides", () => {
		assert.equal(pressFrom("title:movie-11", move("left")).focus, "home-side:a")
		const row: TvBox[] = picks("1", 3).map((key, at) => ({
			id: `title:${key}`,
			left: 420 + at * 130,
			top: 400,
			width: 110,
			height: 165,
		}))
		assert.equal(
			pressFrom("title:movie-12", move("left", row)).focus,
			"title:movie-11",
		)
		assert.equal(
			pressFrom("title:movie-12", move("right", row)).focus,
			"title:movie-13",
		)
	})

	it("Down from a pick goes to Watch next; Up from Watch next to the first pick, Left to the entry", () => {
		assert.equal(
			pressFrom("title:movie-13", move("down")).focus,
			"watch-next:a",
		)
		assert.equal(pressFrom("watch-next:a", move("up")).focus, "title:movie-11")
		assert.equal(pressFrom("watch-next:a", move("left")).focus, "home-side:a")
		assert.equal(pressFrom("watch-next:c", move("up")).focus, "home-side:c")
		assert.equal(pressFrom("watch-next:a", move("down")).focus, "watch-next:a")
	})

	it("the wheel's step walks from a side's entry into its picks", () => {
		const t = pressFrom("home-side:b", { type: "step", by: 1 })
		assert.equal(t.focus, "title:movie-21")
	})

	it("names no moves without sides: the row's moves are the rule's", () => {
		const row = { ...member, homeSides: [] }
		assert.equal(pressFrom("app:shows", move("down"), row).focus, "app:shows")
	})
})

describe("choosing on home's guide", () => {
	it("OK on a side's entry steps into it, without leaving home", () => {
		const t = pressFrom("home-side:a", { type: "ok" })
		assert.equal(t.focus, "title:movie-11")
		assert.equal(t.t.history, "none")
		assert.deepEqual(t.t.effects, [])
	})

	it("OK on a pick opens its title screen", () => {
		const t = pressFrom("title:movie-21", { type: "ok" })
		assert.deepEqual(t.t.state.screen, { name: "title", title: "movie-21" })
		assert.equal(t.t.history, "push")
	})

	it("OK on Watch next opens Watch next with the side's moods", () => {
		const t = pressFrom("watch-next:c", { type: "ok" })
		assert.deepEqual(t.t.effects, [
			{ type: "expand", href: "/watch-next?moods=funny,feelgood" },
		])
		assert.equal(t.t.history, "none")
	})

	it("a pointer's press on a side's entry does the same as OK", () => {
		const t = pressFrom("app:tonight", { type: "choose", item: "home-side:b" })
		assert.equal(t.focus, "title:movie-21")
	})
})
