import "../tracking-loader.test-support.ts"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { readFileSync } from "node:fs"
import { after, before, test } from "node:test"
import type { ImportItem } from "../../domain/imports.ts"
import type { Param } from "./store.server.ts"

const { setImportDbForTest } = await import("./store.server.ts")
const { applyImportedEpisodeScore, undoImportedEpisodeScore } = await import(
	"./episode-score-apply.server.ts"
)
const {
	getEpisodeScore,
	getEpisodeScores,
	restoreEpisodeScore,
	setEpisodeScore,
	setEpisodeScoreDbForTest,
	setEpisodeScoreWatchesForTest,
} = await import("../episode-scores.server.ts")

// The member's season and episode scores (#759) on a real Crate: the migration, the constraints, the missing-table
// fallback with Crate's own error, and the import journal's optimistic writes. Run against a throwaway local Crate:
// IMPORTS_TEST_CRATE_URL=http://127.0.0.1:44219 node --test app/server/imports/episode-score.integration.ts
const url = new URL(process.env.IMPORTS_TEST_CRATE_URL ?? "http://invalid")
if (
	url.protocol !== "http:" ||
	!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
	url.username ||
	url.password
)
	throw Error("IMPORTS_TEST_CRATE_URL must name a throwaway local Crate")
const schema = `episode_score_test_${randomUUID().replace(/-/g, "")}`
const named = (stmt: string) =>
	stmt
		.replace(/\bdoc\./g, `${schema}.`)
		.replace(
			/\b(FROM|INTO|UPDATE|TABLE|EXISTS)\s+(user_episode_score|episode)\b/g,
			`$1 ${schema}.$2`,
		)
async function sql(stmt: string, args: Param[] = []) {
	const response = await fetch(new URL("/_sql", url), {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ stmt: named(stmt), args }),
	})
	const result = (await response.json()) as {
		cols: string[]
		rows: unknown[][]
		rowcount: number
		error?: { message: string }
	}
	if (!response.ok) throw Error(result.error?.message ?? "Local Crate failed")
	return result
}
const db = {
	run: sql,
	async select<T extends {}>(stmt: string, args: Param[]) {
		const result = await sql(stmt, args)
		return result.rows.map((row) =>
			Object.fromEntries(result.cols.map((key, i) => [key, row[i]])),
		) as T[]
	},
}
const migration = readFileSync(
	new URL(
		"../../../../docs/implementation/imports/episode-scores-migration.sql",
		import.meta.url,
	),
	"utf8",
)
	.replace(/--.*$/gm, "")
	.split(";")
	.map((stmt) => stmt.trim())
	.filter(Boolean)

const SHOW = 1396
before(async () => {
	await sql(
		"CREATE TABLE doc.user_import_item (import_id TEXT, row_index INTEGER, user_id TEXT, kind TEXT, source_key TEXT, payload TEXT INDEX OFF STORAGE WITH (columnstore = false), outcome TEXT, apply_state TEXT, undo_outcome TEXT, PRIMARY KEY (import_id,row_index)) WITH (number_of_replicas=0)",
	)
	await sql(
		"CREATE TABLE episode (show_id INTEGER, tmdb_id INTEGER, season_number INTEGER, episode_number INTEGER, removed_at TIMESTAMP, PRIMARY KEY (tmdb_id)) WITH (number_of_replicas=0)",
	)
	await sql(
		"INSERT INTO episode (show_id,tmdb_id,season_number,episode_number) VALUES (?,?,?,?),(?,?,?,?)",
		[SHOW, 62085, 1, 1, SHOW, 62161, 2, 1],
	)
	await sql("REFRESH TABLE episode")
	setImportDbForTest(db)
	setEpisodeScoreDbForTest(db)
	// The watch an episode score records is the tracking writer's, tested with tracking.server.ts.
	setEpisodeScoreWatchesForTest({
		mark: async () => null,
		remove: async () => null,
	})
})
after(async () => {
	setImportDbForTest()
	setEpisodeScoreDbForTest()
	setEpisodeScoreWatchesForTest()
	await sql(`DROP TABLE IF EXISTS doc.user_import_item`)
	await sql("DROP TABLE IF EXISTS episode")
	await sql("DROP TABLE IF EXISTS user_episode_score")
})

