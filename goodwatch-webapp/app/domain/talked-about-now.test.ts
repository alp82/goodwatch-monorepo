import assert from "node:assert/strict"
import { test } from "node:test"
import "../server/title-filter/test-alias.ts"
import type { SocialRow } from "./talked-about-now.ts"

const {
	compact,
	dayBefore,
	isEnglish,
	itemOf,
	liftLabel,
	moveOf,
	parseSnapshot,
	pickItems,
	previewOf,
	publisherOf,
	ranksOf,
	reasonLabel,
	reasonOf,
} = await import("./talked-about-now.ts")

const curve = (last: string, views: number[]) =>
	views.map((value, i) => ({
		day: new Date(
			Date.parse(`${last}T00:00:00Z`) - (views.length - 1 - i) * 86_400_000,
		)
			.toISOString()
			.slice(0, 10),
		views: value,
	}))

/** An entry of the top 20 as the buzz score writes it (buzz-score.md, schema version 1). */
const entry = (
	kind: "movie" | "tv",
	tmdbId: number,
	score: number,
	extra: Record<string, unknown> = {},
) => ({
	title_key: `${kind}:${tmdbId}`,
	day: "2026-10-13",
	rank: 1,
	score,
	eligible: true,
	views: Math.round(score * 1000),
	mean28: 1000,
	sd28: 400,
	z: 3,
	curve: curve("2026-10-13", [
		900,
		1000,
		1100,
		1000,
		900,
		1000,
		1200,
		1000,
		1000,
		1100,
		1000,
		900,
		2000,
		score * 1000,
	]),
	card: {
		tmdb_id: tmdbId,
		title: `Title ${tmdbId}`,
		original_title: `Title ${tmdbId}`,
		poster_path: `/p${tmdbId}.jpg`,
		release_date: "2026-10-09",
		kind,
	},
	reasons: [],
	...extra,
})

const payload = (top20: unknown[]) => ({
	schema_version: 1,
	formula_version: "wikipedia-lift-28d-v1",
	day: "2026-10-13",
	top20,
})

test("a snapshot's eligible titles, most lifted first, a show as a show", () => {
	const parsed = parseSnapshot(
		JSON.stringify(
			payload([
				entry("movie", 1, 9.7),
				entry("tv", 2, 7.8),
				entry("movie", 3, 12, { eligible: false }),
				entry("tv", 4, 3.1),
			]),
		),
	)
	assert.ok(parsed)
	assert.equal(parsed.day, "2026-10-13")
	assert.deepEqual(
		parsed.titles.map((t) => [t.key, t.mediaType, t.rank, t.lift]),
		[
			["movie:1", "movie", 1, 9.7],
			["tv:2", "show", 2, 7.8],
			["tv:4", "show", 3, 3.1],
		],
	)
	assert.equal(parsed.titles[0].curve.length, 14)
	assert.equal(parsed.titles[0].curve.at(-1), 9700)
	assert.equal(parsed.titles[0].usual, 1000)
	assert.equal(parsed.titles[0].poster, "/p1.jpg")
})

test("a payload the row can't read is no row", () => {
	assert.equal(parseSnapshot(null), null)
	assert.equal(parseSnapshot("not json"), null)
	assert.equal(parseSnapshot({ ...payload([]), schema_version: 2 }), null)
	assert.equal(parseSnapshot({ schema_version: 1, top20: [] }), null)
	assert.deepEqual(parseSnapshot(payload([]))?.titles, [])
	// A title without its card's identity or its numbers is left out, not guessed.
	const broken = entry("movie", 5, 4)
	assert.deepEqual(
		parseSnapshot(
			payload([
				{ ...broken, card: { ...broken.card, kind: "person" } },
				{ ...broken, score: null },
				{ ...broken, curve: [] },
			]),
		)?.titles,
		[],
	)
})

test("the reason is the newest hint within the curve's days", () => {
	assert.deepEqual(
		reasonOf(
			[
				{ kind: "trailer", event_day: "2026-10-01" },
				{ kind: "new_season", event_day: "2026-10-11", season_number: 3 },
				{ kind: "trailer", event_day: "2026-09-20" },
				{ kind: "made_up", event_day: "2026-10-12" },
			],
			"2026-09-30",
			"2026-10-13",
		),
		{ kind: "new_season", day: "2026-10-11", season: 3 },
	)
	assert.equal(
		reasonOf(
			[{ kind: "trailer", event_day: "2026-09-20" }],
			"2026-09-30",
			"2026-10-13",
		),
		null,
	)
	assert.equal(reasonOf(undefined, "2026-09-30", "2026-10-13"), null)
})

test("a title's move against the day before", () => {
	const before = ranksOf(payload([entry("movie", 1, 5), entry("tv", 2, 9)]))
	assert.ok(before)
	assert.equal(before.get("tv:2"), 1)
	assert.equal(moveOf("movie:1", 1, before), 1)
	assert.equal(moveOf("tv:2", 3, before), -2)
	assert.equal(moveOf("tv:2", 1, before), 0)
	assert.equal(moveOf("movie:9", 4, before), "new")
	assert.equal(moveOf("movie:1", 1, null), null)
	assert.equal(dayBefore("2026-10-01"), "2026-09-30")
})

