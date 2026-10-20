import assert from "node:assert/strict"
import { test } from "node:test"
import { parseImportFile } from "./files.server.ts"
import { officialAncillaryFiles } from "./tvtime-official-archive.test-support.ts"
import { zipFixture } from "./zip-fixture.test-support.ts"

// Synthetic records, written from the headers in research/tv-time-exports
// (b202e111). No third-party fixtures or member data are used.
test("official movie intents without a name retain their evidence and explain the missing title", async () => {
	const parsed = await parseImportFile(
		"tvtime",
		Buffer.from(
			"type,entity_type,uuid,movie_name,release_date,created_at\nfollow,movie,synthetic-nameless-follow,,2001-02-03 00:00:00,2024-04-05 12:00:00\nwatch,movie,synthetic-nameless-watch,,2002-03-04 00:00:00,2024-05-06 12:00:00\n",
		),
		undefined,
		"tracking-prod-records.csv",
	)
	assert.deepEqual(
		parsed.observations.map((row) => [
			row.kind,
			row.mediaType,
			row.title,
			row.problem?.outcome,
			row.problem?.code,
		]),
		[
			[
				"want",
				"movie",
				"TV Time movie",
				"unmatched",
				"tvtime_movie_title_missing",
			],
			[
				"watch",
				"movie",
				"TV Time movie",
				"unmatched",
				"tvtime_movie_title_missing",
			],
		],
	)
	assert.deepEqual(
		parsed.observations.map((row) => row.tvtimeMovie?.releaseDate),
		["2001-02-03 00:00:00", "2002-03-04 00:00:00"],
	)
	assert.ok(
		parsed.observations.every(
			(row) => row.tvtimeMovie?.sourceId && !row.wishlistOriginal,
		),
	)
})

test("TV Time GDPR episode plays keep TVDB evidence and zone-less viewing days", async () => {
	const parsed = await parseImportFile(
		"tvtime",
		zipFixture({
			"gdpr-data/tracking-prod-records-v2.csv":
				"key,s_id,ep_id,s_no,ep_no,created_at,series_name\nwatch-episode-one,100,200,4,24,2024-11-02 11:53:58,Synthetic show\nrewatch-episode-one-1,100,200,4,24,2025-02-03 10:20:30,Synthetic show\n",
		}),
	)
	assert.equal(parsed.source, "tvtime")
	assert.deepEqual(
		parsed.observations.map((row) => [
			row.kind,
			row.showTvdbId,
			row.episodeTvdbId,
			row.season,
			row.episode,
			row.episodeNumbering,
			row.watchedAt,
			row.precision,
		]),
		[
			["watch", 100, 200, 4, 24, "unknown", "2024-11-02", "day"],
			["watch", 100, 200, 4, 24, "unknown", "2025-02-03", "day"],
		],
	)
})

test("TV Time official flags and movie plays preserve intentions and every distinct play", async () => {
	const parsed = await parseImportFile(
		"tvtime",
		zipFixture({
			"hash-tracking_prod_records_v2.csv":
				"key,s_id,ep_id,s_no,ep_no,episode_id,season_number,episode_number,created_at,is_archived,is_for_later,is_followed,bulk_type\nwatch-episode-old,100,,0,0,201,4,19,2024-11-02 11:53:58,,,,season\nuser-series-one,100,,,,,,,2024-01-01 00:00:00,true,false,true,\nuser-series-two,101,,,,,,,2024-01-01 00:00:00,false,true,true,\nuser-series-three,102,,,,,,,2024-01-01 00:00:00,false,false,true,\n",
			"gdpr-data/tracking-prod-records.csv":
				"type,entity_type,uuid,movie_name,release_date,watch_date_range_key,created_at\nwatch,movie,m1,Synthetic movie,2000-03-04,watch-date-1649590015,2022-04-10 11:26:55\nrewatch,movie,m1,Synthetic movie,2000-03-04,watch-date-1681126015,2023-04-10 11:26:55\ntowatch,movie,m2,Another movie,0001-01-01,,2023-04-10 11:26:55\n",
		}),
	)
	assert.deepEqual(
		[
			...parsed.observations.filter((r) => r.mediaType === "show"),
			...parsed.observations.filter((r) => r.mediaType === "movie"),
		].map((r) => [
			r.kind,
			r.showStatus,
			r.mediaType,
			r.episodeTvdbId,
			r.watchedAt,
			r.precision,
		]),
		[
			["watch", undefined, "show", 201, null, "unknown"],
			["show_status", "dropped", "show", undefined, undefined, undefined],
			["want", undefined, "show", undefined, undefined, undefined],
			["want", undefined, "show", undefined, undefined, undefined],
			[
				"watch",
				undefined,
				"movie",
				undefined,
				"2022-04-10T11:26:55.000Z",
				"moment",
			],
			[
				"watch",
				undefined,
				"movie",
				undefined,
				"2023-04-10T11:26:55.000Z",
				"moment",
			],
			["want", undefined, "movie", undefined, undefined, undefined],
		],
	)
	assert.equal(
		parsed.observations.find((r) => r.title === "Another movie")?.year,
		null,
	)
	assert.ok(
		parsed.observations
			.filter((r) => r.kind === "want")
			.every((r) => r.wishlistEvidence?.source === "tvtime"),
	)
})

