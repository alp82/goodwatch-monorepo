// The mini Explorer: which six islands, where each sits, what is next door, what the screens show, and where
// every direction key goes on the map.
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type { ExplorerService } from "~/domain/explorer"
import {
	MAP_BOX,
	MAP_PLACES,
	type MapPlace,
	explorerContext,
	explorerView,
	explorerWaiting,
	inkOn,
	islandCount,
	islandTitleFacts,
	knownOnMap,
	largestIslands,
	mapBridges,
	nearestIslands,
	placeIslands,
} from "./tv-explorer.ts"
import { MOOD_ISLANDS, MOOD_MAP, SIX, mapTitle } from "./tv-explorer.fixture.ts"
import { EMPTY_CONTEXT, destinationHref, tvItems } from "./tv-machine.ts"
import { type TvBox, type TvDir, nextInDirection } from "./tv-move.ts"

const ids = (islands: readonly { id: string }[]) =>
	islands.map((island) => island.id)
const at = (id: string, x: number, y: number, count = 1) => ({
	id,
	x,
	y,
	count,
})

describe("the six islands", () => {
	it("are the six with the most titles for the person, most first", () => {
		assert.deepEqual(ids(largestIslands(MOOD_ISLANDS)), [
			"funny",
			"thrilling",
			"sad",
			"dark",
			"cozy",
			"scary",
		])
	})

	it("an island without titles is none, and equal islands keep the map's order", () => {
		const islands = [
			at("a", 0, 0, 5),
			at("b", 0, 0, 0),
			at("c", 0, 0, 9),
			at("d", 0, 0, 5),
		]
		assert.deepEqual(ids(largestIslands(islands)), ["c", "a", "d"])
		assert.deepEqual(ids(largestIslands(islands, 2)), ["c", "a"])
	})
})

describe("the six places", () => {
	it("the day's map: what is left stays left, what is on top stays on top", () => {
		// Dark and Scary are the real map's west, Cozy and Funny its east; Sad is its north, Scary and Funny
		// its south.
		assert.deepEqual(ids(placeIslands(largestIslands(MOOD_ISLANDS))), SIX)
	})

	it("islands that sit where the places are keep their places, in any order they come in", () => {
		const there = MAP_PLACES.map((place, n) =>
			at(`p${n}`, place.left + place.width / 2, place.top + place.height / 2),
		)
		const want = ["p0", "p1", "p2", "p3", "p4", "p5"]
		assert.deepEqual(ids(placeIslands(there)), want)
		assert.deepEqual(ids(placeIslands([...there].reverse())), want)
		assert.deepEqual(
			ids(
				placeIslands([
					there[3],
					there[5],
					there[0],
					there[4],
					there[1],
					there[2],
				]),
			),
			want,
		)
	})

	it("a map turned left to right is a mini map turned left to right", () => {
		const mirrored = largestIslands(MOOD_ISLANDS).map((island) => ({
			...island,
			x: -island.x,
		}))
		// The far right place and the top left one swap sides; so do the two rows' ends.
		const placed = ids(placeIslands(mirrored))
		assert.ok(["cozy", "funny"].includes(placed[0]), "the east is on the left")
		assert.ok(["cozy", "funny"].includes(placed[3]), "the east is on the left")
		assert.ok(["dark", "scary"].includes(placed[5]), "the west is far right")
	})

	it("fewer than six take the first places, and islands on one spot are still given out", () => {
		assert.deepEqual(ids(placeIslands([at("east", 1, 0), at("west", -1, 0)])), [
			"west",
			"east",
		])
		assert.deepEqual(ids(placeIslands([at("only", 0.3, 0.3)])), ["only"])
		assert.deepEqual(placeIslands([]), [])
		assert.equal(
			placeIslands([at("a", 0, 0), at("b", 0, 0), at("c", 0, 0)]).length,
			3,
		)
	})

	it("lie inside the map, apart from each other even while one is focused, and clear of the Expand key", () => {
		// The focused tile grows to 1.09 and has a white edge of 4 px.
		const grown = (p: MapPlace) => ({
			left: p.left - p.width * 0.045 - 4,
			top: p.top - p.height * 0.045 - 4,
			right: p.left + p.width * 1.045 + 4,
			bottom: p.top + p.height * 1.045 + 4,
		})
		const rest = (p: MapPlace) => ({
			left: p.left,
			top: p.top,
			right: p.left + p.width,
			bottom: p.top + p.height,
		})
		type Box = ReturnType<typeof rest>
		const meet = (a: Box, b: Box) =>
			a.left < b.right &&
			b.left < a.right &&
			a.top < b.bottom &&
			b.top < a.bottom
		// The Expand key's corner: 220 x 64 at the map's bottom right, and the caption's band beside it.
		const corner = {
			left: MAP_BOX.width - 220,
			top: MAP_BOX.height - 64,
			right: MAP_BOX.width,
			bottom: MAP_BOX.height,
		}
		const caption = { left: 0, top: 384, right: 800, bottom: MAP_BOX.height }
		assert.equal(MAP_PLACES.length, 6)
		MAP_PLACES.forEach((place, n) => {
			const box = rest(place)
			assert.ok(box.left >= 0 && box.top >= 0, `place ${n} starts inside`)
			assert.ok(
				box.right <= MAP_BOX.width && box.bottom <= MAP_BOX.height,
				`place ${n} ends inside`,
			)
			assert.ok(
				!meet(grown(place), corner),
				`place ${n} is clear of the Expand key`,
			)
			assert.ok(
				!meet(grown(place), caption),
				`place ${n} is clear of the caption`,
			)
			MAP_PLACES.forEach((other, m) => {
				if (m !== n)
					assert.ok(
						!meet(grown(place), rest(other)),
						`places ${n} and ${m} are apart`,
					)
			})
		})
		assert.equal(new Set(MAP_PLACES.map((place) => place.shape)).size, 6)
	})
})

