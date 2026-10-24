import assert from "node:assert/strict"
import { test } from "node:test"
import { parseImportFile } from "./files.server.ts"
import { zipFixture } from "./zip-fixture.test-support.ts"

test("official TV Time episode and movie votes become scores with the same identities as their watches", async () => {
	const parsed = await parseImportFile(
		"tvtime",
		zipFixture({
			"ratings-3-prod-episode_votes.csv":
				"vote_key,episode_id,series_name,season_number,episode_number\n200-person-29,200,Synthetic show,1,2\n",
			"ratings-live-votes.csv":
				"vote_key,episode_id,uuid,movie_name\nmovie-with-hyphens-person-3,0,movie-with-hyphens,Synthetic movie\n",
			"tracking-prod-records-v2.csv":
				"key,s_id,ep_id,s_no,ep_no,series_name,created_at\nwatch-episode-one,100,200,1,2,Synthetic show,2024-01-01\n",
			"tracking-prod-records.csv":
				"type,entity_type,uuid,movie_name,release_date,created_at\nwatch,movie,movie-with-hyphens,Synthetic movie,2001-02-03,2024-01-01\n",
		}),
	)
	const episode = parsed.observations.find((r) => r.kind === "episode_rating")
	assert.equal(episode?.score, 8)
	assert.equal(episode?.episodeTvdbId, 200)
	assert.equal(episode?.showTvdbId, 100)
	assert.equal(episode?.episodeNumbering, "unknown")
	const movie = parsed.observations.find((r) => r.kind === "rating")
	assert.equal(movie?.score, 10)
	assert.equal(movie?.tvtimeMovie?.sourceId, "movie-with-hyphens")
	assert.equal(movie?.tvtimeMovie?.releaseDate, "2001-02-03")
	assert.equal(movie?.wishlistOriginal?.manualMatchScope, "tvtime_movie")
})
test("an unknown official rating ID is held and emotion files never become scores", async () => {
	const parsed = await parseImportFile(
		"tvtime",
		zipFixture({
			"ratings-live-votes.csv":
				"vote_key,episode_id,uuid,movie_name\nmovie-person-999,0,movie,Synthetic movie\n",
			"emotions-live-votes.csv":
				"vote_key,episode_id,uuid,movie_name\nmovie-person-3,0,movie,Synthetic movie\n",
		}),
	)
	assert.equal(parsed.observations.length, 1)
	assert.equal(
		parsed.observations[0].problem?.code,
		"tvtime_vote_scale_unknown",
	)
	assert.equal(parsed.observations[0].score, null)
})
