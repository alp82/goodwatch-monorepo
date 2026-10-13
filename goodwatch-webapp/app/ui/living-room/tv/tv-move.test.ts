// The direction rule on the Cinema screens' own layouts. The boxes are in TV canvas pixels (1200 x 648 on the
// desktop, 500 x 417 on the phone), worked out from the approved prototype's layout numbers
// (`prototype-tv-design/cinema.tsx` on the prototype branch); the widths of keys with a word on them are rounded.
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { type TvBox, type TvDir, nextInDirection } from "./tv-move.ts"

const box = (
	id: string,
	left: number,
	top: number,
	width: number,
	height: number,
): TvBox => ({ id, left, top, width, height })

/** The top bar: three keys 64 tall, ending 56 from the picture's right edge. Home has no Back. */
const BAR = [
	box("bar:back", 674, 22, 136, 64),
	box("bar:search", 820, 22, 164, 64),
	box("bar:menu", 994, 22, 150, 64),
]
/** The Expand key in the picture's bottom right corner. */
const EXPAND = box("expand", 946, 544, 198, 64)

/** Home: a member's five app tiles, 200 x 128 with 22 between, in one row at the bottom. */
const HOME = [
	...["tonight", "discover", "explorer", "taste", "shows"].map((app, n) =>
		box(`app:${app}`, 56 + n * 222, 472, 200, 128),
	),
	...BAR.slice(1),
]

/**
 * Discover's twelve moods: three columns, four rows of 158 with 24 between, the first at 178. Two rows fit above
 * the Expand key; `scrolled` is how far the grid has paged up to show the focused row.
 */
const moods = (scrolled = 0) => [
	...Array.from({ length: 12 }, (_, n) =>
		box(
			`mood:${n + 1}`,
			56 + (n % 3) * (1040 / 3 + 24),
			178 + Math.floor(n / 3) * 182 - scrolled,
			1040 / 3,
			158,
		),
	),
	EXPAND,
	...BAR,
]

/** The mini Explorer: six round islands of 164, placed freely on the sea. */
const MAP = [
	box("island:heists", 66, 108, 164, 164),
	box("island:whodunits", 356, 164, 164, 164),
	box("island:found-family", 656, 108, 164, 164),
	box("island:workplace", 196, 348, 164, 164),
	box("island:time-loops", 526, 378, 164, 164),
	box("island:space", 956, 218, 164, 164),
	EXPAND,
	...BAR,
]

/** An island: four posters of 172 x 258 in a row, and "Sail to" with two keys in a column at the right. */
const LIST = [
	...[1, 2, 3, 4].map((n) =>
		box(`title:movie-${n}`, 56 + (n - 1) * 196, 242, 172, 258),
	),
	box("hop:a", 930, 352, 214, 68),
	box("hop:b", 930, 432, 214, 68),
	EXPAND,
	...BAR,
]

/** A title: its three actions in a row at the bottom, 74 tall, with the Expand key at the row's right end. */
const TITLE = [
	box("watch", 56, 534, 292, 74),
	box("want-to-see", 364, 534, 232, 74),
	box("seen", 612, 534, 167, 74),
	EXPAND,
	...BAR,
]

/** The phone's home: tiles of 172 x 110; the third is cut off at the picture's edge (500) and the row pages. */
const PHONE_HOME = [
	...["tonight", "discover", "explorer", "taste"].map((app, n) =>
		box(`app:${app}`, 20 + n * 186, 287, 172, 110),
	),
	box("bar:search", 364, 12, 54, 54),
	box("bar:menu", 426, 12, 54, 54),
]

/** The phone's title: the actions in a column on the left, the Expand key beside the last one. */
const PHONE_TITLE = [
	box("watch", 20, 225, 292, 52),
	box("want-to-see", 20, 285, 292, 52),
	box("seen", 20, 345, 292, 52),
	box("expand", 330, 343, 150, 54),
	box("bar:back", 302, 12, 54, 54),
	box("bar:search", 364, 12, 54, 54),
	box("bar:menu", 426, 12, 54, 54),
]

/** Presses the directions one after another and returns where the focus is after each. */
function walk(boxes: readonly TvBox[], from: string, ...dirs: TvDir[]) {
	let at = from
	return dirs.map((dir) => {
		at = nextInDirection(boxes, at, dir) ?? at
		return at
	})
}

