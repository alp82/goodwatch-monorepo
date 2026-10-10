import assert from "node:assert/strict"
import { test } from "node:test"
import "./title-filter/test-alias.ts"

const {
	LINKS,
	NEAR_TITLES,
	PAGE_TITLES,
	chipListLength,
	floorOf,
	levelIn,
	levelsOf,
	nearOf,
	packLinks,
	packTitle,
	packTitles,
	pageWindow,
	tokenCondition,
	tokensOf,
} = await import("./related-map-pack.ts")
const { TRAIT_KEYS } = await import("../ui/related-map/traits.ts")

const hit = (
	id: number,
	score: number,
	extra: Record<string, unknown> = {},
) => ({
	score,
	payload: {
		tmdb_id: id,
		media_type: "movie" as const,
		title: `Title ${id}`,
		release_year: 2000,
		poster_path: `/p${id}.jpg`,
		fingerprint_scores_v1: { tension: 7 },
		...extra,
	},
})

test("levels are one character per trait, in the traits' order", () => {
	const levels = levelsOf({
		situational_comedy: 0,
		romance: 10,
		tension: 6.6,
		scare: 11,
		wonder: -1,
	})
	assert.equal(levels.length, TRAIT_KEYS.length)
	assert.equal(levels[TRAIT_KEYS.indexOf("situational_comedy")], "0")
	assert.equal(levels[TRAIT_KEYS.indexOf("romance")], "a")
	assert.equal(levels[TRAIT_KEYS.indexOf("tension")], "7")
	assert.equal(levels[TRAIT_KEYS.indexOf("scare")], "-")
	assert.equal(levels[TRAIT_KEYS.indexOf("wonder")], "-")
	assert.equal(levels[TRAIT_KEYS.indexOf("violence")], "-")
	assert.equal(levelsOf(undefined), "-".repeat(TRAIT_KEYS.length))
})

test("a level is read back as a number, and an unknown one as none", () => {
	const levels = levelsOf({ romance: 10, tension: 7 })
	assert.equal(levelIn(levels, "romance"), 10)
	assert.equal(levelIn(levels, "tension"), 7)
	assert.equal(levelIn(levels, "violence"), 0)
})

test("a title of a pack: key, name, year, poster without its slash, similarity, levels", () => {
	const title = packTitle(
		{
			tmdb_id: 1396,
			media_type: "show",
			title: ["Breaking Bad", "BB"],
			release_year: 2008,
			poster_path: "/abc.jpg",
			fingerprint_scores_v1: { tension: 9 },
		},
		nearOf(0.91234),
	)
	assert.deepEqual(title.slice(0, 5), [
		"s1396",
		"Breaking Bad",
		"2008",
		"abc.jpg",
		912.3,
	])
	assert.equal(title[5][TRAIT_KEYS.indexOf("tension")], "9")
})

test("a list is complete down to its last title, or to the end when Qdrant had no more", () => {
	assert.equal(floorOf([{ score: 0.95 }, { score: 0.93169 }], 2), 931.6)
	assert.equal(floorOf([{ score: 0.95 }], 2), 0)
	assert.equal(floorOf([], 8), 0)
})

test("the first page of a filter is as long as the nearest titles, and later ones follow it", () => {
	assert.deepEqual(pageWindow(0), [NEAR_TITLES, 0])
	assert.deepEqual(pageWindow(1), [PAGE_TITLES, NEAR_TITLES])
	assert.deepEqual(pageWindow(3), [PAGE_TITLES, NEAR_TITLES + 2 * PAGE_TITLES])
})

test("the chips share the room for their lists, and no list is shorter than eight", () => {
	assert.equal(chipListLength(6), 12)
	assert.equal(chipListLength(3), 24)
	assert.equal(chipListLength(12), 8)
	assert.equal(chipListLength(0), 0)
})

test("a token becomes a range on the stored level", () => {
	assert.deepEqual(tokensOf("romance<4,tension>6").map(tokenCondition), [
		{ key: "fingerprint_scores_v1.romance", range: { lte: 4 } },
		{ key: "fingerprint_scores_v1.tension", range: { gte: 6 } },
	])
	assert.deepEqual(tokensOf(""), [])
})

test("lists become one: each title once, most alike first, without the center and what can't be shown", () => {
	const titles = packTitles("m1", [
		[hit(1, 1), hit(2, 0.9), hit(3, 0.8)],
		[
			hit(3, 0.8),
			hit(4, 0.85),
			hit(5, 0.7, { poster_path: undefined }),
			hit(6, 0.6, { fingerprint_scores_v1: undefined }),
		],
	])
	assert.deepEqual(
		titles.map((title) => [title[0], title[4]]),
		[
			["m2", 900],
			["m4", 850],
			["m3", 800],
		],
	)
})

test("titles that are in a pack already keep their place among new ones", () => {
	const have = packTitles("m1", [[hit(2, 0.9), hit(3, 0.8)]])
	const titles = packTitles("m1", [[hit(3, 0.5), hit(7, 0.85)]], have)
	assert.deepEqual(
		titles.map((title) => title[0]),
		["m2", "m7", "m3"],
	)
	assert.equal(titles[2][4], 800)
})

test("the plain links are the most alike titles with the address of each one's page", () => {
	const n = Array.from({ length: LINKS + 6 }, (_, i) =>
		packTitle(
			hit(i + 2, 0.9 - i / 1000, {
				media_type: i === 1 ? "show" : "movie",
				title: i === 0 ? "Ghost in the Shell 2.0" : `Title ${i + 2}`,
				release_year: i === 2 ? undefined : 2000,
			}).payload,
			900 - i,
		),
	)
	const links = packLinks({ c: packTitle(hit(1, 1).payload, 1000), n })
	assert.equal(links.length, LINKS)
	assert.deepEqual(links[0], {
		href: "/movie/2-ghost-in-the-shell-20",
		text: "Ghost in the Shell 2.0 (2000)",
	})
	assert.equal(links[1].href, "/show/3-title-3")
	assert.equal(links[2].text, "Title 4")
})
