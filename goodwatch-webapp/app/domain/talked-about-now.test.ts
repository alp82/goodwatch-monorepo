import assert from "node:assert/strict"
import { test } from "node:test"
import "../server/title-filter/test-alias.ts"
import type { SocialRow } from "./talked-about-now.ts"

const {
	compact,
	dayBefore,
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

test("a title's pieces: the newest video first, then a voice and a headline", () => {
	const items = pickItems([
		row("rss", "h1", 1),
		row("youtube", "v1", 2),
		row("youtube", "v2", 3, { source_id: "abcdefghijk" }),
		row("rss", "h2", 4),
		row("bluesky", "b1", 5),
	])
	assert.deepEqual(
		items.map((item) => item.id),
		["v1", "b1", "h1"],
	)
	assert.equal(items[0].video, "gDJ-ini7fF0")
	assert.equal(items[2].publisher, "Deadline")
	assert.equal(items[1].publisher, "someone.bsky.social")
	assert.equal(items[1].at, "2026-10-14T07:00:00.000Z")
})

test("without a video or a voice, the newest pieces fill the three", () => {
	assert.deepEqual(
		pickItems([
			row("rss", "h1", 1),
			row("rss", "h2", 2),
			row("rss", "h3", 3),
			row("rss", "h4", 4),
		]).map((item) => item.id),
		["h1", "h2", "h3"],
	)
	// One video is enough: a channel's other upload of the same trailer doesn't take a second place.
	assert.deepEqual(
		pickItems([row("youtube", "v1", 1), row("youtube", "v2", 2)]).map(
			(item) => item.id,
		),
		["v1"],
	)
	assert.deepEqual(pickItems([]), [])
})

test("a German publication's article comes after every other piece", () => {
	const items = pickItems([
		row("rss", "de", 1, {
			url: "https://www.filmstarts.de/nachrichten/1.html",
		}),
		row("rss", "en", 5),
		row("mastodon", "m1", 9, { url: "https://mastodon.social/@a/1" }),
	])
	assert.deepEqual(
		items.map((item) => item.id),
		["m1", "en", "de"],
	)
	assert.equal(items[2].publisher, "Filmstarts")
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

test("the preview line is a voice first, else a headline, else the video", () => {
	const video = itemOf(row("youtube", "v", 1))
	const headline = itemOf(row("rss", "h", 1))
	const post = itemOf(row("bluesky", "b", 1))
	assert.ok(video && headline && post)
	assert.equal(previewOf([video, headline, post]), post)
	assert.equal(previewOf([video, headline]), headline)
	assert.equal(previewOf([video]), video)
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