describe("next door", () => {
	const six = placeIslands(largestIslands(MOOD_ISLANDS))
	const hops = (id: string) =>
		ids(
			nearestIslands(
				MOOD_ISLANDS.find((island) => island.id === id) ?? MOOD_ISLANDS[0],
				six,
			),
		)

	it("Sail to offers the two nearest of the six, nearest first", () => {
		assert.deepEqual(hops("dark"), ["scary", "sad"])
		assert.deepEqual(hops("sad"), ["thrilling", "dark"])
		assert.deepEqual(hops("cozy"), ["funny", "thrilling"])
		assert.deepEqual(hops("scary"), ["dark", "thrilling"])
		assert.deepEqual(hops("thrilling"), ["sad", "scary"])
		assert.deepEqual(hops("funny"), ["cozy", "thrilling"])
	})

	it("an island that is not among the six sails to the nearest of the six", () => {
		// Deep sits between Scary and Dark on the real map.
		assert.deepEqual(hops("deep"), ["scary", "dark"])
	})

	it("never offers the island itself, and no more than there are", () => {
		const two = [at("a", 0, 0), at("b", 1, 0)]
		assert.deepEqual(ids(nearestIslands(two[0], two)), ["b"])
		assert.deepEqual(ids(nearestIslands(two[0], [two[0]])), [])
		assert.deepEqual(ids(nearestIslands(two[0], six, 3)).length, 3)
	})

	it("the bridges join each island to its nearest, each pair once", () => {
		// Dark and Scary, Sad and Thrilling, Cozy and Funny: each is the other's nearest.
		assert.deepEqual(mapBridges(six), [
			[0, 3],
			[1, 4],
			[2, 5],
		])
		// A chain: the middle one is nearest to both ends, the ends each to the middle.
		assert.deepEqual(
			mapBridges([at("a", 0, 0), at("b", 1, 0), at("c", 2.5, 0)]),
			[
				[0, 1],
				[1, 2],
			],
		)
		assert.deepEqual(mapBridges([at("alone", 0, 0)]), [])
	})
})