function importRow(index: number, score: number, preview: unknown = null) {
	const item = {
		key: `trakt:episode-rating:${index}`,
		kind: "episode_rating",
		scoreScope: "episode",
		mediaType: "show",
		title: "Breaking Bad",
		year: 2008,
		tmdbId: SHOW,
		imdbId: null,
		season: 1,
		episode: 1,
		episodeTmdbId: 62085,
		score,
		index,
		outcome: "new",
		reason: null,
	} as ImportItem
	return { ...item, payload: { ...item, _preview: preview } }
}

test("before the migration, Crate's own missing-table error reads as no scores and a write says it's unavailable", async () => {
	assert.deepEqual(await getEpisodeScores("member", SHOW), [])
	await assert.rejects(
		setEpisodeScore("member", SHOW, { scope: "season", season: 1 }, 7),
		{ name: "EpisodeScoresUnavailable" },
	)
})

test("the migration creates the table, and its constraints refuse a score outside 1 to 10 and an unknown scope", async () => {
	for (const stmt of migration) await sql(stmt)
	await assert.rejects(
		sql(
			"INSERT INTO user_episode_score (user_id,tmdb_id,score_key,scope,score,created_at,updated_at) VALUES ('x',1,'s1','season',11,now(),now())",
		),
		/Failed CONSTRAINT|CHECK/i,
	)
	await assert.rejects(
		sql(
			"INSERT INTO user_episode_score (user_id,tmdb_id,score_key,scope,score,created_at,updated_at) VALUES ('x',1,'s1','show',5,now(),now())",
		),
		/Failed CONSTRAINT|CHECK/i,
	)
})

test("a member's season and episode scores round-trip on real Crate, and a change keeps the first date", async () => {
	await setEpisodeScore(
		"member",
		SHOW,
		{ scope: "episode", episodeTmdbId: 62161 },
		9,
	)
	await setEpisodeScore("member", SHOW, { scope: "season", season: 2 }, 6)
	await sql("REFRESH TABLE user_episode_score")
	const [first] = (
		await db.select<{ created_at: number }>(
			"SELECT created_at FROM user_episode_score WHERE score_key = 's2'",
			[],
		)
	).map((row) => row.created_at)
	await setEpisodeScore("member", SHOW, { scope: "season", season: 2 }, 8)
	await sql("REFRESH TABLE user_episode_score")
	const scores = await getEpisodeScores("member", SHOW)
	assert.deepEqual(
		scores
			.map((x) => [x.key, x.scope, x.season, x.score])
			.sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
		[
			["e62161", "episode", 2, 9],
			["s2", "season", 2, 8],
		],
	)
	const [kept] = (
		await db.select<{ created_at: number }>(
			"SELECT created_at FROM user_episode_score WHERE score_key = 's2'",
			[],
		)
	).map((row) => row.created_at)
	assert.equal(kept, first)
	await setEpisodeScore("member", SHOW, { scope: "season", season: 2 }, null)
	await setEpisodeScore(
		"member",
		SHOW,
		{ scope: "episode", episodeTmdbId: 62161 },
		null,
	)
	await sql("REFRESH TABLE user_episode_score")
	assert.deepEqual(await getEpisodeScores("member", SHOW), [])
})

test("a score is read back by its key right after it's written, before any refresh", async () => {
	for (const score of [5, 8]) {
		await setEpisodeScore(
			"fresh",
			SHOW,
			{ scope: "episode", episodeTmdbId: 62161 },
			score,
		)
		assert.equal((await getEpisodeScore("fresh", SHOW, "e62161"))?.score, score)
	}
	await setEpisodeScore(
		"fresh",
		SHOW,
		{ scope: "episode", episodeTmdbId: 62161 },
		null,
	)
	assert.equal(await getEpisodeScore("fresh", SHOW, "e62161"), null)
})