const row = (
	source: string,
	id: string,
	hoursAgo: number,
	extra: Partial<SocialRow> = {},
): SocialRow => ({
	image: null,
	media_type: "movie",
	media_tmdb_id: 1,
	post_id: id,
	source,
	source_id: source === "youtube" ? "gDJ-ini7fF0" : `native-${id}`,
	url:
		source === "rss"
			? `https://deadline.com/2026/10/${id}/`
			: source === "youtube"
				? "https://www.youtube.com/watch?v=gDJ-ini7fF0"
				: `https://bsky.app/profile/someone/post/${id}`,
	author: source === "youtube" ? "Netflix" : "someone.bsky.social",
	published_at: new Date(
		Date.parse("2026-10-14T12:00:00Z") - hoursAgo * 3_600_000,
	),
	text: `Text ${id}`,
	...extra,
})

const ids = (items: { id: string }[]) => items.map((item) => item.id)

test("a title's pieces: the best-ranked, whatever their source, with no place kept for any source", () => {
	const items = pickItems([
		row("bluesky", "b1", 1, { score: 0.2 }),
		row("rss", "h1", 2, { score: 0.9 }),
		row("youtube", "v1", 3, { score: 0.7 }),
		row("rss", "h2", 4, { score: 0.8 }),
		row("rss", "h3", 5, { score: 0.6 }),
	])
	// The newest piece, a post, ranks last and isn't shown: a voice has no place of its own.
	assert.deepEqual(ids(items), ["h1", "h2", "v1"])
	assert.equal(items[0].publisher, "Deadline")
	assert.equal(items[2].video, "gDJ-ini7fF0")
	assert.equal(items[0].at, "2026-10-14T10:00:00.000Z")
	// A post ranked high enough is shown, before a video.
	assert.deepEqual(
		ids(
			pickItems([
				row("youtube", "v1", 1, { score: 0.5 }),
				row("bluesky", "b1", 2, { score: 0.6 }),
			]),
		),
		["b1", "v1"],
	)
})

test("at most one video and one piece of each duplicate group, and nothing fills a gap", () => {
	// A second video, however good, gives its place to the next piece.
	assert.deepEqual(
		ids(
			pickItems([
				row("youtube", "v1", 1, { score: 0.9 }),
				row("youtube", "v2", 2, { score: 0.8, source_id: "abcdefghijk" }),
				row("rss", "h1", 3, { score: 0.1 }),
			]),
		),
		["v1", "h1"],
	)
	// The same story from two sources: the better-ranked one.
	assert.deepEqual(
		ids(
			pickItems([
				row("rss", "h1", 1, { score: 0.7, dup_group: "story" }),
				row("bluesky", "b1", 2, { score: 0.8, dup_group: "story" }),
				row("rss", "h2", 3, { score: 0.1 }),
			]),
		),
		["b1", "h2"],
	)
	// Fewer than three relevant pieces stay fewer; none stay none.
	assert.deepEqual(ids(pickItems([row("rss", "h1", 1, { score: 0.3 })])), [
		"h1",
	])
	assert.deepEqual(pickItems([]), [])
	// Never more than three.
	assert.deepEqual(
		ids(
			pickItems(
				["h1", "h2", "h3", "h4"].map((id, i) =>
					row("rss", id, i, { score: 1 - i / 10 }),
				),
			),
		),
		["h1", "h2", "h3"],
	)
})

test("English first only between equal scores, then the newer", () => {
	const german = (score: number) =>
		row("rss", "german", 1, {
			url: "https://www.filmstarts.de/nachrichten/1.html",
			score,
		})
	// A better German review stays first.
	const items = pickItems([german(0.9), row("rss", "english", 5, { score: 0.5 })])
	assert.deepEqual(ids(items), ["german", "english"])
	assert.equal(items[0].publisher, "Filmstarts")
	// On a tie the English piece goes first, however much older.
	assert.deepEqual(
		ids(pickItems([german(0.5), row("rss", "english", 20, { score: 0.5 })])),
		["english", "german"],
	)
	// On a tie in the same language, the newer.
	assert.deepEqual(
		ids(
			pickItems([
				row("rss", "older", 9, { score: 0.5 }),
				row("rss", "newer", 1, { score: 0.5 }),
			]),
		),
		["newer", "older"],
	)
	// A row without a score comes after every scored one.
	assert.deepEqual(
		ids(
			pickItems([
				row("rss", "unscored", 1, { score: null }),
				row("rss", "scored", 9, { score: 0.01 }),
			]),
		),
		["scored", "unscored"],
	)
})

