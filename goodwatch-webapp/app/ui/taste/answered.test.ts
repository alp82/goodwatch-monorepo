import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
	EXCLUDE_LIMIT,
	accountAnsweredKeys,
	excludeIdsFor,
	storedAnswerIs,
} from "./answered.ts"

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

describe("storedAnswerIs", () => {
	const at = { updatedAt: new Date(0) }
	const data = {
		scores: { "movie-1": { score: 8, review: null, updatedAt: new Date(0) } },
		skipped: { "movie-2": at, "movie-3": at },
		wishlist: { "movie-3": { ...at, createdAt: new Date(0) }, "movie-4": { ...at, createdAt: new Date(0) } },
		notInterested: { "movie-5": at },
	} as never
	it("confirms only the answer the account holds", () => {
		assert.equal(storedAnswerIs(data, "movie-1", "score", 8), true)
		assert.equal(storedAnswerIs(data, "movie-1", "score", 7), false)
		assert.equal(storedAnswerIs(data, "movie-2", "skip"), true)
		assert.equal(storedAnswerIs(data, "movie-3", "plan"), true)
		assert.equal(storedAnswerIs(data, "movie-3", "skip"), false)
		assert.equal(storedAnswerIs(data, "movie-5", "not-interested"), true)
		assert.equal(storedAnswerIs(undefined, "movie-1", "score", 8), false)
	})
	it("a half-cleared Want to See is not Want to See", () => {
		// The skip was removed and the Wishlist removal failed: only the Wishlist is left.
		assert.equal(storedAnswerIs(data, "movie-4", "plan"), false)
		// The Wishlist was removed and the skip removal failed: Haven't seen it alone.
		assert.equal(storedAnswerIs(data, "movie-2", "plan"), false)
	})
})