describe("Left and Right stay in the row", () => {
	it("walks home's apps and stops at both ends", () => {
		assert.deepEqual(
			walk(HOME, "app:tonight", "right", "right", "right", "right", "right"),
			["app:discover", "app:explorer", "app:taste", "app:shows", "app:shows"],
		)
		assert.equal(nextInDirection(HOME, "app:tonight", "left"), null)
	})

	it("walks the bar, which is a row of its own", () => {
		assert.deepEqual(walk(TITLE, "bar:back", "right", "right", "right"), [
			"bar:search",
			"bar:menu",
			"bar:menu",
		])
	})

	it("ends on the Expand key along a title's actions, and comes back", () => {
		assert.deepEqual(walk(TITLE, "watch", "right", "right", "right", "left"), [
			"want-to-see",
			"seen",
			"expand",
			"seen",
		])
	})

	it("reaches a list's column of actions from its last title, not the Expand key under it", () => {
		assert.equal(nextInDirection(LIST, "title:movie-4", "right"), "hop:a")
		assert.equal(nextInDirection(LIST, "hop:b", "left"), "title:movie-4")
		assert.equal(nextInDirection(LIST, "expand", "left"), null)
	})

	it("does not leave the moods' last row for the Expand key below it", () => {
		assert.equal(nextInDirection(moods(364), "mood:12", "right"), null)
	})

	it("sails along the map's upper islands", () => {
		assert.deepEqual(walk(MAP, "island:heists", "right", "right", "right"), [
			"island:whodunits",
			"island:found-family",
			"island:space",
		])
	})

	it("pages the phone's home row past the tile that is cut off", () => {
		assert.deepEqual(
			walk(PHONE_HOME, "app:tonight", "right", "right", "right"),
			["app:discover", "app:explorer", "app:taste"],
		)
	})

	it("on the phone reaches the Expand key from the last action only", () => {
		assert.equal(nextInDirection(PHONE_TITLE, "seen", "right"), "expand")
		assert.equal(nextInDirection(PHONE_TITLE, "watch", "right"), null)
		assert.equal(nextInDirection(PHONE_TITLE, "expand", "left"), "seen")
	})
})

describe("Up and Down take the nearest row, and in it the item with the least sideways offset", () => {
	it("goes up from home's apps to the bar and back down to the app under the key", () => {
		assert.equal(nextInDirection(HOME, "app:tonight", "up"), "bar:search")
		assert.equal(nextInDirection(HOME, "app:shows", "up"), "bar:menu")
		assert.equal(nextInDirection(HOME, "bar:search", "down"), "app:taste")
		assert.equal(nextInDirection(HOME, "bar:menu", "down"), "app:shows")
	})

	it("stays in the column down the moods, into the rows that page in", () => {
		assert.deepEqual(walk(moods(), "mood:1", "down", "down"), [
			"mood:4",
			"mood:7",
		])
		// The third row is as near as the Expand key and takes the focus: the grid goes on first.
		assert.equal(nextInDirection(moods(), "mood:6", "down"), "mood:9")
		assert.equal(nextInDirection(moods(364), "mood:9", "down"), "mood:12")
	})

	it("reaches the Expand key with Down from the moods' last row, and comes back up", () => {
		for (const mood of ["mood:10", "mood:11", "mood:12"])
			assert.equal(nextInDirection(moods(364), mood, "down"), "expand")
		assert.equal(nextInDirection(moods(364), "expand", "up"), "mood:12")
		assert.equal(nextInDirection(moods(364), "expand", "down"), null)
	})

	it("goes up from the moods to the bar, and to rows that paged out", () => {
		assert.equal(nextInDirection(moods(), "mood:1", "up"), "bar:back")
		// A mood tile is more than twice as wide as the bar's keys over it: the focus starts at their left end.
		assert.equal(nextInDirection(moods(), "mood:3", "up"), "bar:back")
		assert.equal(nextInDirection(moods(364), "mood:7", "up"), "mood:4")
	})

	it("sails down the map to the island below, and on to the Expand key", () => {
		assert.equal(
			nextInDirection(MAP, "island:whodunits", "down"),
			"island:workplace",
		)
		assert.equal(nextInDirection(MAP, "island:workplace", "down"), "expand")
		assert.equal(nextInDirection(MAP, "island:time-loops", "down"), "expand")
		assert.equal(nextInDirection(MAP, "island:heists", "up"), "bar:back")
	})

	it("goes down a list's column of actions to the Expand key, and from a title straight to it", () => {
		assert.deepEqual(walk(LIST, "hop:a", "down", "down", "up", "up", "up"), [
			"hop:b",
			"expand",
			"hop:b",
			"hop:a",
			"bar:menu",
		])
		assert.equal(nextInDirection(LIST, "title:movie-1", "down"), "expand")
		assert.equal(nextInDirection(LIST, "title:movie-2", "up"), "bar:back")
	})

	it("has nothing under a title's actions: the Expand key is in their row", () => {
		assert.equal(nextInDirection(TITLE, "watch", "down"), null)
		assert.equal(nextInDirection(TITLE, "watch", "up"), "bar:back")
		assert.equal(nextInDirection(TITLE, "expand", "up"), "bar:menu")
		assert.equal(nextInDirection(TITLE, "bar:back", "down"), "seen")
	})

	it("walks the phone's column of actions", () => {
		assert.deepEqual(walk(PHONE_TITLE, "watch", "down", "down", "down"), [
			"want-to-see",
			"seen",
			"seen",
		])
	})
})

