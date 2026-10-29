// Sides of you on the TV's home (#673), shaped from a made-up sides view: the sides are listed by their best pick
// in personal order, the picks keep the side's order, a title shows on one side only, one per franchise, the ones
// on the member's services when enough stream there, and each carries its name and its moods' names.
import assert from "node:assert/strict"
import * as nodeModule from "node:module"
import { describe, it } from "node:test"
import "../title-filter/test-alias.ts"
import type { PortraitTitle, Side, SidesView } from "../taste-portrait/view"

// The side engine's module pulls in the availability index, which needs the Crate client.
const { registerHooks } = nodeModule as unknown as {
	registerHooks(hooks: {
		resolve(
			specifier: string,
			context: unknown,
			next: (s: string, c: unknown) => unknown,
		): unknown
	}): void
}
registerHooks({
	resolve: (specifier, context, next) =>
		specifier === "~/server/availability-index.server"
			? {
					url: "data:text/javascript,export const isOnServices = () => null",
					shortCircuit: true,
				}
			: next(
					specifier === "~/server/taste/index.server"
						? "~/server/taste/taste.server"
						: specifier,
					context,
				),
})

const { homeSides } = await import("./home-sides.server")
const { titleKey } = await import("../../utils/title-key")

const key = (id: number) => titleKey("movie", id)

function title(
	id: number,
	name: string,
	more: Partial<PortraitTitle> = {},
): PortraitTitle {
	return {
		key: key(id),
		mediaType: "movie",
		anime: false,
		tmdbId: id,
		title: name,
		year: 2000,
		poster: `/p${id}.jpg`,
		backdrop: `/b${id}.jpg`,
		score: 80,
		mine: null,
		match: 70,
		onMyServices: null,
		reasons: [],
		services: null,
		...more,
	}
}

function side(
	id: string,
	here: number[],
	moreOfThis: number[],
	more: Partial<Side> = {},
): Side {
	return {
		id,
		name: `Name of ${id}`,
		attributes: [],
		count: 20,
		average: 8,
		here: here.map(key),
		image: null,
		moods: ["heavy"] as Side["moods"],
		edges: [],
		moreOfThis: moreOfThis.map(key),
		...more,
	}
}

const titles: PortraitTitle[] = [
	// Loved.
	title(1, "Se7en", { mine: 9 }),
	title(2, "Zodiac", { mine: 9 }),
	title(3, "Paddington", { mine: 8 }),
	// Picks.
	title(11, "Prisoners", { match: 80 }),
	title(12, "Memories of Murder", { match: 78 }),
	title(13, "The Chaser", { match: 76 }),
	title(21, "Hot Fuzz", { match: 90 }),
	title(22, "Paddington 2", { match: 88 }),
	title(23, "Paddington 3", { match: 87 }),
]

function view(sides: Side[], more: Partial<SidesView> = {}): SidesView {
	return {
		tab: "sides",
		subject: { kind: "member", rated: 100, usual: 7 },
		status: "ready",
		titles: Object.fromEntries(titles.map((t) => [t.key, t])),
		sides,
		headline: null,
		openFirst: null,
		hasServices: false,
		services: [],
		...more,
	}
}

const dark = side("dark", [1, 2], [11, 12, 13])
const light = side("light", [3], [21, 22, 23, 12], { moods: [] })

