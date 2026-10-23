import assert from "node:assert/strict"
import { afterEach, test } from "node:test"
import {
	EpisodeScoreGone,
	EpisodeScoreTargetError,
	EpisodeScoresUnavailable,
	getEpisodeScore,
	getEpisodeScores,
	restoreEpisodeScore,
	setEpisodeScore,
	setEpisodeScoreDbForTest,
	setPartScore,
} from "./episode-scores.server.ts"
import { EpisodeScoreFakeDb } from "./episode-scores.test-support.ts"

const SHOW = 1396
function fake() {
	const db = new EpisodeScoreFakeDb()
	db.addEpisode(SHOW, 62085, 1, 1)
	db.addEpisode(SHOW, 62086, 1, 2)
	db.addEpisode(SHOW, 62161, 2, 1)
	setEpisodeScoreDbForTest(db)
	return db
}
afterEach(() => setEpisodeScoreDbForTest())

test("a member scores an episode by its TMDB id and a season by its number, and reads both back", async () => {
	const db = fake()
	const episode = await setEpisodeScore(
		"member",
		SHOW,
		{ scope: "episode", episodeTmdbId: 62086 },
		9,
	)
	assert.equal(episode.status, "saved")
	assert.equal(episode.previous, null)
	assert.deepEqual(
		{ ...episode.score, updatedAt: undefined },
		{
			scope: "episode",
			key: "e62086",
			season: 1,
			episode: 2,
			episodeTmdbId: 62086,
			score: 9,
			label: null,
			updatedAt: undefined,
		},
	)
	await setEpisodeScore("member", SHOW, { scope: "season", season: 2 }, 7)
	const scores = await getEpisodeScores("member", SHOW)
	assert.deepEqual(scores.map((x) => [x.key, x.scope, x.score]).sort(), [
		["e62086", "episode", 9],
		["s2", "season", 7],
	])
	assert.equal(db.scores.length, 2)
	// Another member's scores and another show's stay apart.
	assert.deepEqual(await getEpisodeScores("other", SHOW), [])
	assert.deepEqual(await getEpisodeScores("member", 1399), [])
})

test("changing a score keeps when it was first given, and clearing removes it", async () => {
	const db = fake()
	await setEpisodeScore("member", SHOW, { scope: "season", season: 1 }, 6)
	const created = db.scores[0].created_at
	const changed = await setEpisodeScore(
		"member",
		SHOW,
		{ scope: "season", season: 1 },
		8,
	)
	assert.equal(changed.status, "saved")
	assert.equal(changed.previous, 6)
	assert.equal(db.scores.length, 1)
	assert.equal(db.scores[0].score, 8)
	assert.equal(db.scores[0].created_at, created)
	const cleared = await setEpisodeScore(
		"member",
		SHOW,
		{ scope: "season", season: 1 },
		null,
	)
	assert.deepEqual(
		{
			status: cleared.status,
			previous: cleared.previous,
			score: cleared.score,
		},
		{ status: "cleared", previous: 8, score: null },
	)
	assert.equal(db.scores.length, 0)
	// Clearing what isn't there changes nothing.
	const again = await setEpisodeScore(
		"member",
		SHOW,
		{ scope: "season", season: 1 },
		null,
	)
	assert.equal(again.status, "unchanged")
})

test("a season or episode that isn't in the show's episode list is refused", async () => {
	const db = fake()
	await assert.rejects(
		setEpisodeScore("member", SHOW, { scope: "season", season: 9 }, 5),
		EpisodeScoreTargetError,
	)
	await assert.rejects(
		setEpisodeScore("member", SHOW, { scope: "episode", episodeTmdbId: 1 }, 5),
		EpisodeScoreTargetError,
	)
	await assert.rejects(
		setEpisodeScore("member", SHOW, { scope: "season", season: 1 }, 11),
		EpisodeScoreTargetError,
	)
	assert.equal(db.scores.length, 0)
})

