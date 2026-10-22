import { test } from "node:test"
import assert from "node:assert/strict"
import { blendPrivateRanks } from "./continuous-member-ranking.ts"
import {
	sharedSavedContinuations,
	savedShowIds,
} from "./continuous-saved-progress.ts"
import type { MemberProgressResponse } from "../../../packages/yepwatch-contracts/continuous.ts"
const progress = (id: number | null): MemberProgressResponse => ({
	source: "goodwatch",
	shows: [
		{
			showId: 1396,
			nextEpisode: id === null ? null : { tmdbId: id, season: 1, number: 2 },
		},
	],
	limitReached: false,
})
test("Saved show discovery uses established tracking keys, not numeric catalog keys", () => {
	assert.deepEqual(
		savedShowIds({
			"show-1396": { state: "watching" },
			"movie-12": { state: "seen" },
			"2000000001396": { state: "watching" },
			"show-20": { state: "seen" },
			"show-21": { state: "not_started" },
		}),
		[1396, 20],
	)
})
test("Saved continuation requires exact common canonical next episode for every viewer", () => {
	assert.equal(sharedSavedContinuations([]).size, 0)
	assert.equal(sharedSavedContinuations([progress(10), progress(null)]).size, 0)
	assert.equal(sharedSavedContinuations([progress(10), progress(11)]).size, 0)
	assert.equal(
		sharedSavedContinuations([
			progress(10),
			{ source: "goodwatch", shows: [], limitReached: false },
		]).size,
		0,
	)
	assert.equal(
		sharedSavedContinuations([progress(10), progress(10)]).get(1396)?.tmdbId,
		10,
	)
})
test("Private rank blend preserves eligibility, equal contribution and stable base ties", () => {
	assert.deepEqual(blendPrivateRanks([1, 2, 3], []), [1, 2, 3])
	assert.deepEqual(
		blendPrivateRanks(
			[1, 2, 3],
			[
				[3, 2, 1],
				[1, 2, 3],
			],
		),
		[1, 2, 3],
	)
	assert.deepEqual(
		blendPrivateRanks(
			[1, 2, 3],
			[
				[3, 2],
				[2, 3],
			],
		),
		[2, 3],
	)
	assert.deepEqual(blendPrivateRanks([1, 2], [[3]]), [])
})
