import assert from "node:assert/strict"
import { test } from "node:test"
import "../../../server/title-filter/test-alias.ts"
const { episodeLabel } = await import("./labels.ts")

test("accessible episode labels remain plain text with localized names and existing ratings", () => {
	const rated = episodeLabel(2, {
		number: 1,
		name: "Épisode pilote",
		nameLanguage: "fr-FR",
		score: 8,
		votes: 500,
	})
	assert.equal(
		rated,
		"Season 2, episode 1: Épisode pilote. Rated 8.0, 500 IMDb votes.",
	)
	assert.doesNotMatch(rated, /<span|lang=/)
	assert.equal(
		episodeLabel(1, {
			number: 3,
			name: "未放送",
			nameLanguage: "ja-JP",
			score: 0,
			votes: 0,
			unrated: true,
		}),
		"Season 1, episode 3: 未放送. No IMDb rating.",
	)
})
