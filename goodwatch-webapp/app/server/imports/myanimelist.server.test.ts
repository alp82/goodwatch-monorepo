import assert from "node:assert/strict"
import { test } from "node:test"
import { gzipSync } from "node:zlib"
import { parseImportFile } from "./files.server.ts"

// Synthetic MAL/Kitsu export shapes from research #614; no member data.
const entry =
	"<anime><series_animedb_id>50602</series_animedb_id><series_title><![CDATA[Spy x Family Part 2]]></series_title><series_type>TV</series_type><series_episodes>13</series_episodes><my_watched_episodes>2</my_watched_episodes><my_status>On-Hold</my_status><my_score>8</my_score><my_times_watched>4</my_times_watched><my_start_date>2022-10-01</my_start_date><my_finish_date>0000-00-00</my_finish_date><my_comments>Private</my_comments><my_tags>Private</my_tags></anime>"
const xml = (rows: string) =>
	Buffer.from(
		`<myanimelist><myinfo><user_export_type>1</user_export_type></myinfo>${rows}</myanimelist>`,
	)

test("MAL plain XML and original gzip yield a show score, status and only reported progress with stable entry evidence", async () => {
	const plain = await parseImportFile("myanimelist", xml(entry))
	assert.deepEqual(
		await parseImportFile("myanimelist", gzipSync(xml(entry))),
		plain,
	)
	assert.equal(plain.source, "myanimelist")
	assert.deepEqual(
		plain.observations.map((row) => [
			row.kind,
			row.score,
			row.showStatus,
			row.episode,
		]),
		[
			["show_status", undefined, "on_hold", undefined],
			["rating", 8, undefined, undefined],
			["watch", undefined, undefined, 1],
			["watch", undefined, undefined, 2],
		],
	)
	assert.ok(
		plain.observations.every(
			(row) =>
				row.animeEntry?.id === 50602 &&
				row.animeEntry.progress === 2 &&
				row.animeEntry.episodeCount === 13 &&
				row.tmdbId === null,
		),
	)
	assert.ok(
		plain.observations
			.filter((row) => row.kind === "watch")
			.every(
				(row) =>
					row.pass === 1 &&
					row.watchedAt === null &&
					row.precision === "unknown",
			),
	)
	assert.match(plain.warnings.join(" "), /comments and tags/i)
	assert.match(plain.warnings.join(" "), /rewatch/i)
	assert.doesNotMatch(JSON.stringify(plain), /Private/)
})

test("Kitsu's titleless XML, On Hold spelling, zero scores and every MAL status retain their meaning", async () => {
	const statuses = [
		"Watching",
		"Completed",
		"On Hold",
		"Dropped",
		"Plan to Watch",
	]
	const rows = statuses
		.map(
			(status, i) =>
				`<anime><series_animedb_id>${100 + i}</series_animedb_id><series_episodes>0</series_episodes><my_watched_episodes>0</my_watched_episodes><my_status>${status}</my_status><my_score>0</my_score></anime>`,
		)
		.join("")
	const parsed = await parseImportFile("myanimelist", xml(rows))
	assert.deepEqual(
		parsed.observations.map((row) => [
			row.showStatus,
			row.title,
			row.completionScope,
		]),
		[
			["watching", "MyAnimeList #100", undefined],
			["completed", "MyAnimeList #101", "part"],
			["on_hold", "MyAnimeList #102", undefined],
			["dropped", "MyAnimeList #103", undefined],
			["plan_to_watch", "MyAnimeList #104", undefined],
		],
	)
	assert.ok(
		parsed.observations.every(
			(row) => row.animeEntry?.episodeCount === undefined,
		),
	)
})

test("manga, malformed XML, entities, duplicate identities and unsafe expansion are rejected clearly", async () => {
	for (const [bytes, reason] of [
		[
			Buffer.from(
				"<myanimelist><myinfo><user_export_type>2</user_export_type></myinfo></myanimelist>",
			),
			/manga/i,
		],
		[Buffer.from("<myanimelist><manga/></myanimelist>"), /manga/i],
		[
			Buffer.from(
				'<!DOCTYPE myanimelist SYSTEM "file:///etc/passwd"><myanimelist/>',
			),
			/DOCTYPE/,
		],
		[xml("<anime>&unknown;</anime>"), /valid XML/],
		[xml("<anime>"), /valid XML/],
		[xml(entry + entry), /duplicate/i],
		[
			xml(
				entry.replace(
					"<my_score>8</my_score>",
					"<my_score>8</my_score><my_score>9</my_score>",
				),
			),
			/duplicate/i,
		],
		[xml("<nested>".repeat(65) + "</nested>".repeat(65)), /too complex/],
		[gzipSync(Buffer.alloc(32 * 1024 * 1024 + 1, 32)), /32 MB/],
		[gzipSync(xml(entry)).subarray(0, -4), /corrupt/],
		[Buffer.alloc(20 * 1024 * 1024 + 1), /20 MB/],
		[
			xml(
				entry.replace("<my_watched_episodes>2", "<my_watched_episodes>50000"),
			),
			/50,000/,
		],
	] as const)
		await assert.rejects(parseImportFile("myanimelist", bytes), reason)
})

test("invalid entry numbers and scores stay visible and movie/music entries cannot masquerade as shows", async () => {
	for (const [from, to, reason] of [
		["<series_animedb_id>50602", "<series_animedb_id>0", /id/i],
		["<my_watched_episodes>2", "<my_watched_episodes>-1", /progress/i],
		["<my_watched_episodes>2", "<my_watched_episodes>2.5", /progress/i],
		["<my_watched_episodes>2", "<my_watched_episodes>NaN", /progress/i],
		["<series_episodes>13", "<series_episodes>-1", /episode count/i],
		["<series_type>TV", "<series_type>Movie", /movie/i],
		["<series_type>TV", "<series_type>Music", /music/i],
	] as const) {
		const parsed = await parseImportFile(
			"myanimelist",
			xml(entry.replace(from, to)),
		)
		assert.ok(parsed.observations.length > 0)
		assert.ok(
			parsed.observations.every(
				(row) => row.problem && reason.test(row.problem.reason),
			),
		)
	}
	for (const score of ["eleven", "11", "-1", "7.5"]) {
		const parsed = await parseImportFile(
			"myanimelist",
			xml(entry.replace("<my_score>8", `<my_score>${score}`)),
		)
		assert.equal(
			parsed.observations.find((row) => row.kind === "rating")?.problem
				?.outcome,
			"invalid",
		)
		assert.equal(
			parsed.observations.filter((row) => row.kind === "watch").length,
			2,
		)
	}
	const badStatus = await parseImportFile(
		"myanimelist",
		xml(entry.replace("On-Hold", "toString")),
	)
	assert.equal(
		badStatus.observations.find((row) => row.kind === "show_status")?.problem
			?.outcome,
		"invalid",
	)
})
