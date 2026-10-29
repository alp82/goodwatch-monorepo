// The "Go deeper" doors (doors.ts): their order, the open door, and the empty and sparse states, for full, sparse and
// empty members; and the grid that always fills whole rows.
import assert from "node:assert/strict"
import { test } from "node:test"
import "../../../server/title-filter/test-alias.ts"

const {
	GRID_COLUMNS,
	cellsOf,
	doorsOf,
	filtersOf,
	gridPlan,
	openDoorOf,
	orderDoors,
	reserveOf,
	tileText,
} = await import("./doors.ts")
const { FEW, FULL, NEW, NO_SHOWS, NO_WISHLIST } = await import(
	"./member-fixtures.test-support.ts"
)

const order = (data: typeof FULL) => orderDoors(doorsOf(data)).map((d) => d.key)
const door = (data: typeof FULL, key: string) =>
	(() => {
		const found = doorsOf(data).find((d) => d.key === key)
		assert.ok(found, key)
		return found
	})()

test("full: the usual order, Continue watching open, no strips", () => {
	assert.deepEqual(order(FULL), ["continue", "wishlist", "forYou", "hot"])
	for (const d of doorsOf(FULL)) assert.equal(d.strip, null, d.key)
	assert.equal(door(FULL, "continue").line, "14 shows")
	assert.equal(door(FULL, "wishlist").line, "40 movies")
	assert.equal(door(FULL, "forYou").line, "Your taste")
	assert.equal(door(FULL, "hot").line, "Top 12 right now")
})

test("few: every door has titles; For you says it is forming, with the ratings so far and the ways to more", () => {
	assert.deepEqual(order(FEW), ["continue", "wishlist", "forYou", "hot"])
	const forYou = door(FEW, "forYou")
	assert.equal(forYou.line, "4 of 10 ratings")
	assert.equal(forYou.strip?.title, "Picks get personal at 10 ratings")
	assert.equal(forYou.strip?.progress, 4)
	assert.deepEqual(
		forYou.strip?.ctas.map((c) => c.href),
		["/taste", "/settings/imports"],
	)
	assert.equal(door(FEW, "continue").line, "1 show")
	assert.equal(door(FEW, "continue").strip, null)
})

test("no shows: Continue watching moves last, the Wishlist opens, and Continue says how to start", () => {
	assert.deepEqual(order(NO_SHOWS), ["wishlist", "forYou", "hot", "continue"])
	const shows = door(NO_SHOWS, "continue")
	assert.equal(shows.line, "No shows yet")
	assert.equal(shows.strip?.title, "No shows yet")
	assert.deepEqual(
		shows.strip?.ctas.map((c) => c.href),
		["/discover?type=show", "/settings/imports"],
	)
})

test("no wishlist: the Wishlist moves after the doors with titles and says how to fill it", () => {
	assert.deepEqual(order(NO_WISHLIST), [
		"continue",
		"forYou",
		"hot",
		"wishlist",
	])
	assert.equal(door(NO_WISHLIST, "wishlist").line, "Nothing saved yet")
	assert.equal(
		door(NO_WISHLIST, "wishlist").strip?.title,
		"Your Wishlist is empty",
	)
})

test("new: only Hot on socials has titles and opens first; For you needs ratings", () => {
	assert.deepEqual(order(NEW), ["hot", "continue", "wishlist", "forYou"])
	const forYou = door(NEW, "forYou")
	assert.equal(forYou.line, "Needs ratings")
	assert.equal(forYou.strip?.progress, 0)
	// Without Hot on socials the first door, Continue watching, opens on its empty state.
	assert.deepEqual(order({ ...NEW, hotOn: false, hot: null }), [
		"continue",
		"wishlist",
		"forYou",
	])
})

test("lists on their way keep their place: the order and the open door don't change when they arrive", () => {
	for (const member of [FULL, FEW, NO_SHOWS, NO_WISHLIST]) {
		const { forYou: _f, hot: _h, ...waiting } = member
		assert.deepEqual(order(waiting), order(member))
		assert.equal(openDoorOf(waiting), openDoorOf(member))
		assert.ok(door(waiting, "forYou").pending)
		assert.ok(door(waiting, "hot").pending)
		assert.ok(!door(member, "forYou").pending)
	}
	// On its way, a door has no error strip; For you still says it is forming, Hot on socials waits quietly.
	const { forYou: _f, hot: _h, ...few } = FEW
	assert.equal(
		door(few, "forYou").strip?.title,
		"Picks get personal at 10 ratings",
	)
	assert.equal(door(few, "hot").strip, null)
	assert.equal(door(few, "hot").line, "Right now")
	// With nothing on the own lists, a list on its way would open first: the server waits for that one.
	const { hot: _, ...fresh } = NEW
	assert.equal(openDoorOf(fresh), "hot")
	const { forYou: __, ...rated } = { ...NEW, ratings: 4 }
	assert.equal(openDoorOf(rated), "forYou")
})