test("TV Time extension CSVs import watched episodes, statuses, IMDb movies and wishes", async () => {
	const parsed = await parseImportFile(
		"tvtime",
		zipFixture({
			"tvtime-series-2026-07-01.csv":
				"uuid,tvdb_id,imdb_id,title,status,created_at\ns1,100,,Synthetic show,continuing,2024-01-01\ns2,101,,Later show,not_started_yet,2024-01-01\ns3,102,,Stopped show,stopped,2024-01-01\n",
			"tvtime-series-episodes-2026-07-01.csv":
				"series_tvdb_id,series_imdb_id,series_uuid,title,season,episode,tvdb_id,is_watched,watched_at,rewatch_count,special\n100,,s1,Episode,4,24,200,true,2024-11-02T11:53:58Z,12,false\n100,,s1,Unseen,4,23,201,false,,0,false\n",
			"tvtime-movies-2026-07-01.csv":
				"uuid,tvdb_id,imdb_id,title,year,created_at,watched_at,is_watched,rewatch_count\nm1,300,tt0114709,Synthetic movie,1995,2024-01-01,2024-11-02 11:53:58,true,7\nm2,301,-1,Another movie,2000,2024-01-01,,false,0\n",
		}),
	)
	assert.equal(parsed.observations.filter((r) => r.kind === "watch").length, 2)
	assert.equal(
		parsed.observations.find((r) => r.episodeTvdbId === 200)?.showTvdbId,
		100,
	)
	assert.deepEqual(
		parsed.observations
			.filter((r) => r.kind === "show_status")
			.map((r) => r.showStatus)
			.sort(),
		["dropped", "watching"],
	)
	assert.equal(parsed.observations.filter((r) => r.kind === "want").length, 2)
	assert.equal(
		parsed.observations.find((r) => r.title === "Synthetic movie")?.imdbId,
		"tt0114709",
	)
	assert.equal(
		parsed.observations.find((r) => r.title === "Another movie")?.imdbId,
		null,
	)
	assert.ok(parsed.warnings.some((w) => /rewatch counts/i.test(w.message)))
})

test("TV Time JSON and Liberator CSV keep source identity without treating computed watchlisted flags as wishes", async () => {
	const parsed = await parseImportFile(
		"tvtime",
		zipFixture({
			"shows.json": JSON.stringify([
				{
					uuid: "s1",
					id: { tvdb: 100, imdb: "-1" },
					title: "Synthetic show",
					status: "up_to_date",
					seasons: [
						{
							number: 4,
							episodes: [
								{
									id: { tvdb: 200 },
									number: 24,
									is_watched: true,
									watched_at: "2024-01-02T12:00:00.123Z",
									rating: 8,
								},
								{ id: { tvdb: 201 }, number: 23, is_watched: false },
							],
						},
					],
				},
			]),
			"movies.json": JSON.stringify([
				{
					uuid: "m1",
					id: { tvdb: 300, imdb: "tt0114709" },
					title: "Synthetic movie",
					is_watched: true,
					watched_at: null,
					rating: 8,
					rewatch_count: 2,
				},
			]),
		}),
	)
	assert.equal(parsed.observations.filter((r) => r.kind === "watch").length, 2)
	assert.equal(parsed.observations.filter((r) => r.kind === "want").length, 0)
	assert.equal(parsed.observations.find((r) => r.kind === "rating")?.score, 8)
	assert.equal(
		parsed.observations.find((r) => r.episodeTvdbId === 200)?.showTvdbId,
		100,
	)
	assert.ok(
		parsed.observations.some(
			(r) =>
				r.problem?.outcome === "unsupported" &&
				/episode ratings/i.test(r.problem.reason),
		),
	)
	const csv = await parseImportFile(
		"tvtime",
		Buffer.from(
			"imdb_id,tvdb_id,type,title,season,episode,is_special,is_watched,watched_at,status,is_watchlisted,rating\n,100,show,Synthetic show,,,,,,continuing,true,\n,200,episode,Synthetic show,4,24,false,true,,continuing,true,8\ntt0114709,300,movie,Synthetic movie,,,false,true,,,true,8\n",
		),
		undefined,
		"activity_history.csv",
	)
	assert.equal(csv.observations.filter((r) => r.kind === "want").length, 0)
	assert.equal(csv.observations.filter((r) => r.kind === "watch").length, 2)
	assert.equal(
		csv.observations.find((r) => r.kind === "watch" && r.mediaType === "movie")
			?.precision,
		"unknown",
	)
})