describe("what the screens show", () => {
	it("the map: six islands in their places, with what sets each apart", () => {
		const view = explorerView(MOOD_MAP, null)
		assert.equal(view.status, "ready")
		assert.equal(view.island, null)
		assert.deepEqual(ids(view.islands), SIX)
		assert.deepEqual(view.islands[0], {
			id: "dark",
			name: "Dark",
			color: "#6a5aa8",
			count: 1943,
			apart: "A bleak outlook and suspense",
			picture: "/backdrop-801.jpg",
		})
		assert.deepEqual(view.bridges, [
			[0, 3],
			[1, 4],
			[2, 5],
		])
		assert.deepEqual(explorerContext(view), {
			islands: SIX,
			titles: [],
			hops: [],
		})
	})

	it("an island: its first four titles and the two islands to sail to", () => {
		const view = explorerView(MOOD_MAP, "sad")
		assert.ok(view.island && view.island !== "missing")
		assert.equal(view.island.name, "Sad")
		assert.deepEqual(
			view.island.titles.map((title) => title.key),
			["movie-701", "movie-702", "movie-703", "movie-704"],
		)
		assert.deepEqual(view.island.titles[0], {
			key: "movie-701",
			title: "Title 701",
			facts: "1990 · Movie · 80 score",
			poster: "/poster-701.jpg",
			backdrop: "/backdrop-701.jpg",
		})
		assert.deepEqual(ids(view.island.hops), ["thrilling", "dark"])
		const ctx = { ...EMPTY_CONTEXT, ...explorerContext(view) }
		assert.deepEqual(tvItems({ name: "explorer", island: "sad" }, ctx), [
			"title:movie-701",
			"title:movie-702",
			"title:movie-703",
			"title:movie-704",
			"hop:thrilling",
			"hop:dark",
			"expand",
			"nav:home",
			"bar:back",
			"bar:search",
			"bar:menu",
		])
	})

	it("the machine's items for the map are the six islands, in the places' order", () => {
		const ctx = {
			...EMPTY_CONTEXT,
			...explorerContext(explorerView(MOOD_MAP, null)),
		}
		const screen = { name: "explorer", island: null } as const
		assert.deepEqual(tvItems(screen, ctx), [
			...SIX.map((id) => `island:${id}`),
			"expand",
			"nav:home",
			"bar:back",
			"bar:search",
			"bar:menu",
		])
		assert.equal(destinationHref(screen, ctx), "/explorer?grouping=mood")
	})

	it("an island of the map that is not among the six shows its titles too", () => {
		const view = explorerView(MOOD_MAP, "romantic")
		assert.ok(view.island && view.island !== "missing")
		assert.equal(view.island.titles.length, 4)
		assert.deepEqual(ids(view.island.hops), ["cozy", "funny"])
	})

	it("an island the map does not have, and a map that is not there", () => {
		const view = explorerView(MOOD_MAP, "atlantis")
		assert.equal(view.island, "missing")
		assert.deepEqual(explorerContext(view), {
			islands: SIX,
			titles: [],
			hops: [],
		})
		assert.equal(explorerWaiting().status, "waiting")
		assert.equal(explorerWaiting(true).status, "failed")
		assert.deepEqual(explorerContext(explorerWaiting()), {
			islands: [],
			titles: [],
			hops: [],
		})
	})

	it("a map with few islands shows as many, and one without a picture has none", () => {
		const view = explorerView(
			{
				services: [],
				islands: [
					{ ...MOOD_ISLANDS[0], titles: [mapTitle(1, { backdrop: null })] },
					{ ...MOOD_ISLANDS[1], count: 0 },
					{
						...MOOD_ISLANDS[2],
						titles: [mapTitle(2, { backdrop: null }), mapTitle(3)],
					},
				],
			},
			"funny",
		)
		assert.deepEqual(ids(view.islands).sort(), ["funny", "romantic"])
		assert.equal(view.islands.find((i) => i.id === "funny")?.picture, null)
		assert.equal(
			view.islands.find((i) => i.id === "romantic")?.picture,
			"/backdrop-3.jpg",
		)
		assert.ok(view.island && view.island !== "missing")
		assert.deepEqual(ids(view.island.hops), ["romantic"])
		assert.equal(view.island.titles.length, 1)
	})

	it("a title's facts: the year, what it is, its score, the match and the person's service", () => {
		const services: ExplorerService[] = [
			{ id: 8, name: "Netflix", logo: null, mine: true },
			{ id: 9, name: "Amazon Prime Video", logo: null, mine: true },
		]
		assert.equal(
			islandTitleFacts(
				mapTitle(1, { year: 1999, score: 86.6, match: 91, services: [9, 8] }),
				services,
			),
			"1999 · Movie · 87 score · 91% match · On Netflix",
		)
		assert.equal(
			islandTitleFacts(
				mapTitle(1, {
					mediaType: "show",
					year: null,
					score: null,
					services: [9],
				}),
				services,
			),
			"Show · On Prime",
		)
		// A service the map does not name is not named.
		assert.equal(
			islandTitleFacts(mapTitle(1, { services: [337] }), services),
			"1990 · Movie · 80 score",
		)
	})

	it("what the map knows of a title names it on the title screen", () => {
		assert.deepEqual(knownOnMap(MOOD_MAP, "movie-701"), {
			media_type: "movie",
			tmdb_id: 701,
			title: "Title 701",
			poster_path: "/poster-701.jpg",
			backdrop_path: "/backdrop-701.jpg",
			release_year: 1990,
			goodwatch_overall_score_normalized_percent: 80,
			match: null,
			wantToSee: false,
			seen: false,
		})
		// A show of the same number is another title.
		assert.equal(knownOnMap(MOOD_MAP, "show-701"), null)
		assert.equal(knownOnMap(MOOD_MAP, "movie-1"), null)
	})

	it("the words: a count, and ink that stands out on an island's colour", () => {
		assert.equal(islandCount(2616), "2,616 titles")
		assert.equal(islandCount(1), "1 title")
		// Dark is the one island of the twelve whose colour takes white.
		assert.deepEqual(
			MOOD_ISLANDS.filter((island) => inkOn(island.color) === "#fff").map(
				(island) => island.id,
			),
			["dark"],
		)
		assert.equal(inkOn("#000000"), "#fff")
		assert.equal(inkOn("#ffffff"), "#0b0c10")
	})
})

