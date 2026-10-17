import assert from "node:assert/strict"
import { test } from "node:test"
import type { MovieResult, ShowResult } from "../types/details-types.tsx"
import type { EpisodeGrid } from "../episode-grid.server.ts"
import {
	compactTitleDetails,
	personLink,
	titleSeasons,
} from "./title-details.ts"
import { similarTitles, titleDetails } from "./schemas.ts"

const media = {
	mediaType: "show",
	details: {
		imdb_user_score_original: 8.6,
		metacritic_meta_score_original: 81,
		metacritic_user_score_original: 7.8,
		rotten_tomatoes_tomato_score_original: 91,
		rotten_tomatoes_audience_score_original: 0,
		imdb_url: "https://www.imdb.com/title/tt1",
	},
	credits: {
		actors: Array.from({ length: 8 }, (_, id) => ({
			id: id + 1,
			name: `Actor ${id}`,
		})),
		directors: [{ id: 100, name: "Jane [Director]" }],
	},
	videos: { trailers: [{ key: "bad<script>" }, { key: "abcdefghijk" }] },
	seasons: [
		{ season_number: 1, episode_count: 4 },
		{ season_number: 2, episode_count: 3 },
	],
} as ShowResult
const scores = {
	imdb: { score: 8, count: 100 },
	tmdb: null,
	tomatometer: null,
	popcornmeter: null,
	metascore: null,
	metacriticUser: null,
}
const grid: EpisodeGrid = {
	showId: 1,
	seasons: [
		{
			number: 1,
			episodes: [1, 2, 4].map((number) => ({
				number,
				name: `Episode ${number}`,
				score: 8 + number / 10,
				votes: 100,
			})),
			maxEpisodeNumber: 4,
			scores,
		},
	],
	specials: [],
	maxEpisodeNumber: 4,
	hasEpisodeZero: false,
	providers: ["imdb"],
}

test("Detail includes default compactly and validates episode-specific parameters", () => {
	assert.deepEqual(titleDetails.parse({ title_id: "show:1" }).include, [
		"cast",
		"scores",
		"analysis",
	])
	assert.ok(titleDetails.safeParse({ title_id: "show:1", include: [] }).success)
	assert.ok(
		titleDetails.safeParse({
			title_name: "Local",
			year: 2020,
			include: ["episodes"],
			season_number: 0,
			episode_limit: 50,
			episode_cursor: "offset:2",
		}).success,
	)
	for (const args of [
		{ include: ["DNA"] },
		{ include: ["episodes"], episode_limit: 51 },
		{ include: ["episodes"], episode_cursor: "offset:-1" },
		{ include: ["seasons"], season_number: 1 },
		{ include: ["episodes"], season_number: -2 },
		{ episode_cursor: "offset:1" },
		{ include: [], episode_limit: 2 },
		{ include: ["episodes"], extra: true },
	])
		assert.equal(
			titleDetails.safeParse({ title_id: "show:1", ...args }).success,
			false,
			JSON.stringify(args),
		)
})
test("Similar tool params default to For you everywhere, seen included; selectors and bounds stay strict", () => {
	const args = similarTitles.parse({ title_id: "movie:1" })
	assert.equal(args.for_you, true)
	assert.equal(args.exclude_seen, false)
	assert.equal(args.kind, "all")
	assert.equal(args.limit, 40)
	assert.ok(
		similarTitles.safeParse({
			title_name: "Arrival",
			year: 2016,
			for_you: false,
			exclude_seen: true,
			kind: "movie",
			cursor: "offset:2",
			limit: 1,
		}).success,
	)
	for (const args of [
		{},
		{ title_id: "movie:1", title_name: "Arrival" },
		{ title_id: "movie:1", kind: "tv" },
		{ title_id: "movie:1", limit: 41 },
		{ title_id: "movie:1", cursor: "ranked:abc:0" },
		{ title_id: "movie:1", order: "similarity" },
	])
		assert.equal(similarTitles.safeParse(args).success, false)
})
test("Compact title details preserve provider scales, five billed actors, linked crew and safe trailer", () => {
	const result = compactTitleDetails(media, "https://goodwatch.app", {})
	assert.equal(result.cast?.length, 5)
	assert.equal(result.scores?.imdb.score, 8.6)
	assert.equal(result.scores?.imdb.out_of, 10)
	assert.equal(result.scores?.metacritic_critics.out_of, 100)
	assert.equal(result.scores?.metacritic_audience.out_of, 10)
	assert.equal(result.scores?.rotten_tomatoes_audience.score, null)
	assert.equal(
		result.trailer_url,
		"https://www.youtube.com/watch?v=abcdefghijk",
	)
	assert.equal(
		result.directors?.[0].url,
		"https://goodwatch.app/person/100-jane-director",
	)
	assert.match(
		personLink({ id: 1, name: "A [B]" }, "https://goodwatch.app").link,
		/\\\[B\\\]/,
	)
	assert.deepEqual(
		Object.keys(
			compactTitleDetails(media, "https://goodwatch.app", { include: [] }),
		),
		["trailer_url"],
	)
})
test("Season scores use the site's grid, missing scores stay null, episode paging is separate and never fills gaps", () => {
	const result = titleSeasons(media, grid, {
		include: ["seasons", "episodes"],
		episode_limit: 2,
	})
	assert.equal(result.seasons?.length, 2)
	assert.deepEqual(result.seasons?.[0].scores, scores)
	assert.equal(result.seasons?.[1].scores, null)
	assert.deepEqual(
		result.episodes?.items.map((e) => e.episode_number),
		[1, 2],
	)
	assert.equal(result.episodes?.next_cursor, "offset:2")
	const page = titleSeasons(media, grid, {
		include: ["episodes"],
		episode_limit: 2,
		episode_cursor: "offset:2",
	})
	assert.deepEqual(
		page.episodes?.items.map((e) => e.episode_number),
		[4],
	)
	assert.equal(page.episodes?.next_cursor, null)
	assert.equal(
		titleSeasons(media, grid, { include: ["episodes"], season_number: 2 })
			.episodes?.total,
		0,
	)
	assert.equal(
		titleSeasons(media, null, { include: ["episodes"] }).episodes?.total,
		0,
	)
})
test("Reviewed presentation seasons do not borrow unrelated TMDB labels or counts", () => {
	const result = titleSeasons(
		media,
		{
			...grid,
			presentationVersion: "reviewed-v1",
			seasons: [{ ...grid.seasons[0], number: 3 }],
		},
		{ include: ["seasons"] },
	)
	assert.equal(result.seasons?.length, 1)
	assert.equal(result.seasons?.[0].season_number, 3)
	assert.equal(result.seasons?.[0].catalog_episode_count, null)
})

test("Additional episodes keep their website label/order and accept their displayed season filter", () => {
	const additional = {
		...grid,
		presentationVersion: "v1",
		seasons: [...grid.seasons, { ...grid.seasons[0], number: -1 }],
	}
	const result = titleSeasons(media, additional, {
		include: ["seasons", "episodes"],
		season_number: -1,
	})
	assert.equal(
		result.seasons?.[result.seasons.length - 1]?.name,
		"Additional episodes",
	)
	assert.ok(result.episodes?.items.every((e) => e.season_number === -1))
	assert.ok(
		titleDetails.safeParse({
			title_id: "show:1",
			include: ["episodes"],
			season_number: -1,
		}).success,
	)
})
