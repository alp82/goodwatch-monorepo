import assert from "node:assert/strict"
import { test } from "node:test"
import {
	episodeLinkSearch,
	findLinkedEpisode,
	parseEpisodeLink,
} from "./episode-link.ts"

test("a link names a season and an episode", () => {
	assert.equal(episodeLinkSearch(5, 14), "episode=s5e14")
	assert.deepEqual(parseEpisodeLink("?episode=s5e14"), {
		season: 5,
		episode: 14,
		name: null,
	})
	assert.deepEqual(parseEpisodeLink("?a=1&episode=S10E3"), {
		season: 10,
		episode: 3,
		name: null,
	})
})

test("a link names its episode, unless IMDb only numbers it", () => {
	const search = episodeLinkSearch(5, 14, "Ozymandias & Co.")
	assert.equal(search, "episode=s5e14&name=Ozymandias+%26+Co.")
	assert.deepEqual(parseEpisodeLink(`?${search}`), {
		season: 5,
		episode: 14,
		name: "Ozymandias & Co.",
	})
	assert.equal(episodeLinkSearch(1, 12, "Episode #1.12"), "episode=s1e12")
	assert.equal(episodeLinkSearch(1, 12, "Episode 12"), "episode=s1e12")
	assert.equal(episodeLinkSearch(1, 12, ""), "episode=s1e12")
})

test("anything else is no link", () => {
	for (const search of [
		"",
		"?episode=",
		"?episode=5x14",
		"?episode=s0e1",
		"?episode=s1e0",
		"?episode=s1e2e3",
		"?episode=s99999e1",
	])
		assert.equal(parseEpisodeLink(search), null, search)
})

const ep = (
	id: number,
	season: number,
	number: number,
	display?: [number, number],
	more: { name?: string | null; nameLanguage?: string } = {},
) => ({
	id,
	season,
	number,
	...(display ? { displaySeason: display[0], displayNumber: display[1] } : {}),
	...more,
})

const link = (season: number, episode: number, name: string | null = null) => ({
	season,
	episode,
	name,
})

test("the grid's own numbers find the episode", () => {
	const seasons = [
		{ number: 1, episodes: [ep(-1, 1, 1), ep(-2, 1, 2)] },
		// TMDB's season 2 episode 1 shows as season 2 episode 1; its episode 12 shows as season 3 episode 1.
		{ number: 2, episodes: [ep(-3, 2, 1)] },
		{ number: 3, episodes: [ep(-4, 2, 12, [3, 1])] },
	]
	assert.equal(findLinkedEpisode(seasons, link(1, 2))?.episode.id, -2)
	assert.deepEqual(findLinkedEpisode(seasons, link(3, 1)), {
		season: 3,
		episode: seasons[2].episodes[0],
	})
	assert.equal(findLinkedEpisode(seasons, link(2, 12)), null)
	assert.equal(findLinkedEpisode(seasons, link(4, 1)), null)
})

test("the numbers find the episode only when its name agrees", () => {
	const named = (name: string | null, nameLanguage?: string) => [
		{
			number: 3,
			episodes: [ep(-1, 3, 9, undefined, { name, nameLanguage })],
		},
	]
	const opens = (shown: string | null, linked: string | null, lang?: string) =>
		findLinkedEpisode(named(shown, lang), link(3, 9, linked))?.episode.id ??
		null
	// The same title, however it is written.
	assert.equal(opens("The Rains of Castamere", "the rains of castamere!"), -1)
	assert.equal(opens("Café Society", "Cafe Society"), -1)
	assert.equal(opens("Rains of Castamere", "The Rains of Castamere"), -1)
	assert.equal(opens("The Freelancer (No. 145)", "The Freelancer"), -1)
	// Either side only numbers it, or the link has no name: the numbers decide.
	assert.equal(opens("Episode #3.9", "The Rains of Castamere"), -1)
	assert.equal(opens("The Rains of Castamere", "Episode #3.9"), -1)
	assert.equal(opens("Episode 9", "Episode #3.9"), -1)
	assert.equal(opens("", "The Rains of Castamere"), -1)
	assert.equal(opens("The Rains of Castamere", null), -1)
	// A translation can't be held against IMDb's title.
	assert.equal(
		opens("Der Regen von Castamere", "The Rains of Castamere", "de"),
		-1,
	)
	assert.equal(
		opens("The Rains of Castamere", "The Rains of Castamere", "und"),
		-1,
	)
	// Another episode under the same numbers: nothing opens.
	assert.equal(opens("Mhysa", "The Rains of Castamere"), null)
	assert.equal(opens("Mhysa", "The Rains of Castamere", "en"), null)
	assert.equal(opens("Pilot (Part 2)", "Pilot"), null)
})

test("a translated list name is not held against the link", () => {
	const seasons = [
		{
			number: 1,
			episodes: [
				{
					...ep(7, 1, 2),
					name: "Die Nacht",
					textPresentation: { name: { source: "localized" } },
				},
			],
		},
	]
	assert.equal(
		findLinkedEpisode(seasons, link(1, 2, "The Night"))?.episode.id,
		7,
	)
	seasons[0].episodes[0].textPresentation.name.source = "canonical"
	assert.equal(findLinkedEpisode(seasons, link(1, 2, "The Night")), null)
})