test("before the migration, reads find no scores and writes say the feature isn't available", async () => {
	const db = fake()
	db.missingTable = true
	assert.deepEqual(await getEpisodeScores("member", SHOW), [])
	await assert.rejects(
		setEpisodeScore("member", SHOW, { scope: "season", season: 1 }, 7),
		EpisodeScoresUnavailable,
	)
})

test("an imported part keeps its whole range and its source name", async () => {
	const db = fake()
	db.scores.push({
		user_id: "member",
		tmdb_id: SHOW,
		score_key: "p:s1e1-2",
		scope: "part",
		season_number: 1,
		episode_number: null,
		episode_tmdb_id: null,
		ranges: JSON.stringify([{ season: 1, firstEpisode: 1, lastEpisode: 2 }]),
		label: "Show Part 1",
		score: 8,
		created_at: new Date("2026-10-01T00:00:00Z"),
		updated_at: new Date("2026-10-01T00:00:00Z"),
	})
	const [part] = await getEpisodeScores("member", SHOW)
	assert.deepEqual(part, {
		scope: "part",
		key: "p:s1e1-2",
		season: 1,
		ranges: [{ season: 1, firstEpisode: 1, lastEpisode: 2 }],
		score: 8,
		label: "Show Part 1",
		updatedAt: "2026-10-01T00:00:00.000Z",
	})
})

test("a member changes or clears an imported part score, keeping its range and name; parts aren't created by hand", async () => {
	const db = fake()
	db.scores.push({
		user_id: "member",
		tmdb_id: SHOW,
		score_key: "p:s1e1-2",
		scope: "part",
		season_number: 1,
		episode_number: null,
		episode_tmdb_id: null,
		ranges: JSON.stringify([{ season: 1, firstEpisode: 1, lastEpisode: 2 }]),
		label: "Show Part 1",
		score: 8,
		created_at: new Date("2026-10-01T00:00:00Z"),
		updated_at: new Date("2026-10-01T00:00:00Z"),
	})
	const changed = await setPartScore("member", SHOW, "p:s1e1-2", 6)
	assert.equal(changed.status, "saved")
	assert.equal(changed.previous, 8)
	assert.equal(changed.score?.score, 6)
	assert.equal(changed.score?.label, "Show Part 1")
	assert.equal(db.scores[0].score, 6)
	assert.equal(
		db.scores[0].ranges,
		JSON.stringify([{ season: 1, firstEpisode: 1, lastEpisode: 2 }]),
	)
	await assert.rejects(
		setPartScore("member", SHOW, "p:s1e3-4", 6),
		EpisodeScoreTargetError,
	)
	await assert.rejects(
		setPartScore("member", SHOW, "s1", 6),
		EpisodeScoreTargetError,
	)
	assert.equal(db.scores.length, 1)
	const cleared = await setPartScore("member", SHOW, "p:s1e1-2", null)
	assert.equal(cleared.status, "cleared")
	assert.equal(db.scores.length, 0)
})

test("one score is read by its whole key, and none before the migration", async () => {
	const db = fake()
	await setEpisodeScore("member", SHOW, { scope: "season", season: 2 }, 7)
	assert.equal((await getEpisodeScore("member", SHOW, "s2"))?.score, 7)
	assert.equal(await getEpisodeScore("member", SHOW, "s1"), null)
	assert.equal(await getEpisodeScore("other", SHOW, "s2"), null)
	db.missingTable = true
	assert.equal(await getEpisodeScore("member", SHOW, "s2"), null)
})

const EPISODE = { scope: "episode" as const, episodeTmdbId: 62086 }
/** What one write set, as an undo records it. */
const written = (result: Awaited<ReturnType<typeof setEpisodeScore>>) => ({
	score: result.score?.score ?? null,
	updatedAt: result.score?.updatedAt ?? null,
})

