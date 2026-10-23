import assert from "node:assert/strict"
import { test } from "node:test"
import type { EveryoneView, PortraitTitle, SidesView } from "../taste-portrait/view.ts"
import { publicView } from "./portrait-public.ts"

const title = (key: number, mine: number | null): PortraitTitle =>
	({
		key,
		mediaType: "movie",
		anime: false,
		tmdbId: key,
		title: `T${key}`,
		year: 2000,
		poster: "/p.jpg",
		backdrop: null,
		score: 70,
		mine,
		match: mine === null ? 88 : null,
		onMyServices: mine === null ? true : null,
		reasons: mine === null ? ["wit_wordplay"] : [],
		services: mine === null ? [{ id: 8, name: "Netflix", logo_path: "/n.png" }] : null,
	}) as unknown as PortraitTitle

const sides = {
	tab: "sides",
	status: "ready",
	subject: { kind: "member", rated: 50, usual: 7 },
	titles: { 1: title(1, 9), 2: title(2, null), 3: title(3, 8), 4: title(4, null) },
	sides: [
		{
			id: "a",
			name: "Witty sci-fi",
			attributes: [],
			count: 5,
			average: 8,
			here: [1],
			image: 1,
			moods: [],
			edges: [{ id: "e", kind: "step", name: "x", tail: null, toward: null, why: "", average: 8, count: 1, rated: [3], suggestions: [4], image: 4 }],
			moreOfThis: [2],
		},
	],
	headline: null,
	openFirst: "a",
	hasServices: true,
	services: [{ id: 8, name: "Netflix", logo_path: "/n.png" }],
} as unknown as SidesView

test("a public sides view keeps the loved titles and drops suggestions, services and match", () => {
	const view = publicView(sides, true)
	assert.deepEqual(Object.keys(view.titles).sort(), ["1", "3"])
	assert.equal(view.titles[1].mine, 9)
	assert.equal(view.hasServices, false)
	assert.deepEqual(view.services, [])
	assert.deepEqual(view.sides[0].moreOfThis, [])
	assert.deepEqual(view.sides[0].edges[0].suggestions, [])
	assert.equal(view.sides[0].edges[0].image, null)
	assert.equal(view.sides[0].image, 1)
})

test("without the owner's scores, titles carry none and the crowd rows go", () => {
	assert.equal(publicView(sides, false).titles[1].mine, null)
	const everyone = {
		tab: "everyone",
		status: "ready",
		subject: { kind: "member", rated: 50, usual: 7 },
		titles: { 1: title(1, 9) },
		headline: "",
		agreement: 0.5,
		offset: 0,
		counted: 50,
		higher: [{ key: 1, mine: 9, everyone: 60, delta: 3 }],
		lower: [],
		attributes: [],
		genres: [],
	} as unknown as EveryoneView
	const hidden = publicView(everyone, false)
	assert.deepEqual(hidden.higher, [])
	assert.deepEqual(hidden.titles, {})
	assert.equal(publicView(everyone, true).higher.length, 1)
})