test("TV Time ignores private archive payloads and keeps supplemental follows without ancillary warnings", async () => {
	const parsed = await parseImportFile(
		"tvtime",
		zipFixture({
			"gdpr-data/tracking-prod-records-v2.csv":
				"key,is_for_later\ntracking-stats,false\n",
			"gdpr-data/followed_tv_show.csv":
				"tv_show_id,tv_show_name,archived,active,created_at\n100,Later show,0,1,2024-01-01\n101,Dropped show,1,1,2024-01-01\n",
			"gdpr-data/access_token.csv": 'Never parse this,"broken CSV',
			"gdpr-data/lists-prod-lists.csv": "custom list payload is unsupported",
			"gdpr-data/ratings-live-votes.csv":
				"episode_id,movie_name,uuid,vote_key,user_id\n,Synthetic movie,m1,stars_wording_scalev2-29,private-user\n200,,e1,stars_wording_scalev2-3,private-user\n",
		}),
	)
	assert.deepEqual(
		parsed.observations
			.filter((r) => r.kind === "want" || r.kind === "show_status")
			.map((r) => [r.kind, r.showStatus, r.showTvdbId]),
		[
			["want", undefined, 100],
			["show_status", "dropped", 101],
		],
	)
	assert.ok(
		parsed.observations
			.filter((r) => r.score !== undefined)
			.every((r) => r.problem?.outcome === "unsupported"),
	)
	assert.ok(
		!parsed.warnings.some((w) =>
			/access_token|lists-prod-lists/.test(w.message),
		),
	)
	assert.ok(!JSON.stringify(parsed).includes("private-user"))
	await assert.rejects(
		parseImportFile("tvtime", zipFixture({ "access_token.csv": "secret" })),
		{ code: "tvtime_no_tracking" },
	)
})

test("TV Time collapses shared-timestamp rewatch counts while preserving distinct plays on one day", async () => {
	const parsed = await parseImportFile(
		"tvtime",
		zipFixture({
			"tracking-prod-records-v2.csv":
				"key,s_id,ep_id,s_no,ep_no,created_at\nwatch-episode-a,100,200,4,24,2024-11-02 10:00:00\nrewatch-episode-a-1,100,200,4,24,2024-11-02 10:00:00\nrewatch-episode-a-2,100,200,4,24,2024-11-02 20:00:00\n",
		}),
	)
	assert.equal(parsed.observations.length, 2)
	assert.equal(new Set(parsed.observations.map((r) => r.key)).size, 2)
	assert.ok(parsed.warnings.some((w) => /shared.*timestamp/i.test(w.message)))
	const again = await parseImportFile(
		"tvtime",
		zipFixture({
			"tracking-prod-records-v2.csv":
				"key,s_id,ep_id,s_no,ep_no,created_at\nrewatch-episode-a-1,100,200,4,24,2024-11-02 10:00:00\nrewatch-episode-a-2,100,200,4,24,2024-11-02 20:00:00\nwatch-episode-a,100,200,4,24,2024-11-02 10:00:00\n",
		}),
	)
	assert.deepEqual(
		new Set(again.observations.map((r) => r.key)),
		new Set(parsed.observations.map((r) => r.key)),
	)
})

