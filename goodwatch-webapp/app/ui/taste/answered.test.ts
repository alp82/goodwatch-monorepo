import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { EXCLUDE_LIMIT, accountAnsweredKeys, excludeIdsFor } from "./answered.ts"

const at = { updatedAt: new Date(0) }

describe("the titles a member already answered", () => {
	it("are every title the account scored, skipped, wants to see, isn't interested in or has a watch state for", () => {
		const keys = accountAnsweredKeys({
			scores: { "show-2316": { score: 8, review: null, updatedAt: new Date(0) } },
			skipped: { "movie-603": at },
			wishlist: { "movie-11": { ...at, createdAt: new Date(0) } },
			notInterested: { "show-1396": at },
			watchState: { "movie-13": {} as never },
		})
		assert.deepEqual(
			[...keys].sort(),
			["movie-11", "movie-13", "movie-603", "show-1396", "show-2316"],
		)
	})

	it("are none before the marks arrive", () => {
		assert.equal(accountAnsweredKeys(undefined).size, 0)
		assert.equal(accountAnsweredKeys(null).size, 0)
	})
})

describe("the titles a request for more leaves out", () => {
	it("names the answered titles, then the queued ones, each once", () => {
		assert.deepEqual(excludeIdsFor(["movie-603", "show-2316"], ["show-2316", "movie-11"]), [
			{ media_type: "movie", tmdb_id: 603 },
			{ media_type: "show", tmdb_id: 2316 },
			{ media_type: "movie", tmdb_id: 11 },
		])
	})

	it("keeps only the most recent, so the request stays small", () => {
		const answered = Array.from({ length: EXCLUDE_LIMIT + 50 }, (_, i) => `movie-${i}`)
		const sent = excludeIdsFor(answered)
		assert.equal(sent.length, EXCLUDE_LIMIT)
		assert.deepEqual(sent.at(-1), { media_type: "movie", tmdb_id: EXCLUDE_LIMIT + 49 })
		assert.deepEqual(sent[0], { media_type: "movie", tmdb_id: 50 })
		assert.equal(excludeIdsFor(answered, [], 3).length, 3)
	})

	it("skips a key it can't read", () => {
		assert.deepEqual(excludeIdsFor(["nonsense", "movie-603"]), [{ media_type: "movie", tmdb_id: 603 }])
	})
})