describe("home's sides", () => {
	it("are listed by where each side's best pick stands in personal order", () => {
		// Personal order puts Hot Fuzz, the light side's best pick, before Prisoners, the dark side's.
		const order = (keys: number[]) =>
			[...keys].sort((a, b) => (a === key(21) ? -1 : b === key(21) ? 1 : 0))
		assert.deepEqual(
			homeSides(view([dark, light]), order).map((s) => s.id),
			["light", "dark"],
		)
		const reverse = (keys: number[]) =>
			[...keys].sort((a, b) => (a === key(11) ? -1 : b === key(11) ? 1 : 0))
		assert.deepEqual(
			homeSides(view([light, dark]), reverse).map((s) => s.id),
			["dark", "light"],
		)
	})

	it("without personal order, are listed by their best pick's match", () => {
		assert.deepEqual(
			homeSides(view([dark, light])).map((s) => s.id),
			["light", "dark"],
		)
	})

	it("keep each side's picks in the side's own order, a title on one side only, one per franchise", () => {
		const [first, second] = homeSides(view([dark, light]))
		assert.deepEqual(
			first.picks.map((t) => t.title),
			["Hot Fuzz", "Paddington 2"],
		)
		// Memories of Murder stands second on the dark side and fourth on the light one: it stays dark.
		assert.deepEqual(
			second.picks.map((t) => t.title),
			["Prisoners", "Memories of Murder", "The Chaser"],
		)
	})

	it("are shown by their loved posters, open Watch next with their moods, and carry their names", () => {
		const [funny, grim] = homeSides(view([dark, light]))
		assert.deepEqual(
			grim.loved.map((t) => [t.key, t.title, t.poster]),
			[
				["movie-1", "Se7en", "/p1.jpg"],
				["movie-2", "Zodiac", "/p2.jpg"],
			],
		)
		assert.equal(grim.watchNext, "/watch-next?moods=heavy")
		assert.equal(funny.watchNext, "/watch-next")
		assert.deepEqual(grim.words, { name: "Name of dark", moods: ["Sad"] })
	})

	it("show the picks on the member's services when enough stream there, else all with a note", () => {
		const on = new Set([11, 13, 21, 22, 23].map(key))
		const streaming = titles.map((t) => ({ ...t, onMyServices: on.has(t.key) }))
		const v = view(
			[side("x", [1], [11, 12, 13, 21, 22]), side("y", [3], [23])],
			{
				hasServices: true,
				titles: Object.fromEntries(streaming.map((t) => [t.key, t])),
			},
		)
		const shaped = homeSides(v)
		const x = shaped.find((s) => s.id === "x")
		const y = shaped.find((s) => s.id === "y")
		assert.deepEqual(
			x?.picks.map((t) => t.key),
			["movie-11", "movie-13", "movie-21", "movie-22"],
		)
		assert.equal(x?.fewOnServices, false)
		assert.deepEqual(
			y?.picks.map((t) => t.key),
			["movie-23"],
		)
		assert.equal(y?.fewOnServices, true)
	})

	it("are listed by their best pick, not their first, without personal order", () => {
		// The engine's order inside a side is not by match: x's best pick (95) stands second.
		const v = view([side("y", [3], [13]), side("x", [1], [11, 21])], {
			titles: Object.fromEntries(
				titles.map((t) => [
					t.key,
					{ ...t, match: t.key === key(21) ? 95 : t.key === key(13) ? 80 : 70 },
				]),
			),
		})
		assert.deepEqual(
			homeSides(v).map((s) => s.id),
			["x", "y"],
		)
	})

	it("decide on services after the titles another side keeps are gone, so no side is emptied", () => {
		const on = new Set([11, 12, 13, 21].map(key))
		const streaming = titles.map((t) => ({ ...t, onMyServices: on.has(t.key) }))
		const v = view(
			[
				side("x", [1], [11, 12, 13, 21]),
				side("y", [3], [11, 12, 13, 21, 22, 23]),
			],
			{
				hasServices: true,
				titles: Object.fromEntries(streaming.map((t) => [t.key, t])),
			},
		)
		const y = homeSides(v).find((s) => s.id === "y")
		assert.deepEqual(
			y?.picks.map((t) => t.key),
			["movie-22"],
		)
		assert.equal(y?.fewOnServices, true)
	})

	it("keep a sequel that streams over a first film that doesn't", () => {
		const extra = [
			title(31, "Toy Story", { onMyServices: false }),
			title(32, "Toy Story 2", { onMyServices: true }),
			title(33, "Up", { onMyServices: true }),
			title(34, "Coco", { onMyServices: true }),
			title(35, "Soul", { onMyServices: true }),
		]
		const v = view([side("x", [3], [31, 32, 33, 34, 35])], {
			hasServices: true,
			titles: Object.fromEntries([...titles, ...extra].map((t) => [t.key, t])),
		})
		const [x] = homeSides(v)
		assert.deepEqual(
			x.picks.map((t) => t.title),
			["Toy Story 2", "Up", "Coco", "Soul"],
		)
		assert.equal(x.fewOnServices, false)
	})

	it("list a side without picks last", () => {
		const empty = side("empty", [3], [])
		assert.deepEqual(
			homeSides(view([empty, dark])).map((s) => s.id),
			["dark", "empty"],
		)
	})

	it("are none for a sample taste, a view not ready, or no sides", () => {
		assert.deepEqual(
			homeSides(
				view([dark], { subject: { kind: "sample", rated: 10, usual: 7 } }),
			),
			[],
		)
		assert.deepEqual(homeSides(view([dark], { status: "unavailable" })), [])
		assert.deepEqual(homeSides(view([])), [])
	})
})