test("whether a piece reads as English", () => {
	for (const text of [
		"Greta Gerwig debuts first look at an epic, full-hearted ‘Narnia’ for Netflix — and the big screen",
		"Bob Odenkirk Mourns ‘Breaking Bad’ Co-Star RJ Mitte Following Death",
		"VisionQuest Doesn’t Address the MCU’s AI Problem",
		"NARNIA: THE MAGICIAN’S NEPHEW | Official Trailer | Netflix",
		"Die Hard is the best Christmas movie and I will not take questions",
	])
		assert.equal(isEnglish(text), true, text)
	for (const text of [
		"Wann kommt VisionQuest Folge 3 zu Disney+? Die verwirrende Veröffentlichung der Marvel-Serie",
		"Netflix demitirá cerca de 1.000 funcionários em maior corte desde 2022",
		"Dragon Ball Super: Beerus | Trailer oficial | Netflix con subtítulos",
		"Le film est sorti en salle, et il est très bon",
		"《纳尼亚传奇》预告片",
		"Нарния: первый трейлер",
	])
		assert.equal(isEnglish(text), false, text)
	// An article of a German publication, whatever its words.
	assert.equal(
		isEnglish(
			"Street Fighter (2026)",
			"https://www.filmstarts.de/kritiken/1.html",
		),
		false,
	)
	assert.equal(
		isEnglish("Street Fighter (2026)", "https://variety.com/2026/1/"),
		true,
	)
})

test("a row without what a card needs is no piece", () => {
	assert.equal(itemOf(row("bluesky", "x", 1, { url: null, text: null })), null)
	assert.equal(itemOf(row("bluesky", "x", 1, { text: "   " })), null)
	assert.equal(
		itemOf(row("bluesky", "x", 1, { url: "javascript:alert(1)" })),
		null,
	)
	assert.equal(
		itemOf(row("youtube", "x", 1, { source_id: "not a video id" })),
		null,
	)
	assert.equal(itemOf(row("reddit", "x", 1)), null)
	assert.equal(itemOf(row("rss", "x", 1, { published_at: null })), null)
	assert.equal(
		itemOf(row("bluesky", "x", 1, { text: "a".repeat(500) }))?.text.length,
		400,
	)
})

test("the preview line is the best-ranked piece, whatever its kind", () => {
	const items = pickItems([
		row("bluesky", "b", 1, { score: 0.4 }),
		row("youtube", "v", 2, { score: 0.9 }),
		row("rss", "h", 3, { score: 0.6 }),
	])
	assert.equal(previewOf(items)?.id, "v")
	assert.equal(previewOf(items.slice(1))?.id, "h")
	assert.equal(previewOf([]), null)
})

test("the row's words", () => {
	assert.equal(
		reasonLabel({ kind: "trailer", day: "2026-10-13" }, "movie"),
		"New trailer",
	)
	assert.equal(
		reasonLabel({ kind: "new_season", day: "2026-10-11", season: 3 }, "show"),
		"Season 3",
	)
	assert.equal(
		reasonLabel({ kind: "new_season", day: "2026-10-11" }, "show"),
		"New season",
	)
	assert.equal(
		reasonLabel({ kind: "new_release", day: "2026-10-11" }, "movie"),
		"Just released",
	)
	assert.equal(
		reasonLabel({ kind: "new_release", day: "2026-10-11" }, "show"),
		"Just premiered",
	)
	assert.equal(
		reasonLabel({ kind: "netflix_top10", day: "2026-10-11" }, "show"),
		"Netflix Top 10",
	)
	assert.equal(liftLabel(9.7434), "×9.7")
	assert.equal(liftLabel(3), "×3.0")
	assert.equal(liftLabel(12.6), "×13")
	assert.equal(compact(55235), "55K")
	assert.equal(compact(5668.9), "5.7K")
	assert.equal(compact(1000), "1K")
	assert.equal(compact(1_250_000), "1.3M")
	assert.equal(compact(812), "812")
	assert.equal(
		publisherOf("https://www.hollywoodreporter.com/movies/x/"),
		"The Hollywood Reporter",
	)
	assert.equal(publisherOf("https://example.org/a"), "example.org")
})

test("items expose the stored first-party preview supplied by the read", () => {
	const base: SocialRow = {
		media_type: "movie", media_tmdb_id: 1, post_id: "a".repeat(64), source: "rss",
		source_id: null, url: "https://example.com/article", author: "Writer",
		published_at: "2026-10-18T00:00:00Z", text: "An article", image: "/api/social/image/" + "a".repeat(64),
	}
	assert.equal(itemOf(base)?.image, base.image)
	assert.equal(itemOf({ ...base, image: null })?.image, null)
})

test("snapshot source is exposed with a legacy Wikipedia default", () => {
	const payload = { schema_version: 1, day: "2026-10-13", top20: [] }
	for (const source of [undefined, "Wikipedia en.wikipedia.org / all-access / user", "wikipedia_api", "wikipedia_dumps", "tmdb"]) {
		assert.equal(parseSnapshot({ ...payload, source })?.source,
			!source || source.startsWith("Wikipedia ") ? "wikipedia_api" : source)
	}
})