test("TV Time rejects unrecognized, mixed or malformed exports with actionable errors", async () => {
	for (const [name, contents, code] of [
		[
			"seen_episode.csv",
			"episode_id,ts,show_name\n200,123,Show",
			"tvtime_variant_unsupported",
		],
		[
			"tv-time-export.csv",
			"type,media_type,title,season,episode\nepisode,show,Show,1,2",
			"tvtime_variant_unsupported",
		],
		["unrelated.csv", "Title,Year\nExample,2000", "tvtime_format_unknown"],
		["shows.json", "{}", "tvtime_json_shape"],
		["shows.json", "[", "tvtime_json_invalid"],
		[
			"tracking-prod-records-v2.csv",
			"key,s_id,S ID\nuser-series-one,100,101",
			"tvtime_columns_duplicate",
		],
	] as const)
		await assert.rejects(
			parseImportFile("tvtime", Buffer.from(contents), undefined, name),
			{ code },
		)
	await assert.rejects(
		parseImportFile(
			"tvtime",
			zipFixture({
				"tracking-prod-records-v2.csv": "key,s_id\ntracking-stats,100",
				"movies.json": "[]",
			}),
		),
		{ code: "tvtime_variants_mixed" },
	)
	await assert.rejects(
		parseImportFile(
			"tvtime",
			zipFixture(
				{ "tracking-prod-records-v2.csv": "key" },
				{ encrypted: "tracking-prod-records-v2.csv" },
			),
		),
		{ code: "tvtime_zip_encrypted" },
	)
	const p = await parseImportFile(
		"tvtime",
		Buffer.from(
			"key,s_id,ep_id,s_no,ep_no,created_at\nwatch-episode-a,100,200,1,2,2024-02-30 12:00:00",
		),
		undefined,
		"tracking-prod-records-v2.csv",
	)
	assert.equal(p.observations[0].precision, "unknown")
	assert.ok(p.warnings.some((w) => /without a date/.test(w.message)))
})

test("TV Time follows become wishes only before any exported episode watch, and v2 flags override older follows", async () => {
	const p = await parseImportFile(
		"tvtime",
		zipFixture({
			"followed_tv_show.csv":
				"tv_show_id,tv_show_name,active,archived\n100,First,1,0\n101,Second,1,0\n102,Third,1,1\n",
			"tracking-prod-records-v2.csv":
				"key,s_id,ep_id,s_no,ep_no,created_at,is_archived,is_for_later,is_followed\nwatch-episode-one,100,200,1,1,2024-01-01 00:00:00,,,\nuser-series-three,102,,,,,false,true,true\nuser-series-four,103,,,,,false,false,true\n",
		}),
	)
	assert.deepEqual(
		p.observations
			.filter((r) => r.kind !== "watch")
			.map((r) => [r.showTvdbId, r.kind, r.showStatus])
			.sort((a, b) => Number(a[0]) - Number(b[0])),
		[
			[100, "show_status", "watching"],
			[101, "want", undefined],
			[102, "want", undefined],
			[103, "want", undefined],
		],
	)
})

test("TV Time prefers JSON over duplicate extension CSVs and keeps malformed rows out of wishes", async () => {
	const movie = {
		uuid: "m1",
		id: { tvdb: 300, imdb: "tt0114709" },
		title: "Synthetic movie",
		is_watched: true,
		watched_at: "2024-01-01T12:00:00Z",
		rating: 8,
	}
	const p = await parseImportFile(
		"tvtime",
		zipFixture({
			"movies.json": JSON.stringify([movie]),
			"tvtime-movies-2026-07-01.csv":
				"uuid,tvdb_id,imdb_id,title,is_watched,watched_at\nm1,300,tt0114709,Synthetic movie,true,2024-01-01T12:00:00Z\n",
		}),
	)
	assert.equal(p.observations.filter((r) => r.kind === "watch").length, 1)
	assert.ok(p.warnings.some((w) => /JSON.*CSV/.test(w.message)))
	const invalid = await parseImportFile(
		"tvtime",
		Buffer.from(
			"uuid,tvdb_id,imdb_id,title,is_watched,watched_at\nm1,300,tt0114709,Example,banana,\n",
		),
		undefined,
		"tvtime-movies-2026-07-01.csv",
	)
	assert.equal(invalid.observations.length, 1)
	assert.equal(invalid.observations[0].problem?.outcome, "invalid")
	const unknown = await parseImportFile(
		"tvtime",
		Buffer.from("uuid,tvdb_id,imdb_id,title,status\ns1,100,,Example,unknown\n"),
		undefined,
		"tvtime-series-2026-07-01.csv",
	)
	assert.equal(unknown.observations[0].problem?.outcome, "unsupported")
})