describe("from a wide item", () => {
	const row = [1, 2, 3, 4, 5].map((n) =>
		box(`tile:${n}`, 56 + (n - 1) * 222, 420, 200, 128),
	)

	it("Down starts at the row's left end when the item is more than twice as wide as the row's", () => {
		const hero = box("hero", 56, 120, 1088, 260)
		assert.equal(nextInDirection([hero, ...row], "hero", "down"), "tile:1")
	})

	it("Down takes the item under its middle otherwise", () => {
		const banner = box("banner", 400, 120, 380, 260)
		assert.equal(nextInDirection([banner, ...row], "banner", "down"), "tile:3")
	})

	it("Up does the same", () => {
		const hero = box("hero", 56, 588, 1088, 60)
		assert.equal(nextInDirection([...row, hero], "hero", "up"), "tile:1")
	})
})

describe("when nothing is there", () => {
	it("the focus stays", () => {
		assert.equal(nextInDirection(HOME, "app:tonight", "down"), null)
		assert.equal(nextInDirection(TITLE, "bar:menu", "up"), null)
		assert.equal(
			nextInDirection([box("only", 0, 0, 10, 10)], "only", "right"),
			null,
		)
	})

	it("an item that was not measured moves nowhere", () => {
		assert.equal(nextInDirection(HOME, "app:nope", "right"), null)
		assert.equal(nextInDirection([], "app:tonight", "right"), null)
	})
})

describe("the TV canvas shown at another size", () => {
	const scaled = (boxes: readonly TvBox[], k: number) =>
		boxes.map((b) =>
			box(b.id, b.left * k + 300, b.top * k + 90, b.width * k, b.height * k),
		)

	it("moves the same way on every screen, given the scale", () => {
		for (const boxes of [
			HOME,
			moods(),
			moods(364),
			MAP,
			LIST,
			TITLE,
			PHONE_HOME,
			PHONE_TITLE,
		])
			for (const { id } of boxes)
				for (const dir of ["up", "down", "left", "right"] as const)
					for (const k of [0.5, 2])
						assert.equal(
							nextInDirection(scaled(boxes, k), id, dir, k),
							nextInDirection(boxes, id, dir),
							`${id} ${dir} at ${k}`,
						)
	})

	it("needs the scale: what counts as one row is measured on the canvas", () => {
		// On the canvas "near" is 10 below and far to the side, "under" is 45 below: one row, and "under" is in line.
		const boxes = [
			box("from", 300, 0, 100, 50),
			box("near", 700, 60, 100, 50),
			box("under", 300, 95, 100, 50),
		]
		assert.equal(nextInDirection(boxes, "from", "down"), "under")
		assert.equal(nextInDirection(scaled(boxes, 2), "from", "down", 2), "under")
		assert.equal(nextInDirection(scaled(boxes, 2), "from", "down"), "near")
	})
})
