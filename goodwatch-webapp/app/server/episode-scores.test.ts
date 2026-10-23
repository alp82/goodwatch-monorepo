import assert from "node:assert/strict"
import { afterEach, test } from "node:test"
import {
	EpisodeScoreTargetError,
	EpisodeScoresUnavailable,
	getEpisodeScores,
	setEpisodeScore,
	setEpisodeScoreDbForTest,
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