test("TV Time omits unwatched episode rows before applying the import row limit", async () => {
	const episodes = Array.from({ length: 50001 }, (_, i) => ({
		id: { tvdb: i + 1 },
		number: i + 1,
		is_watched: false,
	}))
	const file = Buffer.from(
		JSON.stringify([
			{
				id: { tvdb: 100 },
				uuid: "s1",
				title: "Show",
				status: "continuing",
				seasons: [{ number: 1, episodes }],
			},
		]),
	)
	const parsed = await parseImportFile("tvtime", file, undefined, "shows.json")
	assert.equal(parsed.observations.length, 1)
	assert.equal(parsed.observations[0].showStatus, "watching")
	assert.ok(parsed.warnings.some((w) => /50001 unwatched/.test(w.message)))
	const csv = [
		"series_tvdb_id,title,season,episode,tvdb_id,is_watched,watched_at\n",
		"100,Show,1,1,200,false,\n".repeat(50001),
		"100,Show,1,2,201,true,2024-01-01\n",
	].join("")
	const fromCsv = await parseImportFile(
		"tvtime",
		Buffer.from(csv),
		undefined,
		"tvtime-series-episodes-2026-07-01.csv",
	)
	assert.equal(fromCsv.observations.length, 1)
	assert.equal(fromCsv.observations[0].episodeTvdbId, 201)
})

test("TV Time never promotes an unidentified episode to a whole-show watch, and keeps zero watches out of legacy overlap", async () => {
	const p = await parseImportFile(
		"tvtime",
		zipFixture({
			"tracking-prod-records-v2.csv":
				"key,s_id,ep_id,s_no,ep_no,created_at\nwatch-episode-one,100,200,1,1,2024-01-01 00:00:00\nwatch-episode-missing,100,,,,2024-01-02 00:00:00\n",
			"tracking-prod-records.csv":
				"type,entity_type,uuid,series_id,episode_id,season_number,episode_number,created_at\nwatch,episode,e1,legacy-series,200,1,1,2024-01-01 00:00:00\n",
		}),
	)
	assert.equal(p.observations.length, 2)
	assert.equal(
		p.observations.find((r) => r.episodeTvdbId === null)?.problem?.outcome,
		"unmatched",
	)
	assert.ok(p.warnings.some((w) => /shared.*timestamp/i.test(w.message)))
})

test("TV Time accepts renamed loose files with normalized headers and numeric JSON years", async () => {
	const csv = await parseImportFile(
		"tvtime",
		Buffer.from(
			'\uFEFFTitle, IMDb ID, TVDB ID, Is Watched, Watched At,Year,Unused\r\n"Synthetic, movie",tt0114709,300,true,2024-01-01 12:00:00,1995,ignored\r\n',
		),
		undefined,
		"my-export.csv",
	)
	assert.equal(csv.observations[0].mediaType, "movie")
	assert.equal(csv.observations[0].precision, "day")
	const json = await parseImportFile(
		"tvtime",
		Buffer.from(
			JSON.stringify([
				{
					uuid: "m1",
					title: "Synthetic movie",
					id: { imdb: "tt0114709", tvdb: 300 },
					is_watched: false,
					year: 1995,
				},
			]),
		),
	)
	assert.equal(json.observations[0].year, 1995)
	assert.equal(json.observations[0].kind, "want")
})

test("TV Time duplicate undated records retain one watch instead of suppressing both at preview", async () => {
	const p = await parseImportFile(
		"tvtime",
		Buffer.from(
			"uuid,tvdb_id,imdb_id,title,is_watched,watched_at\nm1,300,tt0114709,Movie,true,\nm1,300,tt0114709,Movie,true,\n",
		),
		undefined,
		"tvtime-movies-2026-07-01.csv",
	)
	assert.equal(p.observations.length, 1)
	assert.equal(p.observations[0].precision, "unknown")
})