// ---------------------------------------------------------------------------------------------------------
// Where the direction keys go. The boxes are the screens' own: the map's places inside the Frame's content
// (56, 108 on the desktop canvas), the bar's keys above, the Expand key's corner at the bottom right.

const DIRS: TvDir[] = ["up", "down", "left", "right"]

/** The focused item is measured as it is drawn: a tile at 1.09, a key at 1.06. */
const measured = (boxes: readonly TvBox[], from: string): TvBox[] =>
	boxes.map((box) => {
		if (box.id !== from) return box
		const k = /^(island|title):/.test(box.id) ? 1.09 : 1.06
		return {
			...box,
			left: box.left - (box.width * (k - 1)) / 2,
			top: box.top - (box.height * (k - 1)) / 2,
			width: box.width * k,
			height: box.height * k,
		}
	})

/** Every direction from every item, at rest sizes and as measured, and with the TV shown smaller and larger. */
function moves(boxes: readonly TvBox[]) {
	const table: Record<string, string> = {}
	for (const { id } of boxes) {
		const row = DIRS.map((dir) => {
			const to = nextInDirection(measured(boxes, id), id, dir)
			for (const scale of [0.83, 1, 1.3]) {
				const scaled = measured(boxes, id).map((box) => ({
					id: box.id,
					left: box.left * scale,
					top: box.top * scale,
					width: box.width * scale,
					height: box.height * scale,
				}))
				assert.equal(
					nextInDirection(scaled, id, dir, scale),
					to,
					`${id} ${dir} at ${scale}`,
				)
			}
			assert.equal(nextInDirection(boxes, id, dir), to, `${id} ${dir} at rest`)
			return to ?? "-"
		})
		table[id] = row.join(" ")
	}
	return table
}

const BAR: TvBox[] = [
	{ id: "bar:back", left: 713, top: 22, width: 131, height: 64 },
	{ id: "bar:search", left: 854, top: 22, width: 152, height: 64 },
	{ id: "bar:menu", left: 1016, top: 22, width: 128, height: 64 },
]
const EXPAND: TvBox = {
	id: "expand",
	left: 924,
	top: 544,
	width: 220,
	height: 64,
}

