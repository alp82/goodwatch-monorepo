import assert from "node:assert/strict"
import { test } from "node:test"
import "node-crate"
import "ioredis"
import "../title-filter/test-alias.ts"
import type { SocialRow } from "~/domain/talked-about-now"
import type { TitleDisplay } from "../title-cards.server.ts"

const { getTalkedAboutNow, readTalkedAboutNow, socialQuery } = await import(
	"./start-row.server.ts"
)
const { titleKey } = await import("~/utils/title-key")

const entry = (kind: "movie" | "tv", tmdbId: number, score: number) => ({
	title_key: `${kind}:${tmdbId}`,
	score,
	eligible: true,
	views: score * 1000,
	mean28: 1000,
	curve: Array.from({ length: 14 }, (_, i) => ({
		day: new Date(Date.parse("2026-09-30T00:00:00Z") + i * 86_400_000)
			.toISOString()
			.slice(0, 10),
		views: i === 13 ? score * 1000 : 1000,
	})),
	card: {
		kind,
		tmdb_id: tmdbId,
		title: `Title ${tmdbId}`,
		poster_path: `/p${tmdbId}.jpg`,
		release_date: "2025-05-01",
	},
	reasons: [{ kind: "trailer", event_day: "2026-10-12" }],
})

const snapshot = (day: string, top20: unknown[]) => ({
	day,
	payload: JSON.stringify({ schema_version: 1, day, top20 }),
})

const post = (
	kind: string,
	tmdbId: number,
	id: string,
	source = "rss",
): SocialRow => ({
	media_type: kind,
	media_tmdb_id: tmdbId,
	post_id: id,
	source,
	source_id: id,
	url: `https://variety.com/${id}`,
	author: "Writer",
	published_at: new Date("2026-10-13T10:00:00Z"),
	text: `Headline ${id}`,
})

const ten = Array.from({ length: 10 }, (_, i) =>
	entry(i % 2 ? "tv" : "movie", i + 1, 20 - i),
)

function reads({
	current = snapshot("2026-10-13", ten) as ReturnType<typeof snapshot> | null,
	before = snapshot("2026-10-12", [
		entry("tv", 2, 30),
		entry("movie", 1, 10),
	]) as ReturnType<typeof snapshot> | null,
	social = async (_titles: unknown[]): Promise<SocialRow[]> => [],
	displays = async (keys: number[]) =>
		new Map<number, TitleDisplay>(
			keys.map((key) => [
				key,
				{
					key,
					backdrop_path: `/b${key}.jpg`,
					poster_path: `/d${key}.jpg`,
					release_year: 2025,
				} as TitleDisplay,
			]),
		),
} = {}) {
	const asked: string[] = []
	return {
		asked,
		reads: {
			snapshot: async (key: string) => {
				asked.push(key)
				return key === "current"
					? current
					: key === "2026-10-12"
						? before
						: null
			},
			social,
			displays,
		},
	}
}

test("the board: the first eight, with their fields, moves and pieces", async () => {
	const { reads: fake, asked } = reads({
		social: async (titles: unknown[]) => {
			assert.equal(titles.length, 8)
			return [post("movie", 1, "a"), post("tv", 2, "b"), post("movie", 1, "c")]
		},
	})
	const row = await readTalkedAboutNow(fake)
	assert.ok(row)
	assert.deepEqual(asked, ["current", "2026-10-12"])
	assert.equal(row.day, "2026-10-13")
	assert.equal(row.titles.length, 8)
	const [first, second, third] = row.titles
	assert.equal(first.tmdbId, 1)
	assert.equal(first.mediaType, "movie")
	assert.equal(first.backdrop, `/b${titleKey("movie", 1)}.jpg`)
	assert.equal(first.poster, `/d${titleKey("movie", 1)}.jpg`)
	assert.equal(first.year, 2025)
	assert.equal(first.move, 1)
	assert.equal(second.mediaType, "show")
	assert.equal(second.move, -1)
	assert.equal(third.move, "new")
	assert.deepEqual(
		first.items.map((item) => item.id),
		["a", "c"],
	)
	assert.deepEqual(
		second.items.map((item) => item.id),
		["b"],
	)
	assert.deepEqual(third.items, [])
	assert.deepEqual(first.reason, { kind: "trailer", day: "2026-10-12" })
	// Nothing of the snapshot's own bookkeeping goes to the browser.
	assert.equal("key" in first, false)
	assert.equal("releaseDate" in first, false)
})

test("no snapshot, or one without an eligible title, is no row", async () => {
	assert.equal(await readTalkedAboutNow(reads({ current: null }).reads), null)
	assert.equal(
		await readTalkedAboutNow(
			reads({ current: snapshot("2026-10-13", []) }).reads,
		),
		null,
	)
})

test("missing social tables leave the titles without pieces", async () => {
	const missing = Object.assign(
		new Error("RelationUnknown[Relation 'doc.social_post' unknown]"),
		{
			code: 4041,
		},
	)
	const row = await readTalkedAboutNow(
		reads({
			social: async () => {
				throw missing
			},
		}).reads,
	)
	assert.ok(row)
	assert.equal(row.titles.length, 8)
	assert.ok(row.titles.every((title) => title.items.length === 0))
})