test("TV Time official movie play IDs preserve separate undated rewatches", async () => {
	const p = await parseImportFile(
		"tvtime",
		Buffer.from(
			"type,entity_type,uuid,type-uuid-n,movie_name,created_at\nrewatch,movie,m1,rewatch-m1-1,Movie,\nrewatch,movie,m1,rewatch-m1-2,Movie,\n",
		),
		undefined,
		"tracking-prod-records.csv",
	)
	assert.equal(p.observations.length, 2)
	assert.equal(new Set(p.observations.map((r) => r.key)).size, 2)
	assert.ok(p.observations.every((r) => r.precision === "unknown"))
})

test("official movie snapshots use the final stable play key after timestamp collapse", async () => {
	const p = await parseImportFile(
		"tvtime",
		Buffer.from(
			"type,entity_type,uuid,type-uuid-n,movie_name,release_date,created_at\nrewatch,movie,m1,rewatch-m1-z,Localized,1995-11-22,2024-01-01 12:00:00\nrewatch,movie,m1,rewatch-m1-a,Localized,1995-11-22,2024-01-01 12:00:00\n",
		),
		undefined,
		"tracking-prod-records.csv",
	)
	assert.equal(p.observations.length, 1)
	assert.equal(p.observations[0].key, p.observations[0].wishlistOriginal?.key)
	assert.equal(
		p.observations[0].wishlistOriginal?.tvtimeMovie?.releaseDate,
		"1995-11-22",
	)
})

test("only Liberator movie scores use the verified scale; extension show scores and TV Time Out scores stay unapplied", async () => {
	const show = await parseImportFile(
		"tvtime",
		Buffer.from(
			JSON.stringify([
				{
					id: { tvdb: 100 },
					uuid: "s1",
					title: "Show",
					status: "continuing",
					rating: 8,
					seasons: [],
				},
			]),
		),
		undefined,
		"shows.json",
	)
	assert.equal(
		show.observations.find((row) => row.score === 8)?.problem?.code,
		"tvtime_show_rating_unsupported",
	)
	assert.ok(!show.observations.some((row) => row.kind === "rating"))
	const movie = {
		id: { tvdb: 300, imdb: "tt0114709" },
		uuid: "m1",
		title: "Movie",
		is_watched: true,
		rating: 8,
	}
	for (const name of ["tvtime-movies-2026-07-01.json", "unknown.json"]) {
		const parsed = await parseImportFile(
			"tvtime",
			Buffer.from(JSON.stringify([movie])),
			undefined,
			name,
		)
		assert.equal(
			parsed.observations.find((row) => row.score === 8)?.problem?.code,
			"tvtime_rating_scale_unknown",
		)
		assert.ok(!parsed.observations.some((row) => row.kind === "rating"))
	}
	const csv = await parseImportFile(
		"tvtime",
		Buffer.from(
			"uuid,tvdb_id,imdb_id,title,is_watched,rating\nm1,300,tt0114709,Movie,true,8\n",
		),
		undefined,
		"tvtime-movies-2026-07-01.csv",
	)
	assert.equal(
		csv.observations.find((row) => row.score === 8)?.problem?.code,
		"tvtime_rating_scale_unknown",
	)
	const invalid = await parseImportFile(
		"tvtime",
		Buffer.from(JSON.stringify([{ ...movie, rating: 3 }])),
		undefined,
		"movies.json",
	)
	assert.match(
		invalid.observations.find((row) => row.score === 3)?.problem?.reason ?? "",
		/isn't on TV Time's rating scale/,
	)
})

test("TV Time ZIP failures distinguish password detection from a generic unreadable archive", async () => {
	await assert.rejects(
		parseImportFile(
			"tvtime",
			Buffer.from("broken archive"),
			undefined,
			"gdpr-data.zip",
		),
		{ code: "tvtime_zip_unreadable" },
	)
	await assert.rejects(
		parseImportFile(
			"tvtime",
			zipFixture(
				{ "tracking-prod-records-v2.csv": "key\ntracking-stats\n" },
				{ encrypted: "tracking-prod-records-v2.csv" },
			),
		),
		{
			code: "tvtime_zip_encrypted",
			message:
				"This TV Time ZIP is password-protected. Open it on your computer with its password, then upload its CSV files in a new ZIP without a password, or upload tracking-prod-records-v2.csv by itself.",
		},
	)
	await assert.rejects(
		parseImportFile("tvtime", Buffer.from("PKinvalid archive")),
		{
			code: "tvtime_zip_unreadable",
			message:
				"GoodWatch couldn't open this TV Time ZIP. Check the file and try again.",
		},
	)
})