describe("the direction keys on the map", () => {
	const map: TvBox[] = [
		...MAP_PLACES.map((place, n) => ({
			id: `island:${SIX[n]}`,
			left: 56 + place.left,
			top: 108 + place.top,
			width: place.width,
			height: place.height,
		})),
		EXPAND,
		...BAR,
	]

	it("every direction from every island, the Expand key and the bar", () => {
		// up, down, left, right. "-": the focus stays.
		assert.deepEqual(moves(map), {
			// The top row: Dark, Sad, Cozy.
			"island:dark": "bar:back island:scary - island:sad",
			"island:sad": "bar:back island:scary island:dark island:cozy",
			"island:cozy": "bar:back island:thrilling island:sad island:funny",
			// The bottom row: Scary, Thrilling.
			"island:scary": "island:dark expand - island:thrilling",
			"island:thrilling": "island:cozy expand island:scary island:funny",
			// Far right, between the rows: Funny. Up and Down leave the map; they never jump across it.
			"island:funny": "bar:menu expand island:cozy -",
			// The Expand key is right under Funny.
			expand: "island:funny - - -",
			// Down from the bar lands on the top row.
			"bar:back": "- island:cozy - bar:search",
			"bar:search": "- island:cozy bar:back bar:menu",
			"bar:menu": "- island:cozy bar:search -",
		})
	})

	it("the two moves the first map got wrong", () => {
		// With the first prototype's places, Down from the far right island went to the bottom row's island at
		// its left, and Up from that island went back to the far right one.
		assert.equal(nextInDirection(map, "island:funny", "down"), "expand")
		assert.equal(nextInDirection(map, "island:thrilling", "up"), "island:cozy")
	})

	it("Right walks the top row to the far right island, and Left walks back", () => {
		let from = "island:dark"
		const walked = ["right", "right", "right", "left", "left", "left"].map(
			(dir) => {
				from = nextInDirection(measured(map, from), from, dir as TvDir) ?? from
				return from
			},
		)
		assert.deepEqual(walked, [
			"island:sad",
			"island:cozy",
			"island:funny",
			"island:cozy",
			"island:sad",
			"island:dark",
		])
	})

	it("Down and Up between the rows come back to where they started", () => {
		for (const [top, bottom] of [
			["island:dark", "island:scary"],
			["island:cozy", "island:thrilling"],
		]) {
			assert.equal(nextInDirection(map, top, "down"), bottom)
			assert.equal(nextInDirection(map, bottom, "up"), top)
		}
		assert.equal(nextInDirection(map, "island:funny", "down"), "expand")
		assert.equal(nextInDirection(map, "expand", "up"), "island:funny")
	})

	it("every island is reached from the first one, and none is a dead end", () => {
		const seen = new Set(["island:dark"])
		const queue = ["island:dark"]
		while (queue.length) {
			const from = queue.shift() as string
			for (const dir of DIRS) {
				const to = nextInDirection(map, from, dir)
				if (to && !seen.has(to)) {
					seen.add(to)
					queue.push(to)
				}
			}
		}
		assert.equal(seen.size, map.length)
	})

	it("the phone: three by two, and the corner under them", () => {
		// A canvas of 500 x 417: the bar's keys are touch targets at the top right, the islands fill two rows of
		// three under the bar, and the row under them is the Expand key's.
		const cell = (id: string, col: number, row: number): TvBox => ({
			id: `island:${id}`,
			left: 20 + col * 156.67,
			top: 86 + row * 118,
			width: 146.67,
			height: 108,
		})
		const phone: TvBox[] = [
			...SIX.map((id, n) => cell(id, n % 3, Math.floor(n / 3))),
			{ id: "expand", left: 322, top: 336, width: 158, height: 61 },
			{ id: "bar:back", left: 281, top: 9, width: 61, height: 61 },
			{ id: "bar:search", left: 350, top: 9, width: 61, height: 61 },
			{ id: "bar:menu", left: 419, top: 9, width: 61, height: 61 },
		]
		assert.deepEqual(moves(phone), {
			"island:dark": "bar:back island:scary - island:sad",
			"island:sad": "bar:back island:thrilling island:dark island:cozy",
			// An island is more than twice as wide as a key of the bar: Up starts at the bar's left end.
			"island:cozy": "bar:back island:funny island:sad -",
			"island:scary": "island:dark expand - island:thrilling",
			"island:thrilling": "island:sad expand island:scary island:funny",
			"island:funny": "island:cozy expand island:thrilling -",
			expand: "island:funny - - -",
			"bar:back": "- island:sad - bar:search",
			"bar:search": "- island:cozy bar:back bar:menu",
			"bar:menu": "- island:cozy bar:search -",
		})
	})
})

describe("the direction keys on an island", () => {
	const tile = (n: number): TvBox => ({
		id: `title:movie-${n}`,
		left: 56 + (n - 1) * 196,
		top: 249,
		width: 172,
		height: 258,
	})
	const island: TvBox[] = [
		tile(1),
		tile(2),
		tile(3),
		tile(4),
		{ id: "hop:thrilling", left: 964, top: 359, width: 180, height: 68 },
		{ id: "hop:dark", left: 964, top: 439, width: 180, height: 68 },
		EXPAND,
		...BAR,
	]

	it("every direction from every title, both islands to sail to, the Expand key and the bar", () => {
		assert.deepEqual(moves(island), {
			"title:movie-1": "bar:back expand - title:movie-2",
			"title:movie-2": "bar:back expand title:movie-1 title:movie-3",
			"title:movie-3": "bar:back expand title:movie-2 title:movie-4",
			"title:movie-4": "bar:back expand title:movie-3 hop:thrilling",
			"hop:thrilling": "bar:menu hop:dark title:movie-4 -",
			"hop:dark": "hop:thrilling expand title:movie-4 -",
			expand: "hop:dark - - -",
			"bar:back": "- title:movie-4 - bar:search",
			"bar:search": "- title:movie-4 bar:back bar:menu",
			// Down from the bar lands on the titles, the row right under it.
			"bar:menu": "- title:movie-4 bar:search -",
		})
	})
})