test("an undo restores the earlier score by its key only while the row is still exactly what its write left", async () => {
	const episode = { scope: "episode" as const, episodeTmdbId: 62161 }
	await setEpisodeScore("undo", SHOW, episode, 4)
	const ours = await setEpisodeScore("undo", SHOW, episode, 8)
	assert.ok(ours.score)
	const left = { score: ours.score.score, updatedAt: ours.score.updatedAt }
	// Crate keeps the stamp to the millisecond, so the write is recognized as its own.
	assert.equal(
		await restoreEpisodeScore("undo", SHOW, "e62161", left, 4),
		"restored",
	)
	assert.equal((await getEpisodeScore("undo", SHOW, "e62161"))?.score, 4)
	const again = await setEpisodeScore("undo", SHOW, episode, 8)
	assert.ok(again.score)
	// Another page clears it: the clear stays.
	await setEpisodeScore("undo", SHOW, episode, null)
	assert.equal(
		await restoreEpisodeScore(
			"undo",
			SHOW,
			"e62161",
			{ score: 8, updatedAt: again.score.updatedAt },
			4,
		),
		"changed",
	)
	assert.equal(await getEpisodeScore("undo", SHOW, "e62161"), null)
})

test("an imported episode score is written once through its journal, resumes without a second write, and Undo takes it back", async () => {
	const importId = randomUUID()
	const row = importRow(0, 9)
	await sql(
		"INSERT INTO doc.user_import_item (import_id,row_index,user_id,kind,payload) VALUES (?,?,?,?,?)",
		[importId, 0, "member", "episode_rating", JSON.stringify(row.payload)],
	)
	assert.equal(
		await applyImportedEpisodeScore("member", importId, row),
		"added",
	)
	// A resumed import finds its own write by the journal and doesn't write again.
	assert.equal(
		await applyImportedEpisodeScore("member", importId, row),
		"added",
	)
	await sql("REFRESH TABLE user_episode_score")
	assert.deepEqual(
		(await getEpisodeScores("member", SHOW)).map((x) => [x.key, x.score]),
		[["e62085", 9]],
	)
	assert.equal(
		await undoImportedEpisodeScore("member", importId, {
			...row,
			undoOutcome: null,
		}),
		"reverted",
	)
	await sql("REFRESH TABLE user_episode_score")
	assert.deepEqual(await getEpisodeScores("member", SHOW), [])
})

test("an imported score replaces the member's only through optimistic writes: a change after the preview is kept, and Undo restores the earlier score", async () => {
	await setEpisodeScore(
		"member",
		SHOW,
		{ scope: "episode", episodeTmdbId: 62085 },
		4,
	)
	await sql("REFRESH TABLE user_episode_score")
	const [stored] = await db.select<{ _seq_no: number; _primary_term: number }>(
		"SELECT _seq_no, _primary_term FROM user_episode_score WHERE user_id = ? AND score_key = 'e62085'",
		["member"],
	)
	const importId = randomUUID()
	// The preview saw an older version: the member changed the score since, so theirs stays.
	const stale = importRow(1, 9, {
		score: 3,
		seq: Number(stored._seq_no) - 1,
		term: Number(stored._primary_term),
	})
	assert.equal(
		await applyImportedEpisodeScore("member", importId, stale),
		"kept",
	)
	// The preview saw this version: the import replaces it.
	const fresh = importRow(2, 9, {
		score: 4,
		seq: Number(stored._seq_no),
		term: Number(stored._primary_term),
	})
	await sql(
		"INSERT INTO doc.user_import_item (import_id,row_index,user_id,kind,payload) VALUES (?,?,?,?,?)",
		[importId, 2, "member", "episode_rating", JSON.stringify(fresh.payload)],
	)
	assert.equal(
		await applyImportedEpisodeScore("member", importId, fresh),
		"updated",
	)
	await sql("REFRESH TABLE user_episode_score")
	assert.deepEqual(
		(await getEpisodeScores("member", SHOW)).map((x) => x.score),
		[9],
	)
	assert.equal(
		await undoImportedEpisodeScore("member", importId, {
			...fresh,
			undoOutcome: null,
		}),
		"reverted",
	)
	await sql("REFRESH TABLE user_episode_score")
	assert.deepEqual(
		(await getEpisodeScores("member", SHOW)).map((x) => x.score),
		[4],
	)
})
