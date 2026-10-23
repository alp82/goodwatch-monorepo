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

test("MAL plain XML and original gzip retain an entry score as a part score, status and only reported progress with stable entry evidence", async () => {
	const plain = await parseImportFile("myanimelist", xml(entry))
	assert.deepEqual(
		await parseImportFile("myanimelist", gzipSync(xml(entry))),
		plain,
	)
	assert.equal(plain.source, "myanimelist")
	const part = plain.observations.find((row) => row.score === 8)
	// The entry's score is for the entry's own episodes; the preview places its range (#759).
	assert.equal(part?.scoreScope, "part")
	assert.equal(part?.scoreLabel, "Spy x Family Part 2")
	assert.equal(part?.problem, undefined)
	assert.deepEqual(
		plain.observations.map((row) => [
			row.kind,
			row.score,
			row.showStatus,
			row.episode,
		]),
		[
			["show_status", undefined, "on_hold", undefined],
			["episode_rating", 8, undefined, undefined],
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
	assert.match(
		plain.warnings.map((w) => w.message).join(" "),
		/comments and tags/i,
	)
	assert.match(plain.warnings.map((w) => w.message).join(" "), /rewatch/i)
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
			parsed.observations.find((row) =>
				row.key.startsWith("myanimelist:rating:"),
			)?.problem?.outcome,
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

test("Kitsu XML never supplies viewing dates, even when its completion click set both dates to one day", async () => {
	const kitsu =
		"<anime><series_animedb_id>50602</series_animedb_id><series_episodes>13</series_episodes><my_watched_episodes>13</my_watched_episodes><my_status>Completed</my_status><my_start_date>2022-12-24</my_start_date><my_finish_date>2022-12-24</my_finish_date></anime>"
	const parsed = await parseImportFile("myanimelist", xml(kitsu))
	assert.ok(
		parsed.observations.every(
			(row) => !row.animeEntry?.startedAt && !row.animeEntry?.finishedAt,
		),
	)
	assert.match(
		parsed.warnings.map((w) => w.message).join(" "),
		/Kitsu.*click.*undated/i,
	)
	const renamedShape = await parseImportFile(
		"myanimelist",
		xml(
			kitsu.replace(
				"<series_episodes>",
				"<series_title>Title</series_title><series_episodes>",
			),
		),
		undefined,
		"kitsu-member-anime.xml",
	)
	assert.ok(
		renamedShape.observations.every((row) => !row.animeEntry?.startedAt),
	)
})

test("many entries sharing one start/finish day warn about click or migration dates without adding watches", async () => {
	const rows = Array.from({ length: 100 }, (_, index) =>
		entry
			.replace(">50602<", `>${index + 1}<`)
			.replace("On-Hold", "Completed")
			.replace("2022-10-01", "2022-12-24")
			.replace("0000-00-00", "2022-12-24"),
	).join("")
	const parsed = await parseImportFile("myanimelist", xml(rows))
	assert.match(
		parsed.warnings.map((w) => w.message).join(" "),
		/100 anime entries share.*day.*click or migration/i,
	)
	assert.equal(
		parsed.observations.filter((row) => row.kind === "watch").length,
		200,
	)
})