test("Hot on socials has no door while the member doesn't see it", () => {
	assert.ok(!doorsOf({ ...FULL, hotOn: false }).some((d) => d.key === "hot"))
})

test("a list that couldn't be read says so instead of an empty state", () => {
	const d = door({ ...FULL, wishlist: null }, "wishlist")
	assert.equal(d.strip?.title, "Couldn't load this right now")
	assert.equal(d.titles.length, 0)
})

test("filters show only on a full grid", () => {
	assert.ok(filtersOf(door(FULL, "wishlist")))
	assert.equal(filtersOf(door(FEW, "wishlist")), null)
	assert.equal(filtersOf(door(FULL, "continue")), null)
})

test("the grid fills whole rows at every width, for every count", () => {
	for (const ghost of [true, false])
		for (const columns of GRID_COLUMNS)
			for (let n = 0; n <= 14; n++) {
				const plan = gridPlan(n, columns, ghost)
				const cells = cellsOf(plan)
				// An empty section has no grid (its strip says it all); every other grid ends on a full row.
				if (n === 0) assert.equal(cells, 0)
				else
					assert.equal(cells % columns, 0, `${n} at ${columns}, ghost ${ghost}`)
				assert.ok(plan.posters <= n)
				assert.ok(plan.posters <= 11)
				if (n > 0) assert.ok(plan.tile)
				// Ghosts ask for more, so only a whole list has them; blanks only close a row of few posters.
				if (!ghost) assert.equal(plan.ghosts, 0)
				if (ghost) assert.equal(plan.blanks, 0)
			}
})

test("the grid: a short list shows every poster, ghosts to the row's end, and the tile", () => {
	const plan = (posters: number, ghosts = 0, blanks = 0) => ({
		posters,
		ghosts,
		blanks,
		tile: true,
	})
	assert.deepEqual(gridPlan(2, 3, true), plan(2))
	assert.deepEqual(gridPlan(1, 6, true), plan(1, 4))
	// Seven under six across: a row of mostly ghosts would read as missing titles, so five posters and the tile.
	assert.deepEqual(gridPlan(7, 6, true), plan(5))
	// Hot on socials has no ghost: whole rows of posters with the tile.
	assert.deepEqual(gridPlan(7, 6, false), plan(5))
	assert.deepEqual(gridPlan(12, 4, false), plan(11))
	// One hot title (or one left by a filter) at six across: the poster, four blanks, the tile.
	assert.deepEqual(gridPlan(1, 6, false), plan(1, 0, 4))
	assert.deepEqual(gridPlan(1, 3, false), plan(1, 0, 1))
})

test("the end tile counts only what it can promise", () => {
	assert.deepEqual(tileText(door(FULL, "wishlist"), 11), {
		top: "See all 40",
		sub: "in My movies",
	})
	assert.deepEqual(tileText(door(FEW, "wishlist"), 2), {
		top: "Open",
		sub: "My movies",
	})
	assert.deepEqual(tileText(door(FULL, "forYou"), 11), {
		top: "More",
		sub: "in For you",
	})
	assert.deepEqual(tileText(door(FULL, "hot"), 11), {
		top: "See all",
		sub: "on Hot on socials",
	})
})

test("a list that comes later reserves its waiting strip, the chips' row it can have, and the lines under posters", () => {
	// The reserve is the list's waiting shape, whatever has arrived since.
	assert.deepEqual(reserveOf(FULL, "forYou"), {
		strip: null,
		filters: true,
		lines: false,
	})
	assert.deepEqual(reserveOf(FULL, "hot"), {
		strip: null,
		filters: false,
		lines: true,
	})
	assert.equal(
		reserveOf(FEW, "forYou")?.strip?.title,
		"Picks get personal at 10 ratings",
	)
	// The member's own lists are always in the page.
	assert.equal(reserveOf(FULL, "continue"), null)
	assert.equal(reserveOf(FULL, "wishlist"), null)
	assert.equal(reserveOf({ ...FULL, hotOn: false }, "hot"), null)
})