test("official TV Time movie country survives in immutable matching evidence", async () => {
	const parsed = await parseImportFile(
		"tvtime",
		Buffer.from(
			"type,entity_type,uuid,movie_name,release_date,country\nfollow,movie,synthetic,Synthetic movie,2001-02-03,de\n",
		),
		undefined,
		"tracking-prod-records.csv",
	)
	assert.equal(parsed.observations[0].tvtimeMovie?.country, "DE")
	assert.equal(
		parsed.observations[0].wishlistOriginal?.tvtimeMovie?.country,
		"DE",
	)
})

test("TV Time official archives skip 51 ancillary files without warnings", async () => {
	const files = {
		"tracking-prod-records-v2.csv":
			"key,s_id,ep_id,s_no,ep_no,created_at\nwatch-episode-a,100,200,1,1,2024-01-01\n",
		"tracking-prod-records.csv":
			"type,entity_type,uuid,movie_name,created_at\n",
		"followed_tv_show.csv": "tv_show_id,tv_show_name,active,archived\n",
		"user_tv_show_data.csv": "tv_show_id,tv_show_name,active,archived\n",
		"ratings-live-votes.csv": "vote_key,uuid\n",
		...Object.fromEntries(
			officialAncillaryFiles.map((name) => [
				`gdpr-data/${name}`,
				'Never parse this,"broken CSV',
			]),
		),
	}
	const parsed = await parseImportFile("tvtime", zipFixture(files))
	assert.equal(parsed.observations.length, 1)
	assert.deepEqual(parsed.warnings, [])
})

test("TV Time keeps unread history filenames visible while skipping account data", async () => {
	const parsed = await parseImportFile(
		"tvtime",
		zipFixture({
			"tracking-prod-records-v2.csv": "key\ntracking-stats\n",
			"export/seen_history.csv": "Unread history payload",
			"export/seen_episode.csv": "Older episode layout",
			"export/tvtime-series-backup.csv": "Unknown extension layout",
			"export/ip_address.csv": 'Private,"broken',
		}),
	)
	assert.deepEqual(
		parsed.warnings.map((w) => w.message),
		[
			"TV Time history file not imported: export/seen_history.csv.",
			"TV Time history file not imported: export/seen_episode.csv.",
			"TV Time history file not imported: export/tvtime-series-backup.csv.",
		],
	)
})

test("TV Time counts distinct watches with bulk or invalid dates in one note", async () => {
	const parsed = await parseImportFile(
		"tvtime",
		zipFixture({
			"tracking-prod-records-v2.csv":
				"key,s_id,ep_id,s_no,ep_no,created_at\nwatch-episode-a,100,200,1,1,0001-01-01\nrewatch-episode-a,100,200,1,1,0001-01-01\nwatch-episode-b,100,201,1,2,invalid\nwatch-episode-c,100,202,1,3,\n",
		}),
	)
	assert.equal(parsed.observations.length, 3)
	assert.ok(parsed.observations.every((row) => row.precision === "unknown"))
	assert.deepEqual(
		parsed.warnings
			.filter((w) => /bulk|invalid/.test(w.message))
			.map((w) => w.message),
		[
			"2 TV Time watches have invalid dates or bulk marks and are imported without a date.",
		],
	)
})

test("TV Time warns for every unknown filename, including episodes and movies", async () => {
	const parsed = await parseImportFile(
		"tvtime",
		zipFixture({
			"tracking-prod-records-v2.csv":
				"key,s_id,ep_id,s_no,ep_no,created_at\nwatch-episode-a,100,200,1,1,2024-01-01\n",
			"episodes.csv": "unknown episode layout",
			"movies.csv": "unknown movie layout",
			"account-detail.csv": "unknown data",
			"ip_address_backup.csv": "not an exact known filename",
		}),
	)
	assert.equal(parsed.observations.length, 1)
	assert.deepEqual(
		parsed.warnings.map((w) => w.message),
		[
			"TV Time history file not imported: episodes.csv.",
			"TV Time history file not imported: movies.csv.",
			"TV Time history file not imported: account-detail.csv.",
			"TV Time history file not imported: ip_address_backup.csv.",
		],
	)
})
