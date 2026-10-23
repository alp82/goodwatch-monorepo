import assert from "node:assert/strict"
import { afterEach, test } from "node:test"
import { answerEpisodeScoreRequest } from "./episode-score-request.server.ts"
import { setEpisodeScoreDbForTest } from "./episode-scores.server.ts"
import { EpisodeScoreFakeDb } from "./episode-scores.test-support.ts"

const SHOW = 1396
function fake() {
	const db = new EpisodeScoreFakeDb()
	db.addEpisode(SHOW, 62085, 1, 1)
	db.addEpisode(SHOW, 62161, 2, 1)
	setEpisodeScoreDbForTest(db)
	return db
}
afterEach(() => setEpisodeScoreDbForTest())

test("a member sets and clears a season and an episode score", async () => {
	const db = fake()
	const season = await answerEpisodeScoreRequest("member", {
		id: SHOW,
		scope: "season",
		season: 2,
		score: 7,
	})
	assert.equal(season.status, 200)
	assert.deepEqual(
		{
			status: season.body.status,
			previous: season.body.previous,
			key: season.body.score?.key,
		},
		{ status: "saved", previous: null, key: "s2" },
	)
	const episode = await answerEpisodeScoreRequest("member", {
		id: SHOW,
		scope: "episode",
		episodeId: 62085,
		score: 9,
	})
	assert.equal(episode.body.score?.key, "e62085")
	assert.equal(db.scores.length, 2)
	const cleared = await answerEpisodeScoreRequest("member", {
		id: SHOW,
		scope: "episode",
		episodeId: 62085,
		score: null,
	})
	assert.deepEqual(
		{ status: cleared.body.status, previous: cleared.body.previous },
		{ status: "cleared", previous: 9 },
	)
	assert.equal(db.scores.length, 1)
})

test("a visitor is asked to sign in, and nothing is written", async () => {
	const db = fake()
	const answer = await answerEpisodeScoreRequest(null, {
		id: SHOW,
		scope: "season",
		season: 1,
		score: 7,
	})
	assert.equal(answer.status, 401)
	assert.equal(db.scores.length, 0)
})

test("a request that names no season, episode or part, or a score outside 1 to 10, is refused", async () => {
	const db = fake()
	for (const body of [
		null,
		"text",
		{ id: SHOW, scope: "season", season: 1 },
		{ id: SHOW, scope: "season", season: 1, score: 0 },
		{ id: SHOW, scope: "season", season: 1, score: 7.5 },
		{ id: SHOW, scope: "season", season: 1, score: 11 },
		{ id: 0, scope: "season", season: 1, score: 7 },
		{ id: "1396", scope: "season", season: 1, score: 7 },
		{ id: SHOW, scope: "season", season: 0, score: 7 },
		{ id: SHOW, scope: "episode", score: 7 },
		{ id: SHOW, scope: "part", key: "s1", score: 7 },
		{ id: SHOW, scope: "show", score: 7 },
	]) {
		const answer = await answerEpisodeScoreRequest("member", body)
		assert.equal(answer.status, 400, JSON.stringify(body))
	}
	assert.equal(db.scores.length, 0)
})

test("a season or episode that isn't in the show is not found; before the migration the feature is unavailable", async () => {
	const db = fake()
	const missing = await answerEpisodeScoreRequest("member", {
		id: SHOW,
		scope: "episode",
		episodeId: 1,
		score: 7,
	})
	assert.equal(missing.status, 404)
	db.missingTable = true
	const unavailable = await answerEpisodeScoreRequest("member", {
		id: SHOW,
		scope: "season",
		season: 1,
		score: 7,
	})
	assert.equal(unavailable.status, 503)
	assert.match(String(unavailable.body.error), /aren't available yet/)
})

test("an imported part score is changed and cleared by its key", async () => {
	const db = fake()
	db.scores.push({
		user_id: "member",
		tmdb_id: SHOW,
		score_key: "p:s1e1-12",
		scope: "part",
		season_number: 1,
		episode_number: null,
		episode_tmdb_id: null,
		ranges: JSON.stringify([{ season: 1, firstEpisode: 1, lastEpisode: 12 }]),
		label: "Part 1",
		score: 8,
		created_at: new Date(),
		updated_at: new Date(),
	})
	const changed = await answerEpisodeScoreRequest("member", {
		id: SHOW,
		scope: "part",
		key: "p:s1e1-12",
		score: 5,
	})
	assert.equal(changed.status, 200)
	assert.equal(db.scores[0].score, 5)
	const gone = await answerEpisodeScoreRequest("member", {
		id: SHOW,
		scope: "part",
		key: "p:s2e1-12",
		score: 5,
	})
	assert.equal(gone.status, 404)
	// The page drops a score that's gone instead of putting the old one back (#759 review).
	assert.equal(gone.body.gone, true)
	const season = await answerEpisodeScoreRequest("member", {
		id: SHOW,
		scope: "season",
		season: 9,
		score: 5,
	})
	assert.equal(season.status, 404)
	assert.equal(season.body.gone, undefined)
})
