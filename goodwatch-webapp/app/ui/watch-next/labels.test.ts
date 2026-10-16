// What My movies (#385) says where Watch next speaks of titles and the Wishlist: the word is "movie".
import assert from "node:assert/strict"
import { test } from "node:test"
import "../../server/title-filter/test-alias.ts"

const { heroLabel, movieHeroLabel, runtimeLabel, tierGridClass, TIER_LABEL } =
	await import("./labels.ts")

test("Watch next's hero line is unchanged", () => {
	assert.equal(heroLabel("match", [], null), "Best match for you tonight")
	assert.equal(heroLabel("top", [], null), "Top rated on your Wishlist")
	assert.equal(
		heroLabel("match", [], "nothingOnServices"),
		"Nothing on your services; closest",
	)
})

test("My movies' hero line names tonight's movie and the time chosen", () => {
	assert.equal(
		movieHeroLabel("match", [], null, null),
		"Tonight's movie · Best match for you tonight",
	)
	assert.equal(
		movieHeroLabel("match", [], null, 120),
		"Tonight's movie · Best match for you tonight, up to 2h",
	)
	assert.equal(
		movieHeroLabel("top", ["funny"], null, 90),
		"Tonight's movie · Top rated in Funny, up to 1h 30",
	)
	assert.equal(
		movieHeroLabel("waiting", [], null, null),
		"Tonight's movie · Waiting longest of your movies",
	)
	assert.equal(
		movieHeroLabel("added", [], null, null),
		"Tonight's movie · Last added of your movies",
	)
	assert.equal(
		movieHeroLabel("popular", [], null, null),
		"Tonight's movie · Most popular of your movies right now",
	)
})

test("when nothing fits, My movies says what the closest movie is closest to", () => {
	assert.equal(
		movieHeroLabel("match", [], "nothingInTime", 90),
		"Tonight's movie · Nothing up to 1h 30; the closest",
	)
	assert.equal(
		movieHeroLabel("match", ["funny"], "closestToMoods", null),
		"Tonight's movie · Closest to your moods",
	)
	assert.equal(
		movieHeroLabel("match", [], "nothingOnServices", null),
		"Tonight's movie · Nothing on your services; closest",
	)
})

test("no line of My movies says film or Wishlist", () => {
	for (const sort of [
		"match",
		"waiting",
		"added",
		"newest",
		"top",
		"popular",
	] as const)
		for (const time of [null, 120])
			assert.doesNotMatch(
				movieHeroLabel(sort, [], null, time),
				/film|wishlist/i,
			)
	assert.equal(
		runtimeLabel({ media_type: "movie", runtime: null }, "Movie"),
		"Movie",
	)
	// Watch next keeps its word.
	assert.equal(runtimeLabel({ media_type: "movie", runtime: null }), "Film")
	assert.equal(
		runtimeLabel({ media_type: "movie", runtime: 132 }, "Movie"),
		"2h 12m",
	)
	assert.equal(TIER_LABEL.notTonightsFit, "Not tonight's fit")
})

test("a closed group is hidden at every width, not re-shown by a desktop display class", () => {
	for (const size of ["xl", "lg", "md", "sm"] as const) {
		const closed = tierGridClass(size, false).split(/\s+/)
		assert.deepEqual(
			closed.filter((name) => /(^|:)(grid|flex|block)$/.test(name)),
			[],
		)
		assert.ok(closed.includes("hidden"))
		const open = tierGridClass(size, true).split(/\s+/)
		assert.ok(open.includes("grid") && open.includes("md:flex"))
		assert.ok(!open.includes("hidden"))
	}
})

test("the taste picker's picks in words: one kind with or, kinds with and (#677)", async () => {
	const { picksWords, picksShort, tierNote } = await import("./labels.ts")
	const picker = {
		picks: [] as string[],
		fitting: 0,
		groups: [
			{
				id: "g1",
				key: "movie-1949",
				name: "Dark, psychological thrillers",
				hues: [],
				madeOf: [],
			},
		],
		choices: [],
		forYou: [],
		narrow: [],
	}
	assert.deepEqual(picksWords({ ...picker, picks: ["m:funny", "m:scary"] }), {
		words: "Funny or Scary",
		beyondMoods: false,
	})
	const mixed = { ...picker, picks: ["g1", "s:slow"] }
	assert.deepEqual(picksWords(mixed), {
		words: "Dark, psychological thrillers and Slow burn",
		beyondMoods: true,
	})
	assert.equal(picksShort(mixed), "Dark, psychological thrillers +1")
	assert.equal(picksShort(picker), "Any mood")
	assert.equal(
		heroLabel("match", [], null, picksWords(mixed)),
		"Best match for Dark, psychological thrillers and Slow burn tonight",
	)
	assert.equal(
		heroLabel("match", [], "closestToMoods", picksWords(mixed)),
		"Closest to your picks",
	)
	assert.equal(tierNote("otherMoods", false), "In another mood.")
	assert.equal(tierNote("otherPicks", true), "Missing something you picked.")
})

test("the picker's hint says what another pick does, and when there is no room (#677)", async () => {
	const { pickHint } = await import("./labels.ts")
	const picker = { picks: [] as string[], fitting: 0, groups: [], choices: [], forYou: [], narrow: [] }
	assert.equal(pickHint(picker), "Mix moods, themes, and styles.")
	assert.equal(
		pickHint({ ...picker, picks: ["m:funny"] }),
		"Another mood adds titles; a theme or style narrows them.",
	)
	assert.equal(pickHint({ ...picker, picks: ["m:funny", "t:crime"] }), "Another mood or theme adds titles; a style narrows them.")
	assert.equal(pickHint({ ...picker, picks: ["m:funny", "t:crime", "s:slow"] }), "Remove one to pick another.")
})
