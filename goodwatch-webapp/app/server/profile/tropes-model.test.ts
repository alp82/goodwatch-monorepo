import { foldGenres } from "../../domain/genre-fold.ts"
import assert from "node:assert/strict"
import { test } from "node:test"
import { DEFAULT_VISIBILITY } from "../../domain/profile.ts"
import { htmlToText } from "./trope-text.ts"
import {
	type PoolTitle,
	defining,
	definingTop,
	excerptParams,
	leastTitles,
	lovedZ,
	seesTropes,
	trimExample,
} from "./tropes-model.ts"

test("genre folding splits TV pairs and removes duplicates and TV-only genres", () => {
	assert.deepEqual(
		foldGenres([
			"Sci-Fi & Fantasy",
			"Fantasy",
			"Action & Adventure",
			"War & Politics",
			"Kids",
			"Soap",
			"News",
			"Reality",
			"Talk",
			"Drama",
		]),
		["Science Fiction", "Fantasy", "Action", "Adventure", "War", "Drama"],
	)
})
test("ranking scales its floor and handles empty and uniform ratings", () => {
	assert.deepEqual(
		[0, 149, 150, 399, 400, 800].map(leastTitles),
		[3, 3, 6, 6, 10, 10],
	)
	assert.equal(lovedZ(0, 0, 0.5), 0)
	assert.equal(lovedZ(3, 3, 1), 0)
	assert.equal(lovedZ(0, 3, 0), 0)
	assert.ok(lovedZ(77, 101, 0.54) > lovedZ(261, 441, 0.54))
	assert.equal(defining(0, 190), 0)
	assert.ok(defining(1000, 190) > defining(100, 190))
	assert.ok(defining(1000, 10) > defining(1000, 190))
})
test("defining picks prioritize 7+ then definingness then score", () => {
	const t = (k: string, s: number): PoolTitle => ({
		k,
		s,
		m: 0,
		y: null,
		g: [],
		r: [],
		d: [],
	})
	assert.deepEqual(
		definingTop([
			{ t: t("a", 6), d: 1000 },
			{ t: t("b", 8), d: 20 },
			{ t: t("c", 9), d: 20 },
			{ t: t("d", 7), d: 30 },
		]),
		["d", "c", "b", "a"],
	)
})
test("HTML conversion decodes once, retains spoiler text and removes scripts", () => {
	assert.equal(
		htmlToText(
			'<p>A &amp; B&nbsp;&mdash; <span class="spoiler">secret &#x1F600;</span></p><!-- no --><script>bad()</script><style>bad</style><p>&eacute; &#169; &lt;b&gt;</p>',
		),
		"A & B — secret 😀 é © <b>",
	)
	assert.equal(htmlToText("&#99999999; &#xD800; &unknown;"), "� � &unknown;")
	assert.equal(htmlToText("&amp;lt;"), "&lt;")
	assert.equal(trimExample("One. Two. Three.", 10), "One. Two.")
	assert.equal(trimExample("a".repeat(1000)).length, 900)
})
test("excerpt inputs enforce bounds and deduplicate", () => {
	assert.deepEqual(
		excerptParams(
			new URLSearchParams({ trope: " Name ", keys: "movie-1,movie-1,show-2" }),
		),
		{ trope: "Name", keys: ["movie-1", "show-2"] },
	)
	for (const keys of [
		"",
		"movie--1",
		"show-0",
		"movie-2147483648",
		"movie-1'",
		Array(17).fill("movie-1").join(","),
	])
		assert.equal(
			excerptParams(new URLSearchParams({ trope: "Name", keys })),
			null,
		)
})
test("visibility requires both taste and scores for every audience", () => {
	for (const viewer of ["owner", "member", "guest"] as const)
		for (const taste of ["everyone", "members", "me"] as const)
			for (const scores of ["everyone", "members", "me"] as const) {
				const visible = (part: string) =>
					viewer === "owner" ||
					part === "everyone" ||
					(viewer === "member" && part === "members")
				assert.equal(
					seesTropes({
						viewer,
						visibility: { ...DEFAULT_VISIBILITY, taste, scores },
					}),
					visible(taste) && visible(scores),
				)
			}
})