test("an undo puts the earlier score back only while the row is still what its write set (#759 review)", async () => {
	const db = fake()
	await setEpisodeScore("member", SHOW, EPISODE, 4)
	const ours = written(await setEpisodeScore("member", SHOW, EPISODE, 8))
	assert.equal(
		await restoreEpisodeScore("member", SHOW, EPISODE, ours, 4),
		"restored",
	)
	assert.equal((await getEpisodeScore("member", SHOW, "e62086"))?.score, 4)

	// Another tab clears it after the write: the clear stays.
	const cleared = written(await setEpisodeScore("member", SHOW, EPISODE, 8))
	db.changeElsewhere("e62086", null)
	assert.equal(
		await restoreEpisodeScore("member", SHOW, EPISODE, cleared, 4),
		"changed",
	)
	assert.equal(await getEpisodeScore("member", SHOW, "e62086"), null)

	// Another tab sets the same score again: that's its score now, not this write's.
	await setEpisodeScore("member", SHOW, EPISODE, 4)
	const same = written(await setEpisodeScore("member", SHOW, EPISODE, 8))
	db.changeElsewhere("e62086", 8, new Date(Date.now() + 1000))
	assert.equal(
		await restoreEpisodeScore("member", SHOW, EPISODE, same, 4),
		"changed",
	)
	assert.equal((await getEpisodeScore("member", SHOW, "e62086"))?.score, 8)

	// A change that lands between the check and the write wins too.
	const raced = written(await setEpisodeScore("member", SHOW, EPISODE, 9))
	db.beforeWrite = (sql) => {
		if (sql.startsWith("UPDATE")) db.changeElsewhere("e62086", 2)
	}
	assert.equal(
		await restoreEpisodeScore("member", SHOW, EPISODE, raced, 4),
		"changed",
	)
	db.beforeWrite = null
	assert.equal((await getEpisodeScore("member", SHOW, "e62086"))?.score, 2)
})

test("an undo of a clear puts the score back only while it's still gone", async () => {
	const db = fake()
	await setEpisodeScore("member", SHOW, EPISODE, 6)
	const ours = written(await setEpisodeScore("member", SHOW, EPISODE, null))
	assert.deepEqual(ours, { score: null, updatedAt: null })
	assert.equal(
		await restoreEpisodeScore("member", SHOW, EPISODE, ours, 6),
		"restored",
	)
	assert.equal((await getEpisodeScore("member", SHOW, "e62086"))?.score, 6)
	await setEpisodeScore("member", SHOW, EPISODE, null)
	await setEpisodeScore("member", SHOW, EPISODE, 3)
	assert.equal(
		await restoreEpisodeScore("member", SHOW, EPISODE, ours, 6),
		"changed",
	)
	assert.equal((await getEpisodeScore("member", SHOW, "e62086"))?.score, 3)
	assert.equal(db.scores.length, 1)
})

test("editing a part that was removed meanwhile says it's gone instead of saved (#759 review)", async () => {
	const db = fake()
	db.scores.push({
		user_id: "member",
		tmdb_id: SHOW,
		score_key: "p:s1e1-2",
		scope: "part",
		season_number: 1,
		episode_number: null,
		episode_tmdb_id: null,
		ranges: JSON.stringify([{ season: 1, firstEpisode: 1, lastEpisode: 2 }]),
		label: null,
		score: 8,
		created_at: new Date("2026-10-01T00:00:00Z"),
		updated_at: new Date("2026-10-01T00:00:00Z"),
		_seq_no: 1,
		_primary_term: 1,
	})
	// Removed on another page between the read and the write.
	db.beforeWrite = (sql) => {
		if (sql.startsWith("UPDATE")) db.scores = []
	}
	await assert.rejects(
		setPartScore("member", SHOW, "p:s1e1-2", 5),
		EpisodeScoreGone,
	)
	db.beforeWrite = null
	assert.deepEqual(db.scores, [])
	// Already gone when the edit arrives.
	await assert.rejects(
		setPartScore("member", SHOW, "p:s1e1-2", 5),
		EpisodeScoreGone,
	)
})