test("without the day before, the fields or the catalog, the row still stands", async () => {
	const row = await readTalkedAboutNow(
		reads({
			before: null,
			displays: async () => {
				throw new Error("down")
			},
		}).reads,
	)
	assert.ok(row)
	assert.equal(row.titles[0].move, null)
	assert.equal(row.titles[0].backdrop, null)
	assert.equal(row.titles[0].poster, "/p1.jpg")
	assert.equal(row.titles[0].year, 2025)
})

test("the social read asks for exactly the board's titles, with social identities", () => {
	const { sql, params } = socialQuery(
		[
			{ mediaType: "movie", tmdbId: 1147572 },
			{ mediaType: "show", tmdbId: 1396 },
		],
		[],
	)
	assert.deepEqual(params, ["movie", 1147572, "tv", 1396])
	assert.equal(sql.match(/\?/g)?.length, 4)
	for (const filter of [
		"l.hidden_at IS NULL",
		"p.deleted_at IS NULL",
		"INTERVAL '30 days'",
		"l.content_hash = p.content_hash",
		"r.report_id IS NULL",
		"r.status IN ('open', 'confirmed')",
		"duplicate_rank = 1",
	])
		assert.ok(sql.includes(filter), filter)
	// The content-quality gate, as an inner join, the same as the title section's read.
	assert.match(
		sql,
		/\n\s+JOIN doc\.social_content_quality q ON q\.post_id = p\.post_id AND q\.content_hash = p\.content_hash\s+AND q\.version = 'content-quality-1' AND q\.status = 'pass'/,
	)
	assert.ok(!sql.includes("LEFT JOIN doc.social_content_quality"))
	assert.ok(!sql.includes("l.lane NOT IN"))
	const lanes = socialQuery(
		[{ mediaType: "movie", tmdbId: 1 }],
		["vector_context", "fuzzy"],
	)
	assert.deepEqual(lanes.params, ["movie", 1, "vector_context", "fuzzy"])
	assert.ok(lanes.sql.includes("l.lane NOT IN (?, ?)"))
})

test("the row is the flag module's `row` surface, with the title section's preview list", async () => {
	const { talkedAboutNowEnabled, talkedAboutNowMode } = await import(
		"./flags.server.ts"
	)
	assert.equal(talkedAboutNowMode("row", {}), "off")
	assert.equal(
		talkedAboutNowMode("row", { TALKED_ABOUT_NOW_ROW: " On " }),
		"on",
	)
	// Each surface reads its own variable.
	assert.equal(
		talkedAboutNowMode("row", { TALKED_ABOUT_NOW_TITLE: "on" }),
		"off",
	)
	const preview = {
		TALKED_ABOUT_NOW_ROW: "preview",
		TALKED_ABOUT_NOW_PREVIEW_USERS: "u-1, u-2",
	}
	assert.equal(talkedAboutNowEnabled("row", "u-2", preview), true)
	assert.equal(talkedAboutNowEnabled("row", "u-9", preview), false)
	assert.equal(talkedAboutNowEnabled("row", null, preview), false)
	assert.equal(
		talkedAboutNowEnabled("row", null, { TALKED_ABOUT_NOW_ROW: "on" }),
		true,
	)
})

test("a wrong-title report drops the row's shared answer, so the next request reads again", async () => {
	const { reportWrongTitle } = await import("./title-social.server.ts")
	const { fixtureSocialStore } = await import("./social-store.server.ts")
	const post = "a".repeat(64)
	const store = fixtureSocialStore({
		posts: [
			{
				post_id: post,
				source: "rss",
				url: "https://variety.com/a",
				published_at: "2026-10-13T00:00:00Z",
				text: "A",
				content_hash: "h",
			},
		],
		links: [
			{
				media_type: "movie",
				media_tmdb_id: 1,
				post_id: post,
				lane: "foreground_exact",
				content_hash: "h",
			},
		],
	})
	let readings = 0
	const counted = reads()
	const fake = {
		...counted.reads,
		snapshot: async (key: string) => {
			if (key === "current") readings++
			return counted.reads.snapshot(key)
		},
	}
	const start = Date.now()
	await getTalkedAboutNow(start, fake)
	await getTalkedAboutNow(start + 1000, fake)
	assert.equal(readings, 1)
	// SOCIAL_FIXTURE keeps the title section's cache reset out of a test run (a development store).
	const saved = process.env.SOCIAL_FIXTURE
	process.env.SOCIAL_FIXTURE = "test"
	try {
		assert.deepEqual(
			await reportWrongTitle(
				store,
				{ mediaType: "movie", tmdbId: 1 },
				post,
				"",
			),
			{
				status: "hidden",
				reportId: (await import("./social-store.server.ts")).reportId(
					{ mediaType: "movie", tmdbId: 1 },
					post,
				),
			},
		)
	} finally {
		if (saved === undefined)
			Reflect.deleteProperty(process.env, "SOCIAL_FIXTURE")
		else process.env.SOCIAL_FIXTURE = saved
	}
	await getTalkedAboutNow(start + 2000, fake)
	assert.equal(readings, 2)
})
